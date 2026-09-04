#!/usr/bin/env bash
set -Eeuo pipefail

curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:3000/healthz
printf '\n'
curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:8080/healthz
printf '\n'
curl --fail --silent --show-error --max-time 5 \
  http://127.0.0.1:8080/readyz
printf '\n'
systemctl is-active --quiet paw-tunnel-client.service
