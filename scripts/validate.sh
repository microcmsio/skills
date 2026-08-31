#!/usr/bin/env bash
#
# スキルとプラグイン定義を検証する。CI (.github/workflows/validate.yml) と手元で共用。
#
#   bash scripts/validate.sh
set -uo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.."

SKILLS_REF_VERSION="0.1.5"
SKILLS_VERSION="1.5.23"

FAILED=0

run() {
  local label="$1"; shift
  echo "==> $label"
  if "$@"; then
    echo "    OK"
  else
    echo "    FAILED: $label" >&2
    FAILED=1
  fi
  echo
}

skip() {
  echo "==> $1"
  echo "    SKIP: $2"
  echo
}

run "Agent Skills 規格の検証 (skills-ref validate)" \
  npx -y "skills-ref@${SKILLS_REF_VERSION}" validate ./skills/*

# ディレクトリを動かしたときに npx skills から見えなくなる事故を検出する。
run "発見可能性の確認 (skills add --list)" \
  npx -y "skills@${SKILLS_VERSION}" add . --list --full-depth

if command -v claude >/dev/null 2>&1; then
  run "プラグイン定義の検証 (claude plugin validate)" \
    claude plugin validate . --strict
else
  skip "プラグイン定義の検証 (claude plugin validate)" "claude CLI が見つかりません"
fi

if ! command -v gh >/dev/null 2>&1 || ! gh skill --help >/dev/null 2>&1; then
  skip "gh skill 配布の検証 (gh skill publish --dry-run)" "gh CLI (v2.90.0+) が見つかりません"
elif ! gh auth status >/dev/null 2>&1; then
  # CI にトークンを渡さずに済むよう、認証済みの環境でのみ実行する。
  skip "gh skill 配布の検証 (gh skill publish --dry-run)" "gh が未認証です（gh auth login）"
else
  run "gh skill 配布の検証 (gh skill publish --dry-run)" \
    gh skill publish --dry-run
fi

if [ "$FAILED" -ne 0 ]; then
  echo "検証に失敗した項目があります。" >&2
  exit 1
fi
echo "すべての検証を通過しました。"
