#!/usr/bin/env bash
set -Eeuo pipefail

version="v0.0.14"
binary_name="tunnel-client-runtime"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this installer as root" >&2
  exit 1
fi

case "$(uname -m)" in
  x86_64)
    platform="linux-amd64"
    expected_sha256="29d29cf860ada54e4d3c82c715f4fbfcff2abcdc2584c0fc26431308dfa2505b"
    ;;
  aarch64|arm64)
    platform="linux-arm64"
    expected_sha256="7a4a6a4eb995c175aa0243434ff79ae9e4c2675d1c25e0d983622c48098159fb"
    ;;
  *)
    echo "Unsupported architecture: $(uname -m)" >&2
    exit 1
    ;;
esac

archive_name="${binary_name}-${version}-${platform}.zip"
download_url="https://github.com/openai/tunnel-client/releases/download/${version}/${archive_name}"
temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/paw-tunnel-client.XXXXXX")"
trap 'rm -rf -- "${temporary_directory}"' EXIT
archive_path="${temporary_directory}/${archive_name}"
extract_directory="${temporary_directory}/extracted"

curl --proto '=https' --tlsv1.2 --fail --location --silent --show-error \
  --output "${archive_path}" "${download_url}"
printf '%s  %s\n' "${expected_sha256}" "${archive_path}" | sha256sum --check --status

mkdir -- "${extract_directory}"
unzip -q "${archive_path}" -d "${extract_directory}"
extracted_binary="${extract_directory}/${binary_name}"
if [[ ! -f "${extracted_binary}" || -L "${extracted_binary}" ]]; then
  echo "Verified archive did not contain the expected regular binary" >&2
  exit 1
fi

install --owner=root --group=root --mode=0755 \
  "${extracted_binary}" "/usr/local/bin/${binary_name}"
"/usr/local/bin/${binary_name}" --version
