
# microCMS ドキュメント URL リファレンス

ベースURL: `https://document.microcms.io`

ユーザーの質問内容から該当セクションを特定し、対応するURLを取得する。複数URLが関連する場合はまとめて取得すること。

この一覧に該当ページが無い場合、または取得結果がMarkdownでなかった場合は、公式のページ一覧 `https://document.microcms.io/llms.txt`（約13KB）を取得して探す。全ページのタイトルとMarkdown版URLが列挙されている。
なお `https://document.microcms.io/llms-full.txt` は全文を結合した750KB以上のファイルのため、取得してはならない。

## 重要: `.md` サフィックスでMarkdownを取得する

このサイトは、**URL末尾に `.md` を付与するとMarkdown形式で本文を返す**（`Content-Type: text/markdown`）。取得時はこちらを使うこと。

- 使用しない: `https://document.microcms.io/content-api/get-list-contents`（HTML）
- 使用する: `https://document.microcms.io/content-api/get-list-contents.md`（Markdown）

以下に列挙するURLパスはすべて末尾に `.md` を付けて使用する。

英語版が必要な場合は、パスの先頭に `/en` を付ける（一部のみ対応）。

例: `https://document.microcms.io/en/content-api/introduction.md`

> [!IMPORTANT]
> 存在しないパスにアクセスしても 404 ではなく **200 で HTML が返る**ことがある。
> `Content-Type` が `text/markdown` でない場合、そのURLは無効と判断し、`llms.txt` から正しいURLを探し直すこと。
> 特に `/tutorial/next/` のようなセクションのトップURLは `.md` に対応しておらず、
> 本文を含まない HTML が返る。**以下に列挙した実ページのURLを使うこと。**

---

## 目次

