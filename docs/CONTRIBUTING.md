# コントリビュートガイド

このリポジトリは microCMS 公式の [Agent Skills](https://agentskills.io) を配布します。

## 構造の原則

1. **スキルの正本はルートの `skills/<skill-name>/` だけ。** 複製やプラグイン用の別ツリーは作りません
   （`npx skills` / `gh skill` の第一探索パターン `skills/*/SKILL.md` に一致させるため）
2. **スキル名は必ず `microcms-` プレフィックス。** Cursor / Codex の `.agents/skills/` は名前空間がフラットで、
   `docs` のような一般名は他社スキルと衝突します
3. **プラグインは 1 つ（`microcms`）だけ。** スキルが増えてもプラグインは増やしません
4. **MCP サーバーは同梱しません。** 認証を伴う実行は `microcms-mcp-server` の担当で、スキルは
   「MCP をどう使うかの手順書」に徹します。設定はユーザー側に任せます

## スキルを追加する手順

`skills/` の下にディレクトリを 1 つ増やすだけです。`.claude-plugin/marketplace.json` は変更不要
（プラグインの `skills/` は自動検出されます）。

```
skills/
├── microcms-docs/
└── microcms-<name>/     ← 増えるのはここだけ
    ├── SKILL.md
    └── references/
```

### チェックリスト

- [ ] `docs/skill-template/` を `skills/microcms-<name>/` にコピー
- [ ] `name` をディレクトリ名と一致させる（`microcms-` プレフィックス必須）
- [ ] `description` に「何を」「いつ」「いつ使わないか」を書く
- [ ] **既存スキルの `description` にも排他記述を追記する**（全スキルが同時に入るため必須。下記参照）
- [ ] フロントマターは規格の 6 フィールドのみ（`name` / `description` / `license` / `compatibility` / `metadata` / `allowed-tools`）
- [ ] 本文にツール固有名（`WebFetch`、`AskUserQuestion` など）を書かない
- [ ] スキル本体は 500 行以内。超えたら `references/` に切り出す
- [ ] `.claude-plugin/plugin.json` の `version` を上げる。必要なら `description` / `keywords` も更新
- [ ] `.claude-plugin/marketplace.json` は**触らない**
- [ ] **MCP を宣言しない。** 認証が必要な操作はスキル本体で MCP の設定を案内する
- [ ] `bash scripts/validate.sh` が通ることを確認
- [ ] `claude plugin eval` でトリガー競合が起きていないか確認
- [ ] `CHANGELOG.md` に追記（どのスキルが増えたかを明記）

## トリガー競合の管理

エージェントは起動時に `description` しか読まず、それだけで「このスキルを使うか」を判断します。
スキルが増えると、説明が曖昧なスキル同士でトリガーを奪い合います。

**追加する側だけでなく、既存スキルの `description` も直します。** 片方だけ書くと、既存スキルが
新しいスキルの領域を奪い続けます。

例（スキル名は仮）:

- `microcms-docs` … 「API 仕様や操作手順を調べる時に使う。**スキーマの新規設計は `microcms-schema-designer` を使う**」
- `microcms-schema-designer` … 「API スキーマの設計・見直しの時に使う。**既存 API の仕様確認は `microcms-docs` を使う**」

## 共通リファレンスの扱い

`references/urls.md` のような資産を複数スキルから使いたくなった場合は、**スキル間の連携で解決する**のを
基本とします（「URL 一覧は `microcms-docs` スキルを参照」と書く）。プラグインが 1 つで全スキルが必ず
同時に入るため、「参照先のスキルが入っていない」という状態は起きません。
実測でトリガーが不安定なら、ビルドスクリプトによる複製に倒します。

## バージョニング

- バージョンは `.claude-plugin/plugin.json` の `version` で 1 本管理
- スキルを 1 つ足したらマイナーを上げる（`0.1.0` → `0.2.0`）、既存スキルの修正はパッチを上げる
- `CHANGELOG.md` に**どのスキルが変わったか**を明記する（バージョンが 1 本なので唯一の手がかりになる）
- リリースごとにイミュータブルなタグ（`v0.1.0`）を切る（`gh skill` 経由の利用者向け）

## 検証

```bash
bash scripts/validate.sh          # 規格・発見可能性・プラグイン定義をまとめて検証
claude --plugin-dir .             # ローカルでプラグインとして読み込んで動作確認
```
