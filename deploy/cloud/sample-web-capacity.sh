#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this capacity sample with sudo" >&2
  exit 1
fi

duration="${1:-90}"
if [[ ! "${duration}" =~ ^[0-9]+$ ]] || (( duration < 30 || duration > 300 )); then
  echo "Usage: $0 [duration-seconds: 30-300]" >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
container=paw-paw-1
docker container inspect "${container}" >/dev/null
[[ "$(docker inspect --format '{{.State.Running}}' "${container}")" == true ]] || {
  echo "PAW container is not running" >&2
  exit 1
}
[[ "$(systemctl is-active paw-web-ingress.service 2>/dev/null || true)" == active ]] || {
  echo "PAW Web ingress is not active" >&2
  exit 1
}

ingress_env=/etc/paw/web-ingress.env
[[ -r "${ingress_env}" ]] || { echo "Missing readable ingress environment" >&2; exit 1; }
set -a
# shellcheck disable=SC1090
source "${ingress_env}"
set +a
[[ "${PAW_WEB_HOST:-}" =~ ^[A-Za-z0-9.-]+$ ]] || {
  echo "Invalid PAW_WEB_HOST" >&2
  exit 1
}

"${script_dir}/web-ingress-health.sh" >/dev/null
restart_before="$(docker inspect --format '{{.RestartCount}}' "${container}")"
oom_before="$(docker inspect --format '{{.State.OOMKilled}}' "${container}")"
[[ "${oom_before}" == false ]] || { echo "PAW container already reports OOMKilled" >&2; exit 1; }
started_at="$(date --iso-8601=seconds)"
backup_log="$(mktemp /tmp/paw-capacity-backup.XXXXXXXX)"
backup_pid=""

cleanup() {
  if [[ -n "${backup_pid}" ]]; then
    wait "${backup_pid}" 2>/dev/null || true
  fi
  [[ ! -f "${backup_log}" ]] || rm -- "${backup_log}"
}
trap cleanup EXIT

"${script_dir}/backup.sh" >"${backup_log}" 2>&1 &
backup_pid=$!
echo "Capacity window active for ${duration} seconds; perform only the authorized synthetic completion now."

deadline=$((SECONDS + duration))
samples=0
request_failures=0
health_failures=0
max_https_seconds=0
max_memory_percent=-1
max_memory_usage="unknown"
min_available_kib="$(awk '/^MemAvailable:/ { print $2 }' /proc/meminfo)"

while (( SECONDS < deadline )); do
  read -r status latency < <(
    curl --silent --show-error --output /dev/null \
      --max-time 5 \
      --resolve "${PAW_WEB_HOST}:443:127.0.0.1" \
      --write-out '%{http_code} %{time_total}\n' \
      "https://${PAW_WEB_HOST}/workspace/job-search/today" || printf '000 5\n'
  )
  [[ "${status}" == 401 ]] || request_failures=$((request_failures + 1))
  if awk -v candidate="${latency}" -v current="${max_https_seconds}" \
    'BEGIN { exit !(candidate > current) }'; then
    max_https_seconds="${latency}"
  fi

  if ! curl --fail --silent --show-error --max-time 5 \
    http://127.0.0.1:3000/healthz >/dev/null; then
    health_failures=$((health_failures + 1))
  fi

  read -r memory_percent memory_usage < <(
    docker stats --no-stream --format '{{.MemPerc}} {{.MemUsage}}' "${container}"
  )
  memory_number="${memory_percent%\%}"
  if awk -v candidate="${memory_number}" -v current="${max_memory_percent}" \
    'BEGIN { exit !(candidate > current) }'; then
    max_memory_percent="${memory_number}"
    max_memory_usage="${memory_usage}"
  fi

  available_kib="$(awk '/^MemAvailable:/ { print $2 }' /proc/meminfo)"
  (( available_kib < min_available_kib )) && min_available_kib="${available_kib}"
  samples=$((samples + 1))
  sleep 2
done

if ! wait "${backup_pid}"; then
  backup_pid=""
  echo "Concurrent backup failed" >&2
  cat "${backup_log}" >&2
  exit 1
fi
backup_pid=""

restart_after="$(docker inspect --format '{{.RestartCount}}' "${container}")"
oom_after="$(docker inspect --format '{{.State.OOMKilled}}' "${container}")"
kernel_oom=false
if journalctl --dmesg --since "${started_at}" --no-pager 2>/dev/null \
  | grep -Eqi 'oom-kill|out of memory|killed process'; then
  kernel_oom=true
fi
"${script_dir}/web-ingress-health.sh" >/dev/null

if (( request_failures > 0 || health_failures > 0 )) ||
   [[ "${restart_before}" != "${restart_after}" || "${oom_after}" != false || "${kernel_oom}" != false ]]; then
  echo "Capacity sample failed: HTTPS failures=${request_failures}, health failures=${health_failures}, restarts=${restart_before}->${restart_after}, OOM=${oom_after}, kernel_OOM=${kernel_oom}" >&2
  exit 1
fi

minimum_available_mib=$((min_available_kib / 1024))
echo "Capacity sample passed: ${samples} samples, HTTPS failures=0, MCP health failures=0, max HTTPS=${max_https_seconds}s."
echo "PAW memory peak sample=${max_memory_usage} (${max_memory_percent}%); minimum host available=${minimum_available_mib} MiB."
echo "Concurrent backup passed; restarts=${restart_after}, OOM=false, ingress healthy."