1. [コンテンツAPI](#コンテンツapi) - データ取得・登録のREST API
2. [マネジメントAPI](#マネジメントapi) - 管理機能のREST API
3. [画像API](#画像api) - 画像変換パラメータ
4. [操作マニュアル](#操作マニュアル) - 管理画面の使い方
5. [チュートリアル](#チュートリアル) - フレームワーク別ガイド
6. [MCPサーバー](#mcpサーバー) - MCP関連
7. [SDK](#sdk) - 公式SDK情報

---

## コンテンツAPI

データ取得・登録のための公開API。`https://{service}.microcms.io/api/v1/{endpoint}` に対するリクエストを扱う。

| URL | 内容 |
|-----|------|
| `/content-api/introduction` | コンテンツAPI概要、認証、ベースURL |
| `/content-api/x-microcms-api-key` | APIキー認証 (`X-MICROCMS-API-KEY` ヘッダー) |
| `/content-api/from-oldapikey-to-x-microcms-apikey` | 旧APIキーからの移行 |
| `/content-api/get-list-contents` | コンテンツ一覧取得 (`GET /api/v1/{endpoint}`) |
| `/content-api/get-content` | コンテンツ単一取得 (`GET /api/v1/{endpoint}/{id}`) |
| `/content-api/post-content` | コンテンツ登録 (`POST /api/v1/{endpoint}`) |
| `/content-api/put-content` | コンテンツ完全更新 (`PUT`) |
| `/content-api/patch-content` | コンテンツ部分更新 (`PATCH`) |
| `/content-api/delete-content` | コンテンツ削除 (`DELETE`) |
| `/content-api/content-api-query` | クエリパラメータ (filters, fields, limit, offset, orders, q, depth, draftKey など) |
| `/content-api/get-api-field-responses` | フィールドタイプ別のレスポンス構造 |
| `/content-api/api-error-response` | エラーレスポンス仕様 |

### よく使うクエリパラメータ（早見表）
- `limit` / `offset`: ページネーション
- `orders`: ソート（`-publishedAt` などマイナスで降順）
- `fields`: 取得フィールドを絞り込み（カンマ区切り）
- `filters`: 絞り込み（例: `category[equals]news`、複数条件は `[and]` `[or]`）
- `q`: 全文検索
- `depth`: コンテンツ参照を展開する深さ（1〜3）
- `draftKey`: 下書き取得用キー
- `richEditorFormat`: リッチエディタの出力形式

---

## マネジメントAPI

サービスの管理・コンテンツ操作のためのAPI（ベータ含む）。`https://{service}.microcms-management.io/api/v1/` ベース。

| URL | 内容 |
|-----|------|
| `/management-api/introduction` | マネジメントAPI概要、認証 |
| `/management-api/get-service` | サービス情報取得 |
| `/management-api/get-members` | メンバー一覧取得 |
| `/management-api/get-member` | メンバー単一取得 |
| `/management-api/get-api-list` | API（コンテンツ）一覧取得 |
| `/management-api/get-api-info` | API情報取得 |
| `/management-api/get-list-contents-management` | コンテンツ一覧取得（管理用） |
| `/management-api/get-content` | コンテンツ取得（管理用） |
| `/management-api/patch-contents-status` | コンテンツ公開ステータス変更 |
| `/management-api/put-contents-reservation` | コンテンツの予約公開 |
| `/management-api/patch-contents-created-by` | コンテンツ作成者変更 |
| `/management-api/get-media-v2` | メディア一覧取得 (v2) |
| `/management-api/get-media-v1` | メディア一覧取得 (v1) |
| `/management-api/post-media` | メディアアップロード |
| `/management-api/delete-media-v2` | メディア削除 (v2) |
| `/management-api/management-api-error-response` | マネジメントAPIエラー仕様 |

---

## 画像API

メディアURLにクエリパラメータを付与して画像を変換する。例: `https://images.microcms-assets.io/...?w=400&fm=webp`

| URL | パラメータ | 内容 |
|-----|-----------|------|
| `/image-api/introduction` | - | 画像API概要 |
| `/image-api/size` | `w`, `h`, `fit`, `rect` | リサイズ・トリミング |
| `/image-api/quality` | `q` | 画質（0-100） |
| `/image-api/dpr` | `dpr` | デバイスピクセル比 |
| `/image-api/format` | `fm`, `auto` | フォーマット変換 (webp, jpg, png, avif など) |
| `/image-api/text` | `txt`, `txt-color`, `txt-size` | 画像にテキスト合成 |
| `/image-api/border` | `border`, `border-radius` | 枠線・角丸 |
| `/image-api/padding` | `pad` | パディング |
| `/image-api/mask` | `mask` | マスク処理 |
| `/image-api/download` | `dl` | ダウンロード強制 |
| `/image-api/watermark` | `mark`, `mark-w`, `mark-x`, `mark-y` | ウォーターマーク |

---

## 操作マニュアル

管理画面の使い方。`/manual/{page}` 形式。

### はじめに・アカウント
- `/manual/getting-started` - 始め方
- `/manual/signup` - サインアップ
- `/manual/signin` - サインイン
- `/manual/create-service` - サービス作成
- `/manual/change-plan-and-billing` - プラン変更・請求
- `/manual/payment-method` - 支払い方法

### サービス・API管理
- `/manual/service-settings` - サービス設定
- `/manual/create-api` - API作成
- `/manual/manage-members` - メンバー管理
- `/manual/api-model-settings` - APIモデル設定（リスト/オブジェクト）
- `/manual/export-and-import-api-schema` - スキーマのエクスポート/インポート

### フィールド設定
- `/manual/text-field` - テキストフィールド
- `/manual/textarea` - テキストエリア
- `/manual/image` - 画像
- `/manual/image-list` - 画像リスト（複数画像）
- `/manual/date` - 日時
- `/manual/boolean` - 真偽値
- `/manual/select-field` - セレクトフィールド
- `/manual/relation` - コンテンツ参照
- `/manual/relation-list` - 複数コンテンツ参照
- `/manual/number` - 数字
- `/manual/file` - ファイル
- `/manual/custom-field` - カスタムフィールド
- `/manual/repeat-field` - 繰り返しフィールド
- `/manual/field-extension` - フィールド拡張

### コンテンツ管理
- `/manual/create-content` - コンテンツ作成
- `/manual/edit-content` - コンテンツ編集
- `/manual/contents-management` - コンテンツ管理画面
- `/manual/contents-view` - コンテンツ表示
- `/manual/content-status` - 公開ステータス
- `/manual/custom-status` - カスタムステータス
- `/manual/content-id-setting` - コンテンツID設定
- `/manual/automatic-grant-fields` - 自動付与フィールド
- `/manual/content-history` - 履歴
- `/manual/csv-import` - CSVインポート
- `/manual/csv-export` - CSVエクスポート
- `/manual/api-preview` - APIプレビュー
- `/manual/query-parameters-sample-using-api-preview` - クエリパラメータのサンプル

### エディタ
- `/manual/rendering-methods` - レンダリング方法
- `/manual/rich-editor-usage` - リッチエディタの使い方
- `/manual/rich-editor-write-api` - リッチエディタ書き込みAPI
- `/manual/how-to-use-richeditor` - リッチエディタ詳細
- `/manual/screen-preview` - 画面プレビュー

### 権限・レビュー
- `/manual/roles` - 権限（ロール）
- `/manual/review` - レビュー機能
- `/manual/ai-review` - AIレビュー

### メディア管理
- `/manual/media-management` - メディア管理
- `/manual/media-filter` - メディアフィルター
- `/manual/media-tag-settings` - メディアタグ
- `/manual/medium-webhook-setting` - メディアWebhook

### セキュリティ・連携
- `/manual/environments` - 環境（本番・検証）
- `/manual/amazon-s3-integration` - S3連携
- `/manual/audit-log` - 監査ログ
- `/manual/ip-restriction` - 管理画面IP制限
- `/manual/api-ip-restriction` - API IP制限
- `/manual/webhook-setting` - Webhook設定
- `/manual/mfa-setting` - 多要素認証
- `/manual/mfa-need-setting` - 多要素認証必須化
- `/manual/saml-auth0` - SAML/Auth0
- `/manual/email-auth` - メール認証

### その他
- `/manual/data-amount` - データ容量
- `/manual/custom-domain` - カスタムドメイン
- `/manual/templates` - テンプレート
- `/manual/delete-service` - サービス削除
- `/manual/recommended-environment` - 推奨環境
- `/manual/limitations` - 制限事項

---

## チュートリアル

フレームワーク別の統合ガイド。**セクションのトップURL（`/tutorial/next/` など）は `.md` に対応していない**ため、
必ず以下の実ページURLを使用する。

### Next.js
- `/tutorial/next/next-top` - Next.jsとの連携（概要）
- `/tutorial/next/next-app-router-getting-started` - Getting Started（App Router）
- `/tutorial/next/next-app-router-tutorial` - チュートリアル（App Router）
- `/tutorial/next/next-getting-started` - Getting Started（Pages Router）
- `/tutorial/next/next-tutorial` - チュートリアル（Pages Router）

### Astro
- `/tutorial/astro/astro-top` - Astroとの連携（概要）
- `/tutorial/astro/astro-getting-started` - Getting Started
- `/tutorial/astro/astro-tutorial` - チュートリアル

### Nuxt 2
- `/tutorial/nuxt/nuxt-top` - Nuxt 2との連携（概要）
- `/tutorial/nuxt/nuxt-getting-started` - Getting Started
- `/tutorial/nuxt/nuxt-tutorial` - チュートリアル
- `/tutorial/nuxt/microcms-blog-clone` - microCMSブログのクローンを作る

### Gatsby
- `/tutorial/gatsby/gatsby-top` - Gatsbyとの連携（概要）
- `/tutorial/gatsby/gatsby-getting-started` - Getting Started
- `/tutorial/gatsby/gatsby-tutorial` - チュートリアル

### JavaScript
- `/tutorial/javascript/javascript-top` - JavaScriptとの連携（概要）
- `/tutorial/javascript/javascript-getting-started` - Getting Started（ブラウザ）
- `/tutorial/javascript/nodejs-getting-started` - Getting Started（サーバー / Node.js）

### PHP
- `/tutorial/php/php-top` - PHPとの連携（概要）
- `/tutorial/php/php-getting-started` - Getting Started

### Ruby
- `/tutorial/ruby/ruby-top` - Rubyとの連携（概要）
- `/tutorial/ruby/ruby-getting-started` - Getting Started

（`/tutorial/ruby/ruby-sdk` は `.md` 版が提供されていないため使用しない。SDKの情報は `ruby-top` に含まれる）

### Go
- `/tutorial/go/go-top` - Goとの連携（概要）
- `/tutorial/go/go-getting-started` - Getting Started
- `/tutorial/go/go-sdk` - SDK

> [!NOTE]
> チュートリアルが提供されているのは上記8種類のみ。
> Remix / Nuxt 3 / iOS / Android のチュートリアルページは**存在しない**。
> これらについて質問された場合は、ドキュメントに該当ページが無いことを伝えたうえで、
> 汎用的なコンテンツAPIの仕様（`/content-api/` 配下）や各SDKのリポジトリを案内する。

---

## MCPサーバー

- `/mcp-server/microcms-mcp-server` - microCMS本体のMCPサーバー
- `/mcp-server/microcms-document-mcp-server` - ドキュメントMCPサーバー（このスキルと同様の用途）

> 補足: microCMS公式が `microcms-document-mcp-server` を提供している。MCPを利用できる環境ではそちらが最新情報の参照に適する場合がある。

---

## SDK

主要言語の公式SDKは GitHub の `microcmsio` organization で公開されている。

| SDK | リポジトリ | ドキュメント内の使用例 |
|-----|-----------|------------------|
| JavaScript | `microcmsio/microcms-js-sdk` | `/tutorial/javascript/javascript-getting-started`, `/tutorial/next/next-app-router-getting-started` |
| PHP | `microcmsio/microcms-php-sdk` | `/tutorial/php/php-getting-started` |
| Ruby | `microcmsio/microcms-ruby-sdk` | `/tutorial/ruby/ruby-top` |
| Go | `microcmsio/microcms-go-sdk` | `/tutorial/go/go-sdk` |
| iOS | `microcmsio/microcms-ios-sdk` | ドキュメント内に無し（リポジトリのREADMEを参照） |
| Android | `microcmsio/microcms-android-sdk` | ドキュメント内に無し（リポジトリのREADMEを参照） |

JavaScript SDK のインストール: `npm install microcms-js-sdk`

SDKの具体的なAPIは、上記のチュートリアルページのコード例から確認すること。
iOS / Android はドキュメントサイトにチュートリアルが無いため、GitHubリポジトリを案内する。
