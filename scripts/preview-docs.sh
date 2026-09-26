#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
preview_venv="${OPENSTUDYHUB_DOCS_VENV:-/tmp/openstudyhub-mkdocs-preview}"
if [[ ! -x "${preview_venv}/bin/mkdocs" ]]; then
  python3 -m venv "${preview_venv}"
  "${preview_venv}/bin/python" -m pip install "mkdocs==1.6.1" "mkdocs-material==9.7.7"
fi
exec "${preview_venv}/bin/mkdocs" serve --dev-addr 127.0.0.1:3080
