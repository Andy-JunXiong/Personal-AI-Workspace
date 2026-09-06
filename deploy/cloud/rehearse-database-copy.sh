#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this rehearsal with sudo" >&2
  exit 1
fi

backup_name="${1:-}"
current_tag="${2:-}"
previous_tag="${3:-}"
if [[ ! "${backup_name}" =~ ^workspace-[0-9]{8}T[0-9]{6}Z\.db$ ]]; then
  echo "Usage: $0 workspace-YYYYMMDDTHHMMSSZ.db <current-tag> <previous-tag>" >&2
  exit 1
fi
for tag in "${current_tag}" "${previous_tag}"; do
  if [[ ! "${tag}" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$ ]]; then
    echo "Invalid image tag: ${tag}" >&2
    exit 1
  fi
  docker image inspect "paw:${tag}" >/dev/null
done
if [[ "${current_tag}" == "${previous_tag}" ]]; then
  echo "Current and previous image tags must differ" >&2
  exit 1
fi

backup_path="/srv/paw/backups/${backup_name}"
if [[ ! -f "${backup_path}" || -L "${backup_path}" ]]; then
  echo "Backup is missing or is not a regular file: ${backup_path}" >&2
  exit 1
fi
docker container inspect paw-paw-1 >/dev/null

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
fingerprint_script="${script_dir}/database-logical-fingerprint.mjs"
[[ -f "${fingerprint_script}" && ! -L "${fingerprint_script}" ]] || {
  echo "Missing logical fingerprint script" >&2
  exit 1
}

rehearsal_root=/srv/paw/recovery-rehearsal
install -d -o root -g root -m 0700 "${rehearsal_root}"
run_dir="$(mktemp --directory "${rehearsal_root}/run-XXXXXXXX")"
chmod 0700 "${run_dir}"
identity_env="${run_dir}/identity.env"
container_name=""

cleanup() {
  if [[ -n "${container_name}" ]]; then
    docker rm --force "${container_name}" >/dev/null 2>&1 || true
  fi
  if [[ -d "${run_dir}" && "${run_dir}" == "${rehearsal_root}/run-"* ]]; then
    find "${run_dir}" -mindepth 1 -delete
    rmdir -- "${run_dir}"
  fi
}
trap cleanup EXIT

touch "${identity_env}"
chmod 0600 "${identity_env}"
container_environment="$(docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' paw-paw-1)"
for key in PAW_DEV_PRINCIPAL_ISSUER PAW_DEV_PRINCIPAL_SUBJECT; do
  line="$(grep -m 1 -E "^${key}=" <<<"${container_environment}" || true)"
  [[ -n "${line}" ]] || { echo "Running container is missing ${key}" >&2; exit 1; }
  printf '%s\n' "${line}" >>"${identity_env}"
done
for key in PAW_DEV_WORKSPACE_NAME PAW_TIME_ZONE; do
  line="$(grep -m 1 -E "^${key}=" <<<"${container_environment}" || true)"
  [[ -z "${line}" ]] || printf '%s\n' "${line}" >>"${identity_env}"
done

fingerprint() {
  local image_tag="$1" data_dir="$2"
  docker run --rm \
    --network none \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --mount "type=bind,source=${data_dir},target=/app/data" \
    --mount "type=bind,source=${fingerprint_script},target=/opt/paw/database-logical-fingerprint.mjs,readonly" \
    --entrypoint node \
    "paw:${image_tag}" \
    /opt/paw/database-logical-fingerprint.mjs /app/data/workspace.db
}

verify_copy() {
  local image_tag="$1" data_dir="$2"
  docker run --rm \
    --network none \
    --read-only \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --mount "type=bind,source=${data_dir},target=/app/data" \
    --entrypoint node \
    "paw:${image_tag}" \
    dist/scripts/verify-database.js /app/data/workspace.db >/dev/null
}

run_image() {
  local image_tag="$1" sequence="$2"
  local data_dir="${run_dir}/image-${sequence}"
  install -d -o 1000 -g 1000 -m 0700 "${data_dir}"
  install -o 1000 -g 1000 -m 0600 "${backup_path}" "${data_dir}/workspace.db"

  verify_copy "${image_tag}" "${data_dir}"
  local before_hash before_tables before_rows
  IFS=$'\t' read -r before_hash before_tables before_rows \
    < <(fingerprint "${image_tag}" "${data_dir}")

  container_name="paw-recovery-${sequence}-$$"
  docker run --detach --rm \
    --name "${container_name}" \
    --network none \
    --env-file "${identity_env}" \
    --env PAW_DB_PATH=/app/data/workspace.db \
    --env PAW_WEB_ENABLED=false \
    --env PAW_WEB_WRITES_ENABLED=false \
    --env PAW_WEB_BOOTSTRAP_ENABLED=false \
    --env PORT=3000 \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --cap-drop ALL \
    --security-opt no-new-privileges:true \
    --pids-limit 128 \
    --memory 384m \
    --mount "type=bind,source=${data_dir},target=/app/data" \
    "paw:${image_tag}" >/dev/null

  local health="starting"
  for _ in {1..30}; do
    health="$(docker inspect --format '{{.State.Health.Status}}' "${container_name}" 2>/dev/null || true)"
    [[ "${health}" == "healthy" || "${health}" == "unhealthy" ]] && break
    sleep 1
  done
  if [[ "${health}" != "healthy" ]]; then
    echo "Isolated startup failed for paw:${image_tag}; health=${health:-missing}" >&2
    exit 1
  fi

  local memory_sample
  memory_sample="$(docker stats --no-stream --format '{{.MemUsage}}' "${container_name}")"
  docker stop --time 15 "${container_name}" >/dev/null
  container_name=""

  local after_hash after_tables after_rows
  IFS=$'\t' read -r after_hash after_tables after_rows \
    < <(fingerprint "${image_tag}" "${data_dir}")
  if [[ "${before_hash}" != "${after_hash}" ||
        "${before_tables}" != "${after_tables}" ||
        "${before_rows}" != "${after_rows}" ]]; then
    echo "Logical database content changed during isolated startup for paw:${image_tag}" >&2
    exit 1
  fi
  verify_copy "${image_tag}" "${data_dir}"
  echo "paw:${image_tag} copy passed: healthy, integrity ok, ${before_tables} tables/${before_rows} rows unchanged, memory ${memory_sample}"
}

run_image "${current_tag}" current
run_image "${previous_tag}" previous
echo "Database-copy recovery rehearsal passed; the live container and database were not modified."
