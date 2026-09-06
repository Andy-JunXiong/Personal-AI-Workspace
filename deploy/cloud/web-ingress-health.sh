#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
config_file=/etc/paw/web-ingress.env
[[ -r "${config_file}" ]] || { echo "Missing readable ${config_file}" >&2; exit 1; }

# shellcheck source=/dev/null
source "${config_file}"
[[ "${PAW_WEB_HOST:-}" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$ ]] \
  && [[ "${PAW_WEB_HOST}" != *..* ]] || { echo "Invalid PAW_WEB_HOST" >&2; exit 1; }

"${script_dir}/web-health.sh"
ingress_state="$(systemctl is-active paw-web-ingress.service 2>/dev/null || true)"
[[ "${ingress_state}" == active ]] \
  || { echo "paw-web-ingress.service is not active: ${ingress_state}" >&2; exit 1; }
for alternative_service in caddy.service paw-web-tunnel.service; do
  alternative_state="$(systemctl is-active "${alternative_service}" 2>/dev/null || true)"
  [[ ! "${alternative_state}" =~ ^(active|activating|reloading|deactivating)$ ]] \
    || { echo "Conflicting ingress is ${alternative_state}: ${alternative_service}" >&2; exit 1; }
done

headers="$(mktemp)"
trap 'rm -f -- "${headers}"' EXIT
status="$(curl --silent --show-error --max-time 10 --output /dev/null \
  --dump-header "${headers}" --resolve "${PAW_WEB_HOST}:443:127.0.0.1" \
  --write-out '%{http_code}' \
  "https://${PAW_WEB_HOST}/workspace/job-search/today")"
[[ "${status}" == 401 ]] || { echo "HTTPS ingress did not return signed-out 401" >&2; exit 1; }
grep --ignore-case --quiet '^cache-control:.*no-store' "${headers}"
grep --ignore-case --quiet "^content-security-policy:.*default-src 'none'" "${headers}"
grep --ignore-case --quiet '^x-content-type-options:.*nosniff' "${headers}"

for path in /mcp /healthz /admin; do
  status="$(curl --silent --show-error --max-time 10 --output /dev/null \
    --resolve "${PAW_WEB_HOST}:443:127.0.0.1" --write-out '%{http_code}' \
    "https://${PAW_WEB_HOST}${path}")"
  [[ "${status}" == 404 ]] || { echo "Sensitive route did not return 404: ${path}" >&2; exit 1; }
done

if ss -H -ltn | awk '$4 ~ /:80$/ { found=1 } END { exit !found }'; then
  echo "Unexpected port 80 listener" >&2
  exit 1
fi
unsafe_listener="$(ss -H -ltn | awk '$4 ~ /:(3000|3001)$/ && $4 !~ /^127\.0\.0\.1:/ && $4 !~ /^\[::1\]:/ { print $4; exit }')"
[[ -z "${unsafe_listener}" ]] || { echo "Application port is public: ${unsafe_listener}" >&2; exit 1; }

echo "PAW HTTPS ingress is healthy on 443; port 80 is closed and application ports remain loopback-only."
