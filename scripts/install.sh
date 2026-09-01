#!/usr/bin/env bash
#
# microCMS Agent Skills を導入する。
#
# .agents/skills/ を正本として配置し、そこを直接読まないエージェント
# (Claude Code の .claude/skills/) には相対シンボリックリンクを張る。
#
#   bash scripts/install.sh                 # ./.agents/skills/    (プロジェクト単位)
#   bash scripts/install.sh --global        # ~/.agents/skills/    (全プロジェクト共通)
#   bash scripts/install.sh --no-link       # シンボリックリンクを張らない
#   bash scripts/install.sh --force         # リンク先に実体がある場合も置き換える
set -euo pipefail

REPO_URL="https://github.com/microcmsio/skills.git"
BASE="."
LINK=1
FORCE=0

usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --global)  BASE="$HOME"; shift ;;
    --no-link) LINK=0; shift ;;
    --force)   FORCE=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "不明なオプション: $1" >&2; exit 1 ;;
  esac
done

DEST="$BASE/.agents/skills"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$SCRIPT_DIR/../skills"

# curl 等でスクリプト単体を実行された場合に備え、リポジトリを取得してから導入する。
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

# .agents/skills/ を直接読まないエージェント向けのリンク先。
# ${BASE}/.claude/skills/<name> -> ../../.agents/skills/<name>
if [ "$LINK" -eq 1 ]; then
  echo
  dest_abs="$(cd "$DEST" && pwd -P)"
  for agent_dir in ".claude"; do
    link_root="$BASE/$agent_dir/skills"
    mkdir -p "$link_root"
    link_root_abs="$(cd "$link_root" && pwd -P)"

    # 相対リンクは導入先ごと移動しても壊れないが、.claude/ 自体が
    # symlink の場合 (dotfiles 管理など) は実体側を基準に解決されてしまう。
    # 相対パスが実体に届く配置のときだけ相対、それ以外は絶対パスで張る。
    if [ "$(dirname "$(dirname "$link_root_abs")")/.agents/skills" = "$dest_abs" ]; then
      link_prefix="../../.agents/skills"
    else
      link_prefix="$dest_abs"
    fi

    for skill in "$DEST"/*/; do
      name="$(basename "$skill")"
      target="$link_root/$name"
      if [ -L "$target" ]; then
        rm "$target"
      elif [ -e "$target" ]; then
        if [ "$FORCE" -eq 1 ]; then
          rm -rf "$target"
        else
          echo "スキップ: $target に実体があります (置き換えるには --force)" >&2
          continue
        fi
      fi
      ln -s "$link_prefix/$name" "$target"
      if [ ! -e "$target" ]; then
        echo "警告: $target のリンクが解決できません" >&2
        continue
      fi
      echo "リンク: $target -> $link_prefix/$name"
    done
  done
fi

echo
echo "Claude Code で使う場合は /reload-skills を実行するとセッションを再起動せずに読み込まれます。"
