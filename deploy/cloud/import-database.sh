#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${script_dir}/compose.yaml"
active_tag_file=/srv/paw/deployments/active-image-tag
source_argument="${1:-}"
expected_sha256="${2:-}"

usage() {
  echo "Usage: $0 /srv/paw/import/paw-c3-source-YYYYMMDDTHHMMSSZ.db <sha256>" >&2
  exit 1
}

[[ -n "${source_argument}" && -n "${expected_sha256}" ]] || usage
[[ "${expected_sha256}" =~ ^[0-9a-fA-F]{64}$ ]] || usage
if ! mountpoint -q /srv/paw; then
  echo "/srv/paw is not a mounted persistent disk; refusing import" >&2
  exit 1
fi
if [[ ! -r "${active_tag_file}" ]]; then
  echo "Missing active image tag" >&2
  exit 1
fi

mkdir -p /srv/paw/import /srv/paw/restore-quarantine
import_root="$(realpath -e /srv/paw/import)"
source_path="$(realpath -e -- "${source_argument}")"
if [[ "$(dirname -- "${source_path}")" != "${import_root}" ]] \
  || [[ ! "$(basename -- "${source_path}")" =~ ^paw-c3-source-[0-9]{8}T[0-9]{6}Z\.db$ ]] \
  || [[ ! -f "${source_path}" || -L "${source_argument}" ]]; then
  echo "Source must be a regular, non-link paw-c3-source timestamped DB directly under /srv/paw/import" >&2
  exit 1
fi

actual_sha256="$(sha256sum -- "${source_path}" | awk '{print $1}')"
if [[ "${actual_sha256}" != "${expected_sha256,,}" ]]; then
  echo "SHA-256 mismatch; refusing import" >&2
  exit 1
fi

image_tag="$(<"${active_tag_file}")"
PAW_IMAGE_TAG="${image_tag}" docker compose \
  --file "${compose_file}" run --rm --no-deps \
  --volume "${source_path}:/tmp/c3-source.db:ro" \
  --entrypoint node paw dist/scripts/verify-database.js /tmp/c3-source.db </dev/null

# Preserve a database-consistent copy of the currently active cloud database
# before changing any live file.
"${script_dir}/backup.sh" </dev/null

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
quarantine="/srv/paw/restore-quarantine/c3-${timestamp}"
failed_import="/srv/paw/restore-quarantine/c3-failed-${timestamp}"
mkdir -p "${quarantine}"
cutover_started=false

rollback_import() {
  local exit_code=$?
  if [[ "${cutover_started}" == true ]]; then
    set +e
    docker compose --file "${compose_file}" stop paw >/dev/null 2>&1
    mkdir -p "${failed_import}"
    for database_file in workspace.db workspace.db-wal workspace.db-shm; do
      if [[ -e "/srv/paw/data/${database_file}" ]]; then
        mv -- "/srv/paw/data/${database_file}" "${failed_import}/${database_file}"
      fi
      if [[ -e "${quarantine}/${database_file}" ]]; then
        mv -- "${quarantine}/${database_file}" "/srv/paw/data/${database_file}"
      fi
    done
    PAW_IMAGE_TAG="${image_tag}" docker compose \
      --file "${compose_file}" up --detach --no-build --wait paw >/dev/null
    echo "C3 import failed; the previous cloud database was restored. Failed files are in ${failed_import}" >&2
  fi
  exit "${exit_code}"
}
trap rollback_import ERR

docker compose --file "${compose_file}" stop paw
cutover_started=true
for database_file in workspace.db workspace.db-wal workspace.db-shm; do
  if [[ -e "/srv/paw/data/${database_file}" ]]; then
    mv -- "/srv/paw/data/${database_file}" "${quarantine}/${database_file}"
  fi
done
install --mode=0600 "${source_path}" /srv/paw/data/workspace.db

PAW_IMAGE_TAG="${image_tag}" docker compose \
  --file "${compose_file}" up --detach --no-build --wait paw
"${script_dir}/health.sh"
cutover_started=false
trap - ERR

echo "C3 database import completed."
echo "Imported SHA256: ${actual_sha256}"
echo "Previous cloud database: ${quarantine}"
echo "Staged source retained: ${source_path}"
