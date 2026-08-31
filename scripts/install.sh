#!/usr/bin/env bash
#
# microCMS Agent Skills を .agents/skills/ に導入する。
#
#   bash scripts/install.sh                 # ./.agents/skills/ (プロジェクト単位)
#   bash scripts/install.sh --global        # ~/.agents/skills/ (全プロジェクト共通)
#   bash scripts/install.sh --dir <path>    # 任意のディレクトリ
#
# リポジトリを clone していない場合は、一時ディレクトリに clone してから導入する。
set -euo pipefail

REPO_URL="https://github.com/microcmsio/skills.git"
DEST=".agents/skills"

while [ $# -gt 0 ]; do
  case "$1" in
    --global) DEST="$HOME/.agents/skills"; shift ;;
    --dir)    DEST="${2:?--dir にはパスを指定してください}"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "不明なオプション: $1" >&2; exit 1 ;;
  esac
done

# スキルの正本 (skills/) を探す。スクリプトと同じリポジトリ内にあればそれを使う。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/../skills"

if [ ! -d "$SRC" ]; then
  TMP_DIR="$(mktemp -d)"
  trap 'rm -rf "$TMP_DIR"' EXIT
  echo "リポジトリを取得しています..."
  git clone --depth 1 "$REPO_URL" "$TMP_DIR/skills-repo" >/dev/null 2>&1
  SRC="$TMP_DIR/skills-repo/skills"
fi

mkdir -p "$DEST"
cp -R "$SRC"/* "$DEST"/

echo "インストール先: $DEST"
for skill in "$DEST"/*/; do
  echo "  - $(basename "$skill")"
done
echo
echo "Claude Code で使う場合は /reload-skills を実行するとセッションを再起動せずに読み込まれます。"
