# Changelog

このリポジトリの変更履歴です。書式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に、
バージョンは [Semantic Versioning](https://semver.org/lang/ja/) に従います。

バージョンはプラグイン（`.claude-plugin/plugin.json`）で 1 本管理しているため、
**どのスキルが変わったのか**を各項目に明記します。

## [Unreleased]

## [0.1.0] - 2026-08-31

### Added

- `microcms-docs` スキル: microCMS 公式開発者ドキュメント（document.microcms.io）を参照して回答するスキル
- Claude Code プラグイン定義（`.claude-plugin/plugin.json` / `.claude-plugin/marketplace.json`）。プラグイン名・マーケットプレイス名ともに `microcms`。MCP サーバーは同梱しないため、インストール時に API キーは要求されません
- `scripts/install.sh`（`.agents/skills/` への手動導入）/ `scripts/validate.sh`（規格・配布性の検証）
- `docs/CONTRIBUTING.md` / `docs/skill-template/`（スキル追加の手順と雛形）
- `LICENSE`（MIT）

### Changed

- **スキルの配置を `microcms-docs/` から `skills/microcms-docs/` へ移設しました。**
  `npx skills` / `gh skill` の標準探索パターン `skills/*/SKILL.md` に合わせるためです。
  旧 README の `curl` によるインストール手順は URL が変わるため無効になります。
  `npx skills add microcmsio/skills` での導入に切り替えてください
- `SKILL.md` / `references/urls.md` から Claude Code 固有のツール名（`WebFetch` / `AskUserQuestion`）を除去し、
  Cursor / Codex など他エージェントでも成立する表現に変更
- `references/urls.md` の先頭フロントマターを削除（参照ファイルには不要で、`name` が Agent Skills 規格に違反していたため）
- README を刷新（`npx skills` を筆頭に、`gh skill` / Claude プラグイン / 手動コピーを併記。Cursor の案内を `.agents/skills/` に修正）

[Unreleased]: https://github.com/microcmsio/skills/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/microcmsio/skills/releases/tag/v0.1.0
