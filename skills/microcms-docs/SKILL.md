---
name: microcms-docs
description: microCMSの公式開発者ドキュメント(document.microcms.io)を参照し、API仕様の解説・コード例の生成・操作手順の回答を行う。コンテンツAPI、マネジメントAPI、画像API、管理画面マニュアル、Next.js/Nuxt/Astro/Remix/Gatsby/JavaScript/PHP/Ruby/Go/iOS/Android などのフレームワークチュートリアルを扱う。microCMSのAPIキー認証、クエリパラメータ(filters/fields/limit/orders)、Webhook、フィールドタイプ設定、画像変換、SDK利用方法、エラーレスポンスなどに関する質問で使用する。
license: MIT
---

# microCMS ドキュメント参照スキル

## 概要

microCMS公式開発者ドキュメント `document.microcms.io` に対し、ユーザーの質問に応じた適切なページを特定し、Web取得ツールで内容を取得して回答する。記憶や推測ではなく、常に最新のドキュメントを根拠とする。

## ワークフロー

### 1. 質問の分類

ユーザーの質問が次のどのカテゴリに該当するかを判断する:

| カテゴリ | 想定される質問 |
|---------|-------------|
| コンテンツAPI | データ取得/登録、クエリパラメータ、APIキー、エラー対応 |
| マネジメントAPI | コンテンツの管理操作、メディア操作、メンバー取得 |
| 画像API | リサイズ、フォーマット変換、ウォーターマーク |
| 操作マニュアル | 管理画面の使い方、フィールド設定、Webhook設定、権限 |
| チュートリアル | Next.js/Nuxt/Astro等のフレームワーク統合 |
| SDK | 各言語SDKの使い方、コード例 |

複数カテゴリにまたがる場合（例: 「Next.jsで下書きプレビューを実装する」）は、関連する全カテゴリのURLを参照する。

### 2. URLの特定

`references/urls.md` を読み、関連URLを特定する。**URLを推測で生成してはならない**。`urls.md` に該当ページが無い場合は、最も近いインデックスページ（例: `/tutorial/next/` のトップ）を取得して配下のページ一覧を確認する。

### 3. ドキュメントの取得

特定したURLの**末尾に `.md` を付与して取得する**。取得には、利用中のエージェントが持つWeb取得の手段（Web取得ツール、`curl` など）を使う。`.md` 付きでアクセスすると `text/markdown` 形式で本文が返るため、HTMLパース不要でLLMが扱いやすい。

例:
- HTML版: `https://document.microcms.io/content-api/get-list-contents`
- **Markdown版（こちらを使う）**: `https://document.microcms.io/content-api/get-list-contents.md`

複数URLが必要な場合は、可能な限り**まとめて取得する**（並列取得に対応した環境では並列で取得する）。

取得時は、そのページから何を読み取りたいのかを明確にしてから読む:
- コード例が欲しい場合: コード例（特に該当箇所）を抽出する
- 仕様確認: パラメータ仕様、デフォルト値、必須/任意を一覧化する
- 手順確認: 目的の操作を行うための手順を順番に抽出する

### 4. 回答の生成

取得した内容に基づいて回答する。以下を遵守する:

- **出典URL を必ず明示する**（複数あれば全て）
- **コード例はドキュメントの内容に基づき**、不足部分のみ補完する
- ドキュメントに記載がない事項は「ドキュメントに明示されていない」と明確に伝える
- 古い情報（例: 旧APIキー方式）と新しい情報（`X-MICROCMS-API-KEY`）が混在する場合は、新しい方を推奨し旧方式の存在に触れる

## 重要な注意事項

1. **URLは必ず `references/urls.md` から確認**。`/manual/foo` のようなパスを記憶や類推で組み立てない。
2. **取得時はURL末尾に `.md` を付与する**。Markdown形式で本文が返り、HTML版より精度・効率が向上する。
3. **ベースURLは `https://document.microcms.io`**。`docs.microcms.io` や `microcms.com/docs` 等の類似URLは存在しない（誤記の可能性）。
4. **APIエンドポイント**: コンテンツAPIは `https://{service-id}.microcms.io/api/v1/{endpoint}`、マネジメントAPIは `https://{service-id}.microcms-management.io/api/v1/`。
5. **認証**: 現行は `X-MICROCMS-API-KEY` ヘッダー。旧 `X-API-KEY` は非推奨。
6. **言語**: ドキュメントは日本語版が主。英語版が必要な場合のみ `/en/` パスを試す。

## ユーザーへの確認

以下のような場面ではユーザーに確認し、判断を仰ぐ:

- 質問が曖昧で複数のカテゴリに該当しうる場合（例: 「画像を扱いたい」→ 画像API or 画像フィールド or メディア管理？）
- 利用フレームワーク/SDKが特定できず、複数のチュートリアルから選ぶ必要がある場合
- 提示する情報量や形式に選択肢がある場合（コード例のみ／詳細解説込みなど）

## リソース

- `references/urls.md`: ドキュメント全URL一覧（カテゴリ別、簡易説明付き）

## 関連

公式が `microcms-document-mcp-server` を提供している（`/mcp-server/microcms-document-mcp-server`）。利用可能な環境では併用するとさらに効率的。
