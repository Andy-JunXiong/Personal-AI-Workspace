#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
"${script_dir}/web-health.sh"
systemctl is-active --quiet paw-web-tunnel.service
echo "PAW Web tunnel service is active."
