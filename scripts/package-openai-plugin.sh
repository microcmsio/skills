#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${ROOT_DIR}/dist"

python3 "${ROOT_DIR}/scripts/validate-openai-plugin.py"

mkdir -p "${DIST_DIR}"
rm -f "${DIST_DIR}/microcms-docs-skill.zip" "${DIST_DIR}/microcms-plugin.zip"

(
  cd "${ROOT_DIR}"
  zip -q -r "${DIST_DIR}/microcms-plugin.zip" \
    plugin.json .codex-plugin skills assets LICENSE README.md \
    -x '*/.DS_Store'
)

echo "Created: ${DIST_DIR}/microcms-plugin.zip"
