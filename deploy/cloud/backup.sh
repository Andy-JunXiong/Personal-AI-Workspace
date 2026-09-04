#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${script_dir}/compose.yaml"
active_tag_file=/srv/paw/deployments/active-image-tag

if [[ ! -r "${active_tag_file}" ]]; then
  echo "Missing active image tag; deploy the service first" >&2
  exit 1
fi

PAW_IMAGE_TAG="$(<"${active_tag_file}")" docker compose \
  --file "${compose_file}" exec --no-TTY paw \
  node dist/scripts/backup-database.js
