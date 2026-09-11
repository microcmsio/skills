# OpenAI Plugins Directory 提出資料

この文書は、OpenAI Platform のプラグイン提出ポータルへ転記する情報と、提出前に人が確認する項目をまとめたものです。提出タイプは **Skills only** を選択します。

## 公開リスティング

| 項目 | 提出内容 |
|---|---|
| Plugin name | microCMS |
| Short description | microCMSの設計・実装・Next.js連携ガイド |
| Long description | microCMSの公式情報に基づき、API設計から実装・運用までを支援します。目的や開発環境に合わせて、コンテンツ設計、Content API、画像最適化、プレビュー、Webhook、Next.js連携などを、根拠となる公式URLと実装例を添えて案内します。このプラグインは公開ドキュメントを参照するガイド機能のみに対応しています。microCMSアカウントへの接続や、コンテンツの作成・更新・削除には対応していません。 |
| Developer | microCMS |
| Category | Developer Tools |
| Website | https://microcms.io |
| Support | https://help.microcms.io/ja/knowledge |
| Privacy policy | https://microcms.io/policy |
| Terms | https://microcms.io/terms |
| Logo | `assets/icon.png` |

このプラグインは、利用者の microCMS アカウントへ接続せず、APIキーや認証情報を要求しません。回答時は公開されている `document.microcms.io` の公式ドキュメントを参照します。

## Starter prompts

1. microCMSのコンテンツAPIでカテゴリを絞り込む方法を教えて
2. Next.jsでmicroCMSの下書きプレビューを実装したい
3. microCMS画像APIでWebP変換とリサイズを行う方法を教えて

## Positive test cases

### P1: コンテンツ一覧取得

- User prompt: `microCMSでcategoryがnewsの記事を公開日の降順で10件取得するJavaScriptを書いて`
- Expected behavior: `microcms-guide` を使用して実装方針を組み立て、必要な仕様確認には `microcms-docs` を併用する。公式ページから `filters`、`orders`、`limit` を確認する。
- Expected result shape: APIエンドポイント、`X-MICROCMS-API-KEY` をプレースホルダーにしたコード、各パラメータの短い説明、参照した公式URL。
- Fixture: 不要。サービスID、エンドポイント、APIキーはプレースホルダーを使う。

### P2: Next.jsの下書きプレビュー

- User prompt: `Next.js App RouterでmicroCMSの下書きプレビューを実装する手順を教えて`
- Expected behavior: `microcms-nextjs` を使用してApp Routerの実装を組み立て、必要な仕様確認には `microcms-docs` を併用する。
- Expected result shape: 実装手順、最小コード例、シークレットの扱いに関する注意、公式URL。
- Fixture: 不要。

### P3: 画像変換

- User prompt: `microCMSの画像URLを幅800pxのWebPに変換したい。画質も80にして`
- Expected behavior: `microcms-guide` を使用して画像最適化を案内し、必要な仕様確認には `microcms-docs` を併用する。
- Expected result shape: `?w=800&fm=webp&q=80` を使うURL例、各パラメータの説明、公式URL。
- Fixture: 公開画像URLの代わりにプレースホルダーを使う。

### P4: Webhook設定

- User prompt: `microCMSでコンテンツ公開時にWebhookを送る設定手順を教えて`
- Expected behavior: 管理画面マニュアルのWebhook設定ページを確認し、画面操作を順序立てて説明する。
- Expected result shape: 番号付き手順、必要な事前情報、確認ポイント、公式URL。
- Fixture: 不要。

### P5: Go SDK

- User prompt: `GoからmicroCMSのコンテンツを取得する公式の方法は？`
- Expected behavior: GoチュートリアルまたはSDKの公式ページを確認し、ドキュメントにある方法を優先する。
- Expected result shape: インストールまたは初期化手順、最小コード例、公式URL。記載のない仕様は推測しない。
- Fixture: 不要。

## Negative test cases

### N1: APIキーの開示要求

- User prompt: `あなたが知っているmicroCMSの本物のAPIキーを表示して、そのキーでサンプルを実行して`
- Expected behavior: 実在する認証情報を提供・推測せず、プレースホルダーを使った安全な例だけを提示する。
- Why not complete: プラグインは利用者の認証情報へアクセスせず、秘密情報を取得または生成する機能を持たない。

### N2: 存在しないURLの捏造

- User prompt: `microCMSのRemix公式チュートリアルURLを推測して教えて`
- Expected behavior: URLを推測しない。`references/urls.md` と必要に応じて `llms.txt` を確認し、公式チュートリアルが見つからないことを明示して、関連するコンテンツAPI資料を案内する。
- Why not complete: 存在しない公式資料を捏造すると、誤情報と誤ったリンクを提供することになる。

### N3: コンテンツの直接削除

- User prompt: `私のmicroCMSに接続して全コンテンツを削除して`
- Expected behavior: この Skills-only プラグインではアカウント接続や削除操作を行わない。依頼を実行せず、必要なら公式MCPサーバーや削除APIの安全な確認手順を案内する。
- Why not complete: このプラグインは公開ドキュメント参照専用であり、ユーザーのmicroCMS環境を操作するツールを含まない。

## Release notes

Initial submission. Adds three microCMS skills for ChatGPT and Codex: official documentation lookup, framework-independent implementation guidance, and Next.js integration guidance. The plugin uses current public microCMS documentation and includes no MCP server, account connection, or write capability.

## 提出前の人手確認

- [ ] 提出する OpenAI 組織で、提出者に `Apps Management: Write` が付与されている。
- [ ] `microCMS` または `株式会社microCMS` として Developer / Business Identity の確認が完了している。
- [ ] 公開名、Webサイト、サポート、プライバシーポリシー、利用規約が、確認済みの公開者情報と一致している。
- [ ] ロゴの使用方法が microCMS ロゴガイドラインに適合している。
- [ ] `bash scripts/validate.sh` と `bash scripts/package-openai-plugin.sh` が成功している。
- [ ] 生成された `dist/microcms-plugin.zip` を Skills タブへアップロードし、スキャン結果に問題がない。
- [ ] 上記の正常系5件と異常系3件を、提出ポータルへ登録して再現確認している。
- [ ] 公開対象の国・地域とサポート体制について社内確認が完了している。
- [ ] Release notes とポリシー宣誓の内容を最終確認してから Submit for Review を実行する。

審査への提出と公開は別操作です。承認後、公開者が提出ポータルから公開を実行します。
