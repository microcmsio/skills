# microcms-agent-skills

microCMS 公式開発者ドキュメント（[document.microcms.io](https://document.microcms.io)）を参照し、API 仕様の解説・コード例の生成・操作手順の回答を行う Agent Skill です。

## スキル一覧

| スキル名 | 説明 |
|---------|------|
| `microcms-docs` | コンテンツ API、マネジメント API、画像 API、操作マニュアル、各種フレームワークチュートリアルに対応 |

### 構成ファイル

```
SKILL.md                  # スキル本体（ワークフロー・注意事項）
references/
  urls.md                 # ドキュメント URL 一覧（カテゴリ別）
```

---

## インストール

### Claude Code

プロジェクト単位で導入する場合はプロジェクトルートで、全プロジェクト共通にしたい場合はホームディレクトリで実行してください。

**プロジェクト単位（推奨）**

```bash
mkdir -p .claude/skills/microcms-docs/references
curl -o .claude/skills/microcms-docs/SKILL.md \
  https://raw.githubusercontent.com/microcmsio/microcms-agent-skills/main/SKILL.md
curl -o .claude/skills/microcms-docs/references/urls.md \
  https://raw.githubusercontent.com/microcmsio/microcms-agent-skills/main/references/urls.md
```

**全プロジェクト共通**

```bash
mkdir -p ~/.claude/skills/microcms-docs/references
curl -o ~/.claude/skills/microcms-docs/SKILL.md \
  https://raw.githubusercontent.com/microcmsio/microcms-agent-skills/main/SKILL.md
curl -o ~/.claude/skills/microcms-docs/references/urls.md \
  https://raw.githubusercontent.com/microcmsio/microcms-agent-skills/main/references/urls.md
```

導入後、「microCMS の API でコンテンツ一覧を取得する方法を教えて」のように聞くと、スキルが自動で発動してドキュメントを参照しながら回答します。

---

### Cursor / その他のエージェント

Cursor には Claude Code のようなスキル機構はありませんが、ファイルをリポジトリに配置してルールやコンテキストとして読み込ませることができます。

```bash
mkdir -p .cursor/rules/microcms-docs/references
curl -o .cursor/rules/microcms-docs/SKILL.md \
  https://raw.githubusercontent.com/microcmsio/microcms-agent-skills/main/SKILL.md
curl -o .cursor/rules/microcms-docs/references/urls.md \
  https://raw.githubusercontent.com/microcmsio/microcms-agent-skills/main/references/urls.md
```

エージェントへの指示例:

```
.cursor/rules/microcms-docs/SKILL.md と references/urls.md を参照しながら回答してください。
```

---

### 手動コピー（git clone）

```bash
git clone https://github.com/microcmsio/microcms-agent-skills.git
cp -r microcms-agent-skills/{SKILL.md,references} <導入先>/microcms-docs/
```

---

## 公式 MCP サーバーとの併用

microCMS 公式が 2 つの MCP サーバーを提供しています。

| MCP サーバー | 用途 |
|------------|------|
| [`microcms-mcp-server`](https://document.microcms.io/mcp-server/microcms-mcp-server) | コンテンツの入稿・更新・削除などの操作 |
| [`microcms-document-mcp-server`](https://document.microcms.io/mcp-server/microcms-document-mcp-server) | このスキルと同様のドキュメント参照 |

コンテンツの入稿・管理を行いたい場合は `microcms-mcp-server` を、MCP での利用が好ましい場合はこのスキルの代わりに `microcms-document-mcp-server` を利用してください。
