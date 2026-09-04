#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
compose_file="${script_dir}/compose.yaml"

curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:3000/healthz
printf '\n'
docker compose --file "${compose_file}" ps paw
