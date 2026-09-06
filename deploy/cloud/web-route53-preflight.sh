#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
paw_env=/etc/paw/paw.env
ingress_env=/etc/paw/web-ingress.env
caddy_config=/etc/caddy/paw.Caddyfile
installed_unit=/etc/systemd/system/paw-web-ingress.service
google_secret=/etc/paw/secrets/google-client-secret

fail() {
  echo "Route 53 Web preflight failed: $*" >&2
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

valid_ipv4() {
  local address="$1"
  local octet
  local -a octets=()
  [[ "${address}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]] || return 1
  IFS=. read -r -a octets <<<"${address}"
  for octet in "${octets[@]}"; do
    (( 10#${octet} <= 255 )) || return 1
  done
}

require_command caddy
require_command cmp
require_command getent
require_command ss
require_command stat
require_file "${paw_env}" 0 600
require_file "${ingress_env}" 0 640
require_file "${caddy_config}" 0 644
require_file "${installed_unit}" 0 644
require_file "${google_secret}" 1000 400

web_zone="$(read_env_value "${ingress_env}" PAW_WEB_ZONE)"
web_host="$(read_env_value "${ingress_env}" PAW_WEB_HOST)"
expected_ipv4="$(read_env_value "${ingress_env}" PAW_WEB_EXPECTED_IPV4)"
acme_email="$(read_env_value "${ingress_env}" PAW_ACME_EMAIL)"
web_origin="$(read_env_value "${paw_env}" PAW_WEB_ORIGIN)"
google_client_id="$(read_env_value "${paw_env}" PAW_GOOGLE_CLIENT_ID)"
web_enabled="$(read_env_value "${paw_env}" PAW_WEB_ENABLED)"
web_writes_enabled="$(read_env_value "${paw_env}" PAW_WEB_WRITES_ENABLED)"
web_bootstrap_enabled="$(read_env_value "${paw_env}" PAW_WEB_BOOTSTRAP_ENABLED)"

[[ "${web_zone}" == ai-radar-lab.com ]] || fail "PAW_WEB_ZONE must equal the approved AI Radar zone"
[[ "${web_host}" == "workspace.${web_zone}" ]] || fail "PAW_WEB_HOST must equal workspace.PAW_WEB_ZONE"
[[ "${web_origin}" == "https://${web_host}" ]] \
  || fail "PAW_WEB_ORIGIN must equal https://PAW_WEB_HOST with no path"
valid_ipv4 "${expected_ipv4}" || fail "PAW_WEB_EXPECTED_IPV4 must be a valid IPv4 address"
[[ "${expected_ipv4}" != 203.0.113.10 ]] || fail "PAW_WEB_EXPECTED_IPV4 still uses the documentation address"
[[ "${acme_email}" =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] \
  || fail "PAW_ACME_EMAIL must be a valid operator email"
[[ "${acme_email}" != replace-with-operator-email@example.com ]] \
  || fail "PAW_ACME_EMAIL still uses the example value"
[[ "${google_client_id}" =~ ^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$ ]] \
  || fail "PAW_GOOGLE_CLIENT_ID is not a Google Web OAuth client ID"
[[ "${web_enabled}" == false ]] || fail "PAW_WEB_ENABLED must remain false in the base environment"
[[ "${web_writes_enabled}" == false ]] || fail "PAW_WEB_WRITES_ENABLED must remain false before publication"
[[ "${web_bootstrap_enabled}" == false ]] || fail "PAW_WEB_BOOTSTRAP_ENABLED must remain false before identity linking"

cmp --silent "${script_dir}/caddy/Caddyfile" "${caddy_config}" \
  || fail "installed Caddyfile differs from the reviewed repository copy"
cmp --silent "${script_dir}/systemd/paw-web-ingress.service" "${installed_unit}" \
  || fail "installed ingress unit differs from the reviewed repository copy"
grep -Fq 'reverse_proxy 127.0.0.1:3001' "${caddy_config}" \
  || fail "Caddy must proxy only to the loopback Web listener"
grep -Fq 'disable_http_challenge' "${caddy_config}" \
  || fail "Caddy must not require public port 80 for ACME"
! grep -Eq '127\.0\.0\.1:3000|access_log|log[[:space:]]*\{' "${caddy_config}" \
  || fail "Caddy must not expose MCP or enable request access logs"

for service in caddy.service paw-web-tunnel.service paw-web-ingress.service; do
  service_state="$(systemctl is-active "${service}" 2>/dev/null || true)"
  if [[ "${service_state}" =~ ^(active|activating|reloading|deactivating)$ ]]; then
    fail "${service} must be inactive during the pre-publication check; state is ${service_state}"
  fi
done

unsafe_listener="$(ss -H -ltn | awk '$4 ~ /:(3000|3001)$/ && $4 !~ /^127\.0\.0\.1:/ && $4 !~ /^\[::1\]:/ { print $4; exit }')"
[[ -z "${unsafe_listener}" ]] || fail "application port has a non-loopback listener: ${unsafe_listener}"

mapfile -t resolved_ipv4 < <(getent ahostsv4 "${web_host}" | awk '{ print $1 }' | sort -u)
[[ "${#resolved_ipv4[@]}" == 1 && "${resolved_ipv4[0]}" == "${expected_ipv4}" ]] \
  || fail "Route 53 must resolve only PAW_WEB_HOST to PAW_WEB_EXPECTED_IPV4"

validation_root="$(mktemp -d)"
trap 'rm -rf -- "${validation_root}"' EXIT
XDG_DATA_HOME="${validation_root}/data" XDG_CONFIG_HOME="${validation_root}/config" \
  PAW_WEB_HOST="${web_host}" PAW_ACME_EMAIL="${acme_email}" \
  caddy validate --config "${caddy_config}" --adapter caddyfile >/dev/null

echo "Route 53 Web preflight passed."
echo "Host: ${web_host}"
echo "Origin: ${web_origin}"
echo "Expected static IPv4: ${expected_ipv4}"
echo "HTTPS ingress: inactive"
echo "Browser writes: disabled"
echo "Caddy: $(caddy version)"
