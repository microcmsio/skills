# Changelog

このリポジトリの変更履歴です。書式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

## [0.1.0] - 2026-08-31

### Added

- `microcms-docs` スキル: microCMS 公式開発者ドキュメント（document.microcms.io）を参照して回答するスキル
- Claude Code プラグイン定義（`.claude-plugin/`）。プラグイン名・マーケットプレイス名ともに `microcms`。
  MCP サーバーは同梱していないため、インストール時に API キーは要求されません
- `scripts/install.sh`（`.agents/skills/` への手動導入）
- `LICENSE`（MIT）

### Changed

- **スキルの配置を `microcms-docs/` から `skills/microcms-docs/` へ移設しました。**
  `npx skills` / `gh skill` の標準探索パターン `skills/*/SKILL.md` に合わせるためです。
  従来 README に記載していた `curl` によるインストール手順は URL が変わるため無効になります。
  `npx skills add microcmsio/skills` での導入に切り替えてください
- `SKILL.md` / `references/urls.md` から Claude Code 固有のツール名を除去し、
  Cursor / Codex など他エージェントでも成立する表現に変更
- README を刷新（`npx skills` を筆頭に、`gh skill` / Claude プラグイン / 手動コピーを併記。
  Cursor の案内を現行パス `.agents/skills/` に修正）

[0.1.0]: https://github.com/microcmsio/skills/releases/tag/v0.1.0
