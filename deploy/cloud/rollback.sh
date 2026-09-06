#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${script_dir}/compose.yaml"
image_tag="${1:-}"

if [[ -z "${image_tag}" ]]; then
  echo "Usage: $0 <existing-image-tag>" >&2
  exit 1
fi
if [[ ! "${image_tag}" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$ ]]; then
  echo "Invalid Docker image tag: ${image_tag}" >&2
  exit 1
fi
if ! docker image inspect "paw:${image_tag}" >/dev/null 2>&1; then
  echo "Local image does not exist: paw:${image_tag}" >&2
  exit 1
fi
for ingress_service in paw-web-tunnel.service paw-web-ingress.service; do
  ingress_state="$(systemctl is-active "${ingress_service}" 2>/dev/null || true)"
  if [[ "${ingress_state}" =~ ^(active|activating|reloading|deactivating)$ ]]; then
    echo "Refusing image rollback while ${ingress_service} is ${ingress_state}" >&2
    echo "Stop the active Web ingress and select Web mode off before retrying" >&2
    exit 1
  fi
done

PAW_IMAGE_TAG="${image_tag}" docker compose \
  --file "${compose_file}" up --detach --no-build --wait paw
printf '%s\n' "${image_tag}" > /srv/paw/deployments/active-image-tag
"${script_dir}/health.sh"
