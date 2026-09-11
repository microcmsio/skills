# microCMS Agent Skills / Plugin

microCMS 公式の [Agent Skills](https://agentskills.io) です。Claude Code / Cursor / Codex など、
Agent Skills 規格に対応した 40 以上の AI エージェントで動作します。

3つのスキルを、ChatGPT と Codex 共通の Skills-only プラグインとしても配布できる構成です。

インストールすると、AIがmicroCMSに関するAgent Skillsを使ってタスクを実行したり、質問に回答したりするようになります。

## スキル一覧

| スキル名 | 説明 |
|---------|------|
| [`microcms-docs`](skills/microcms-docs/) | 公式開発者ドキュメントから、API仕様・制限・管理画面の操作手順などの最新情報と出典を確認する |
| [`microcms-guide`](skills/microcms-guide/) | フレームワークに依存しない設計・実装・改善を支援する。コンテンツモデリング、SDK、画像、検索、プレビュー、Webhook、パフォーマンスを扱う |
| [`microcms-nextjs`](skills/microcms-nextjs/) | Next.jsとの連携を実装・改善する。App Routerのデータ取得、キャッシュ・ISR、Draft Mode、画像最適化を扱う |

仕様や操作方法の確認には `microcms-docs`、設計・実装の相談には `microcms-guide`、Next.js固有の実装には `microcms-nextjs` を使います。実装中に仕様確認が必要になった場合は、利用可能な `microcms-docs` を併用できます。各Skillは単独でも利用できます。

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

# 設計・実装用のスキルを個別に導入する
npx skills add microcmsio/skills --skill microcms-guide --agent codex
npx skills add microcmsio/skills --skill microcms-nextjs --agent codex

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

### ChatGPT / Codex（プラグインとして）

リポジトリ直下の [`plugin.json`](plugin.json) は Agent Plugins 形式のポータブルマニフェストです。
ローカルテストでは、このリポジトリをマーケットプレイスとして追加した後、ChatGPT デスクトップアプリの Plugins Directory から `microCMS` をインストールします。

```bash
codex plugin marketplace add microcmsio/skills
codex plugin add microcms@microcms
```

3つのスキルを含む公開提出用プラグインZIPは、次のコマンドで生成できます。

```bash
bash scripts/package-openai-plugin.sh
```

OpenAI Platform への提出内容と提出前チェックは [`docs/openai-plugin-submission.md`](docs/openai-plugin-submission.md) にまとめています。

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
依頼に応じたSkillが選択されます。選択方法は利用するエージェントによって異なります。

| 依頼例 | 対応するSkill |
|--------|---------------|
| 「コンテンツAPIのlimitとdepthの仕様を、公式出典付きで確認したい」 | `microcms-docs` |
| 「ブログのカテゴリ・著者のコンテンツモデルを設計したい」 | `microcms-guide` |
| 「Next.jsでmicroCMSの更新をWebhookから反映したい」 | `microcms-nextjs` |

明示的に呼び出したい場合は、Claude Codeでは `/microcms-guide` のようにスキル名を入力します。

Skillの導入・資料参照自体にmicroCMSのAPIキーは不要です。実際のコンテンツ取得・更新を実行する場合は、対象サービスのAPIキーと必要な権限を用意してください。

---

## 公式 MCP サーバーとの併用

microCMS 公式が 2 つの MCP サーバーを提供しています。

| MCP サーバー | 用途 |
|------------|------|
| [`microcms-mcp-server`](https://document.microcms.io/mcp-server/microcms-mcp-server) | コンテンツの入稿・更新・削除などの操作 |
| [`microcms-document-mcp-server`](https://document.microcms.io/mcp-server/microcms-document-mcp-server) | 公式ドキュメント参照 |

コンテンツの入稿・管理を行いたい場合は `microcms-mcp-server` を併用してください。

---

## 開発・検証

各Skillは `skills/<skill-name>/SKILL.md` と、そのSkillで必要なreference・メタデータで構成します。新しいSkillを追加するときは、このREADMEの一覧と使い方も更新してください。

`scripts/install.sh` は `skills/` 配下をまとめて導入します。Claude Codeプラグインも標準の `skills/` ディレクトリを使用するため、Skillごとの登録リストはありません。

```bash
bash scripts/validate.sh
```

Node.js 24を使用し、CIと同じスクリプトで全Skillの規格と発見可能性を確認します。Claude Code CLIがある場合はプラグイン定義も検証し、対応するGitHub CLIが認証済みの場合は配布のdry-runも実行します。

---

## ライセンス

[MIT](LICENSE)
