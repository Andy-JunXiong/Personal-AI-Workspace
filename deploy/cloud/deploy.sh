#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "${script_dir}/../.." && pwd)"
compose_file="${script_dir}/compose.yaml"
image_tag="${1:-$(git -C "${repo_root}" rev-parse --short=12 HEAD)}"

if [[ ! "${image_tag}" =~ ^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$ ]]; then
  echo "Invalid Docker image tag: ${image_tag}" >&2
  exit 1
fi
if [[ ! -r /etc/paw/paw.env ]]; then
  echo "Missing readable /etc/paw/paw.env" >&2
  exit 1
fi
if ! mountpoint -q /srv/paw; then
  echo "/srv/paw is not a mounted persistent disk; refusing deployment" >&2
  exit 1
fi

mkdir -p /srv/paw/data /srv/paw/backups /srv/paw/deployments
docker build --pull --tag "paw:${image_tag}" "${repo_root}"
PAW_IMAGE_TAG="${image_tag}" docker compose \
  --file "${compose_file}" up --detach --no-build --wait paw
printf '%s\n' "${image_tag}" > /srv/paw/deployments/active-image-tag
"${script_dir}/health.sh"
