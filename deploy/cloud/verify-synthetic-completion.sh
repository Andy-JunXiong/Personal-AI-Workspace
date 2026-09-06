#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this verification with sudo" >&2
  exit 1
fi

task_id="${1:-}"
if [[ ! "${task_id}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]]; then
  echo "Usage: $0 <synthetic-task-id>" >&2
  exit 1
fi

container=paw-paw-1
active_tag_file=/srv/paw/deployments/active-image-tag
[[ -r "${active_tag_file}" ]] || { echo "Missing active image tag" >&2; exit 1; }
image_tag="$(<"${active_tag_file}")"
[[ "${image_tag}" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$ ]] || {
  echo "Invalid active image tag" >&2
  exit 1
}
docker image inspect "paw:${image_tag}" >/dev/null
docker container inspect "${container}" >/dev/null

[[ "$(docker exec "${container}" printenv PAW_WEB_WRITES_ENABLED)" == false ]] || {
  echo "Browser writes must be disabled before completion verification" >&2
  exit 1
}
[[ "$(docker exec "${container}" printenv PAW_WEB_BOOTSTRAP_ENABLED)" == false ]] || {
  echo "Bootstrap must be disabled before completion verification" >&2
  exit 1
}

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
docker run --rm \
  --network none \
  --read-only \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --pids-limit 64 \
  --memory 256m \
  --mount type=bind,source=/srv/paw/data,target=/app/data \
  --mount "type=bind,source=${script_dir},target=/opt/paw/deploy/cloud,readonly" \
  --entrypoint node \
  "paw:${image_tag}" \
  /opt/paw/deploy/cloud/verify-synthetic-completion.mjs \
  /app/data/workspace.db "${task_id}"

"${script_dir}/web-ingress-health.sh" >/dev/null
echo "Synthetic completion verification passed; Web remains read-only and ingress is healthy."
