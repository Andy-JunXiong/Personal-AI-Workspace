#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${script_dir}/compose.yaml"
backup_name="${1:-}"
active_tag_file=/srv/paw/deployments/active-image-tag

if [[ ! "${backup_name}" =~ ^workspace-[0-9]{8}T[0-9]{6}Z\.db$ ]]; then
  echo "Usage: $0 workspace-YYYYMMDDTHHMMSSZ.db" >&2
  exit 1
fi
if ! mountpoint -q /srv/paw; then
  echo "/srv/paw is not a mounted persistent disk; refusing restore" >&2
  exit 1
fi
if [[ ! -r "${active_tag_file}" ]]; then
  echo "Missing active image tag" >&2
  exit 1
fi

backup_path="/srv/paw/backups/${backup_name}"
if [[ ! -f "${backup_path}" || -L "${backup_path}" ]]; then
  echo "Backup is missing or is not a regular file: ${backup_path}" >&2
  exit 1
fi

image_tag="$(<"${active_tag_file}")"
PAW_IMAGE_TAG="${image_tag}" docker compose \
  --file "${compose_file}" run --rm --no-deps --entrypoint node paw \
  dist/scripts/verify-database.js "/app/backups/${backup_name}"

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
quarantine="/srv/paw/restore-quarantine/${timestamp}"
mkdir -p "${quarantine}"
docker compose --file "${compose_file}" stop paw

for database_file in workspace.db workspace.db-wal workspace.db-shm; do
  if [[ -e "/srv/paw/data/${database_file}" ]]; then
    mv -- "/srv/paw/data/${database_file}" "${quarantine}/${database_file}"
  fi
done
install --mode=0600 "${backup_path}" /srv/paw/data/workspace.db

PAW_IMAGE_TAG="${image_tag}" docker compose \
  --file "${compose_file}" up --detach --no-build --wait paw
"${script_dir}/health.sh"
echo "Restore completed; previous database files are in ${quarantine}"
