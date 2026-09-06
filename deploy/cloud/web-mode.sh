#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
base_compose="${script_dir}/compose.yaml"
web_compose="${script_dir}/compose.web.yaml"
writes_compose="${script_dir}/compose.web-writes.yaml"
active_tag_file=/srv/paw/deployments/active-image-tag
mode="${1:-}"

if [[ ! "${mode}" =~ ^(off|read|write)$ ]]; then
  echo "Usage: $0 <off|read|write>" >&2
  exit 1
fi
if [[ ! -r "${active_tag_file}" ]]; then
  echo "Missing active image tag; deploy the service first" >&2
  exit 1
fi
image_tag="$(<"${active_tag_file}")"
if [[ ! "${image_tag}" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$ ]]; then
  echo "Invalid active Docker image tag" >&2
  exit 1
fi

compose=(docker compose --file "${base_compose}")
if [[ "${mode}" != off ]]; then
  [[ -r /etc/paw/paw.env ]] || { echo "Missing readable /etc/paw/paw.env" >&2; exit 1; }
  [[ -f /etc/paw/secrets/google-client-secret ]] \
    || { echo "Missing Google client secret" >&2; exit 1; }
  [[ ! -L /etc/paw/secrets/google-client-secret ]] \
    || { echo "Google client secret must not be a symbolic link" >&2; exit 1; }
  secret_owner="$(stat --format='%u' /etc/paw/secrets/google-client-secret)"
  secret_mode="$(stat --format='%a' /etc/paw/secrets/google-client-secret)"
  [[ "${secret_owner}" == 1000 && "${secret_mode}" == 400 ]] \
    || { echo "Google client secret must be owned by container UID 1000 with mode 0400" >&2; exit 1; }
  compose+=(--file "${web_compose}")
fi
if [[ "${mode}" == write ]]; then
  compose+=(--file "${writes_compose}")
fi

if [[ "${mode}" == off ]] \
  && systemctl is-active --quiet paw-web-tunnel.service 2>/dev/null; then
  echo "Refusing to remove the Web listener while paw-web-tunnel.service is active" >&2
  echo "Stop the Web tunnel first, then run this command again" >&2
  exit 1
fi

PAW_IMAGE_TAG="${image_tag}" "${compose[@]}" config --quiet
PAW_IMAGE_TAG="${image_tag}" "${compose[@]}" up --detach --no-build --wait paw
"${script_dir}/health.sh"
if [[ "${mode}" != off ]]; then
  "${script_dir}/web-health.sh"
fi
echo "PAW Web mode: ${mode}"
