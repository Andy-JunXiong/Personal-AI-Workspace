#!/usr/bin/env bash
set -Eeuo pipefail

config_file=/etc/paw/web-tunnel.env
if [[ -z "${PAW_WEB_HOST:-}" ]]; then
  if [[ ! -r "${config_file}" ]]; then
    echo "Missing readable ${config_file}" >&2
    exit 1
  fi
  # systemd supplies this variable before dropping to its dynamic identity.
  # shellcheck source=/dev/null
  source "${config_file}"
fi
if [[ ! "${PAW_WEB_HOST:-}" =~ ^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$ ]] \
  || [[ "${PAW_WEB_HOST}" == *..* ]]; then
  echo "Invalid PAW_WEB_HOST" >&2
  exit 1
fi

headers="$(mktemp)"
trap 'rm -f -- "${headers}"' EXIT
status=""
for _attempt in {1..30}; do
  status="$(curl --silent --show-error --max-time 5 --output /dev/null \
    --dump-header "${headers}" --header "Host: ${PAW_WEB_HOST}" \
    --write-out '%{http_code}' \
    http://127.0.0.1:3001/workspace/job-search/today || true)"
  [[ "${status}" == 401 ]] && break
  sleep 2
done

if [[ "${status}" != 401 ]]; then
  echo "Web listener did not return the expected signed-out 401 response" >&2
  exit 1
fi
grep --ignore-case --quiet '^cache-control:.*no-store' "${headers}"
grep --ignore-case --quiet "^content-security-policy:.*default-src 'none'" "${headers}"
grep --ignore-case --quiet '^x-content-type-options:.*nosniff' "${headers}"
echo "Web listener is ready on loopback with the expected signed-out boundary."
