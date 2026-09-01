# microCMS Agent Skills

microCMS 公式の [Agent Skills](https://agentskills.io) です。Claude Code / Cursor / Codex など、
Agent Skills 規格に対応した 40 以上の AI エージェントで動作します。

インストールすると、AIがmicroCMSに関するAgent Skillsを使ってタスクを実行したり、質問に回答したりするようになります。

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

### 手動コピー

```bash
git clone --depth 1 https://github.com/microcmsio/skills.git
bash skills/scripts/install.sh              # ./.agents/skills/ に導入
bash skills/scripts/install.sh --global     # ~/.agents/skills/ に導入
```

スキル本体は `.agents/skills/`（Cursor / Codex などが直接読む場所）に置き、
Claude Code が読む `.claude/skills/` には相対シンボリックリンクを張ります。


---

## 使い方

インストール後は、**普通にAIと会話するだけ**でスキルを利用できます。
例えば以下のように入力すると、microcms-docsスキルが自動で発動します。

> microCMS でカテゴリ別に記事を 10 件取得したい

明示的に呼び出したい場合は、Claude Code では `/microcms-docs` のようにスキル名を入力します。

---

## 公式 MCP サーバーとの併用

microCMS 公式が 2 つの MCP サーバーを提供しています。

| MCP サーバー | 用途 |
|------------|------|
| [`microcms-mcp-server`](https://document.microcms.io/mcp-server/microcms-mcp-server) | コンテンツの入稿・更新・削除などの操作 |
| [`microcms-document-mcp-server`](https://document.microcms.io/mcp-server/microcms-document-mcp-server) | 公式ドキュメント参照 |

コンテンツの入稿・管理を行いたい場合は `microcms-mcp-server` を併用してください。

---

## ライセンス

[MIT](LICENSE)
