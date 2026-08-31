# microCMS Agent Skills

microCMS 公式の [Agent Skills](https://agentskills.io) です。Claude Code / Cursor / Codex など、
Agent Skills 規格に対応した 40 以上の AI エージェントで動作します。

インストールすると、AI が microCMS に関する質問に対して**公式ドキュメントをその場で参照し、出典付きで**回答するようになります。

|  | スキルなし | スキルあり |
|---|---|---|
| 情報源 | 学習データの記憶（古い可能性） | 公式ドキュメントをその場で取得 |
| 認証ヘッダー | 非推奨の `X-API-KEY` を出すことがある | 現行の `X-MICROCMS-API-KEY` |
| 出典 | なし。検証できない | 参照したドキュメント URL を必ず提示 |
| 不明点 | それらしいコードを推測で埋める | 「ドキュメントに記載がない」と伝える |

## スキル一覧

| スキル名 | 説明 |
|---------|------|
| [`microcms-docs`](skills/microcms-docs/) | microCMS 公式開発者ドキュメント（[document.microcms.io](https://document.microcms.io)）を参照し、API 仕様の解説・コード例の生成・操作手順の回答を行う。コンテンツ API、マネジメント API、画像 API、管理画面マニュアル、各種フレームワークチュートリアルに対応 |

---

## インストール

### npx skills（推奨）

ほぼすべてのエージェントに対応しています。

```bash
# スキルと導入先を対話で選ぶ
npx skills add microcmsio/skills

# エージェントを指定する
npx skills add microcmsio/skills --skill microcms-docs --agent claude-code
npx skills add microcmsio/skills --skill microcms-docs --agent cursor
npx skills add microcmsio/skills --skill microcms-docs --agent codex

# 複数のエージェントに一括で入れる
npx skills add microcmsio/skills --skill microcms-docs \
  --agent claude-code --agent cursor --agent codex

# 一覧・更新
npx skills add microcmsio/skills --list
npx skills update
```

### gh skill（GitHub CLI v2.90.0+）

```bash
gh skill install microcmsio/skills microcms-docs --agent claude-code --scope user
gh skill install microcmsio/skills microcms-docs --agent cursor
gh skill install microcmsio/skills --all --agent codex

gh skill list
gh skill update --all
```

`--scope` は `project`（既定、リポジトリ内）または `user`（ホーム配下、全プロジェクト共通）です。

### Claude Code（プラグインとして）

```
/plugin marketplace add microcmsio/skills
/plugin install microcms@microcms
```

**API キーは聞かれません。** MCP サーバーを同梱していないため、インストールはスキルのコピーだけで完了します。

### 手動コピー

```bash
git clone --depth 1 https://github.com/microcmsio/skills.git
bash skills/scripts/install.sh              # ./.agents/skills/ に導入
bash skills/scripts/install.sh --global     # ~/.agents/skills/ に導入
```

`.agents/skills/` は Cursor / Codex などが読む、事実上のクロスツール共通パスです。

---

## 使い方

インストール後は、**普通に質問するだけ**です。スキルを呼び出す操作は要りません。

> microCMS でカテゴリ別に記事を 10 件取得したい

明示的に呼び出したい場合は、Claude Code では `/microcms-docs` と入力します。

> [!TIP]
> Claude Code では、導入後に `/reload-skills` を実行するとセッションを再起動せずに読み込まれます。

---

## リポジトリ構成

```
skills/                        # スキルの正本。すべてのツールの入口
└── microcms-docs/
    ├── SKILL.md               # スキル本体（ワークフロー・注意事項）
    └── references/
        └── urls.md            # ドキュメント URL 一覧（カテゴリ別）
.claude-plugin/                # Claude Code プラグイン定義
├── plugin.json
└── marketplace.json
scripts/                       # install.sh / validate.sh
docs/                          # CONTRIBUTING.md / skill-template/
```

---

## 公式 MCP サーバーとの併用

microCMS 公式が 2 つの MCP サーバーを提供しています。

| MCP サーバー | 用途 |
|------------|------|
| [`microcms-mcp-server`](https://document.microcms.io/mcp-server/microcms-mcp-server) | コンテンツの入稿・更新・削除などの操作 |
| [`microcms-document-mcp-server`](https://document.microcms.io/mcp-server/microcms-document-mcp-server) | このスキルと同様のドキュメント参照 |

コンテンツの入稿・管理を行いたい場合は `microcms-mcp-server` を併用してください。
`microcms-document-mcp-server` はこのスキルと役割は同じですが、MCP での利用が好ましい場合はそちらをお使いください。

なお、**このリポジトリのスキル／プラグインに MCP サーバーは同梱していません。** MCP を使う場合は
各サーバーのドキュメントに従って別途設定してください。

---

## コントリビュート

スキルの追加手順とチェックリストは [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) を参照してください。

```bash
bash scripts/validate.sh     # 規格・発見可能性・プラグイン定義の検証
claude --plugin-dir .        # ローカルでプラグインとして読み込んで動作確認
```

## ライセンス

[MIT](LICENSE)
