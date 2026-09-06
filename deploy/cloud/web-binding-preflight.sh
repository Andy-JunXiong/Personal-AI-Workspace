#!/usr/bin/env bash
set -Eeuo pipefail

paw_env=/etc/paw/paw.env
tunnel_env=/etc/paw/web-tunnel.env
tunnel_config=/etc/paw/web-tunnel.yml
google_secret=/etc/paw/secrets/google-client-secret
tunnel_credential=/etc/paw/secrets/cloudflare-web-tunnel.json

fail() {
  echo "Web binding preflight failed: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

require_file() {
  local path="$1"
  local expected_owner="$2"
  local expected_mode="$3"

  [[ -f "${path}" && ! -L "${path}" ]] || fail "missing regular file: ${path}"
  [[ -s "${path}" ]] || fail "empty file: ${path}"

  local actual_owner actual_mode
  actual_owner="$(stat --format='%u' "${path}")"
  actual_mode="$(stat --format='%a' "${path}")"
  [[ "${actual_owner}" == "${expected_owner}" && "${actual_mode}" == "${expected_mode}" ]] \
    || fail "${path} must have owner UID ${expected_owner} and mode ${expected_mode}"
}

read_env_value() {
  local path="$1"
  local key="$2"
  local -a matches=()
  mapfile -t matches < <(grep -E "^${key}=" "${path}" || true)
  [[ "${#matches[@]}" == 1 ]] || fail "${path} must contain exactly one ${key} entry"
  local value="${matches[0]#*=}"
  [[ -n "${value}" ]] || fail "${key} must not be empty"
  printf '%s' "${value}"
}

require_command cloudflared
require_command stat
require_file "${paw_env}" 0 600
require_file "${tunnel_env}" 0 640
require_file "${tunnel_config}" 0 644
require_file "${google_secret}" 1000 400
require_file "${tunnel_credential}" 0 600

web_host="$(read_env_value "${tunnel_env}" PAW_WEB_HOST)"
tunnel_id="$(read_env_value "${tunnel_env}" PAW_WEB_TUNNEL_ID)"
web_origin="$(read_env_value "${paw_env}" PAW_WEB_ORIGIN)"
google_client_id="$(read_env_value "${paw_env}" PAW_GOOGLE_CLIENT_ID)"
web_enabled="$(read_env_value "${paw_env}" PAW_WEB_ENABLED)"
web_writes_enabled="$(read_env_value "${paw_env}" PAW_WEB_WRITES_ENABLED)"
web_bootstrap_enabled="$(read_env_value "${paw_env}" PAW_WEB_BOOTSTRAP_ENABLED)"

[[ "${web_host}" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$ ]] \
  || fail "PAW_WEB_HOST must be a valid DNS hostname"
[[ "${web_host}" != "workspace.example.com" ]] || fail "PAW_WEB_HOST still uses the example hostname"
[[ "${web_origin}" == "https://${web_host}" ]] \
  || fail "PAW_WEB_ORIGIN must equal https://PAW_WEB_HOST with no path"
[[ "${google_client_id}" =~ ^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$ ]] \
  || fail "PAW_GOOGLE_CLIENT_ID is not a Google Web OAuth client ID"
[[ "${web_enabled}" == false ]] || fail "PAW_WEB_ENABLED must remain false in the base environment"
[[ "${web_writes_enabled}" == false ]] || fail "PAW_WEB_WRITES_ENABLED must remain false before publication"
[[ "${web_bootstrap_enabled}" == false ]] || fail "PAW_WEB_BOOTSTRAP_ENABLED must remain false before the bounded identity-link step"
[[ "${tunnel_id}" =~ ^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$ ]] \
  || fail "PAW_WEB_TUNNEL_ID must be a non-placeholder UUID"

[[ "$(grep -Fxc "  - hostname: ${web_host}" "${tunnel_config}")" == 1 ]] \
  || fail "tunnel ingress must contain the exact PAW_WEB_HOST once"
[[ "$(grep -Fxc "      httpHostHeader: ${web_host}" "${tunnel_config}")" == 1 ]] \
  || fail "tunnel httpHostHeader must equal PAW_WEB_HOST once"
[[ "$(grep -Fxc "    service: http://127.0.0.1:3001" "${tunnel_config}")" == 1 ]] \
  || fail "tunnel must route exactly once to the loopback Web listener"
[[ "$(awk 'NF { line=$0 } END { print line }' "${tunnel_config}")" == "  - service: http_status:404" ]] \
  || fail "tunnel ingress must end with the 404 fallback"
! grep -Fq '127.0.0.1:3000' "${tunnel_config}" || fail "tunnel must not route to MCP"
! grep -Fq 'workspace.example.com' "${tunnel_config}" || fail "tunnel config still uses the example hostname"

if systemctl is-active --quiet paw-web-tunnel.service 2>/dev/null; then
  fail "paw-web-tunnel.service must be inactive during the pre-publication check"
fi

cloudflared tunnel --config "${tunnel_config}" ingress validate >/dev/null
cloudflared_version="$(cloudflared --version | head -n 1)"

echo "Web binding preflight passed."
echo "Host: ${web_host}"
echo "Origin: ${web_origin}"
echo "Tunnel service: inactive"
echo "Browser writes: disabled"
echo "cloudflared: ${cloudflared_version}"
