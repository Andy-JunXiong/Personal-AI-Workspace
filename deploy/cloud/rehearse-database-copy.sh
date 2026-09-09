#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this rehearsal with sudo" >&2
  exit 1
fi

backup_name="${1:-}"
current_tag="${2:-}"
previous_tag="${3:-}"
mode="${4:-unchanged}"
if [[ "${mode}" != unchanged && "${mode}" != --s2-upgrade && "${mode}" != --mail-batch-upgrade && "${mode}" != --mail-ingestion-upgrade && "${mode}" != --mail-scan-ledger-upgrade && "${mode}" != --mail-body-read-upgrade && "${mode}" != --job-mail-search-upgrade && "${mode}" != --job-library-upgrade && "${mode}" != --resume-editor-upgrade ]]; then
  echo "Optional fourth argument must be a supported upgrade mode, including --job-mail-search-upgrade" >&2
  exit 1
fi
upgrade_verifier=dist/scripts/verify-s2-migration.js
if [[ "${mode}" == --resume-editor-upgrade ]]; then
  upgrade_verifier=dist/scripts/verify-resume-migration.js
fi
if [[ "${mode}" == --job-library-upgrade ]]; then
  upgrade_verifier=dist/scripts/verify-job-library-migration.js
fi
if [[ "${mode}" == --mail-batch-upgrade ]]; then
  upgrade_verifier=dist/scripts/verify-mail-batch-migration.js
fi
if [[ "${mode}" == --mail-ingestion-upgrade ]]; then
  upgrade_verifier=dist/scripts/verify-mail-ingestion-migration.js
fi
if [[ "${mode}" == --mail-scan-ledger-upgrade ]]; then
  upgrade_verifier=dist/scripts/verify-mail-scan-ledger-migration.js
fi
if [[ "${mode}" == --mail-body-read-upgrade ]]; then
  upgrade_verifier=dist/scripts/verify-mail-body-read-migration.js
fi
if [[ "${mode}" == --job-mail-search-upgrade ]]; then
  upgrade_verifier=dist/scripts/verify-job-mail-search-migration.js
fi
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
  local image_tag="$1" sequence="$2" check="${3:-unchanged}"
  local data_dir="${run_dir}/image-${sequence}"
  if [[ ! -d "${data_dir}" ]]; then
    install -d -o 1000 -g 1000 -m 0700 "${data_dir}"
    install -o 1000 -g 1000 -m 0600 "${backup_path}" "${data_dir}/workspace.db"
  fi

  verify_copy "${image_tag}" "${data_dir}"
  local before_hash before_tables before_rows
  local before_fingerprint
  before_fingerprint="$(fingerprint "${image_tag}" "${data_dir}")"
  IFS=$'\t' read -r before_hash before_tables before_rows <<<"${before_fingerprint}"

  container_name="paw-recovery-${sequence}-$$"
  # Keep an exited probe until cleanup so startup failures remain diagnosable.
  docker run --detach \
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
    docker logs --tail 30 "${container_name}" >&2 || true
    echo "Isolated startup failed for paw:${image_tag}; health=${health:-missing}" >&2
    exit 1
  fi

  local memory_sample
  memory_sample="$(docker stats --no-stream --format '{{.MemUsage}}' "${container_name}")"
  docker stop --time 15 "${container_name}" >/dev/null
  docker rm "${container_name}" >/dev/null
  container_name=""

  local after_hash after_tables after_rows
  local after_fingerprint
  after_fingerprint="$(fingerprint "${image_tag}" "${data_dir}")"
  IFS=$'\t' read -r after_hash after_tables after_rows <<<"${after_fingerprint}"
  if [[ "${check}" == upgrade ]]; then
    docker run --rm --network none --read-only --cap-drop ALL \
      --security-opt no-new-privileges:true \
      --mount "type=bind,source=${backup_path},target=/app/before.db,readonly" \
      --mount "type=bind,source=${data_dir},target=/app/data,readonly" \
      --entrypoint node "paw:${image_tag}" \
      "${upgrade_verifier}" /app/before.db /app/data/workspace.db
  elif [[ "${before_hash}" != "${after_hash}" ||
        "${before_tables}" != "${after_tables}" ||
        "${before_rows}" != "${after_rows}" ]]; then
    echo "Logical database content changed during isolated startup for paw:${image_tag}" >&2
    exit 1
  fi
  verify_copy "${image_tag}" "${data_dir}"
  echo "paw:${image_tag} copy passed: check=${check}, healthy, integrity ok, ${after_tables} tables/${after_rows} rows, memory ${memory_sample}"
}

if [[ "${mode}" != unchanged ]]; then
  # current_tag is the candidate; previous_tag is the deployed baseline image.
  # All three starts share the upgraded COPY, never the live database.
  run_image "${current_tag}" upgrade upgrade
  run_image "${current_tag}" upgrade
  run_image "${previous_tag}" upgrade
else
  run_image "${current_tag}" current
  run_image "${previous_tag}" previous
fi
echo "Database-copy recovery rehearsal passed; the live container and database were not modified."
