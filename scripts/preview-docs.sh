#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
preview_venv="${OPENSTUDYHUB_DOCS_VENV:-/tmp/openstudyhub-mkdocs-preview}"
if [[ ! -x "$preview_venv/bin/mkdocs" ]]; then
  python3 -m venv "$preview_venv"
  "$preview_venv/bin/python" -m pip install -r tools/docs/requirements.txt
fi
"$preview_venv/bin/python" scripts/build-docs.py
"$preview_venv/bin/python" scripts/check-docs.py site
if [[ ${1:-} == --build-only ]]; then exit 0; fi
printf 'Documentation preview: http://127.0.0.1:3080 (Ctrl+C to stop)\n'
exec "$preview_venv/bin/python" -m http.server 3080 --bind 127.0.0.1 --directory site
