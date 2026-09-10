# microCMS + Next.js セットアップ

最終確認: 2026-09-07

仕様の根拠は末尾の公式情報を参照する。設計上の推奨・コード例は本Skillの提案であり、唯一の公式推奨構成を意味しない。

## 目次

- [前提を確認する](#前提を確認する)
- [SDKを導入する](#sdkを導入する)
- [環境変数を設定する](#環境変数を設定する)
- [microCMSクライアントを作る](#microcmsクライアントを作る)
- [型を定義する](#型を定義する)
- [Server Componentから利用する](#server-componentから利用する)
- [Client ComponentへAPIキーを持ち込まない](#client-componentへapiキーを持ち込まない)
- [プロジェクト構成例](#プロジェクト構成例)
- [既存プロジェクトを更新する場合](#既存プロジェクトを更新する場合)
- [公式情報](#公式情報)

## 前提を確認する

セットアップを提案する前に、既存プロジェクトなら次を確認する。

- Next.jsバージョン
- App Router / Pages Router
- `microcms-js-sdk` がすでに導入されているか
- 既存のAPIクライアントがあるか
- 環境変数の命名規則
- TypeScriptかJavaScriptか

新規例ではApp Router + TypeScriptを基本とする。

## SDKを導入する

```bash
npm install microcms-js-sdk server-only
```

`microcms-js-sdk` v3系はNode.js 18以上を前提とする。SDKの最低要件だけでなくNext.jsの要件も満たすこと。Next.js 16はNode.js 20.9以上が必要で、Node.js 18では動作要件を満たさない。

Next.jsからmicroCMSへ単純なHTTP GETを1回行うだけならネイティブ `fetch` でも実装できるが、microCMSのクエリ・型・全件取得等を継続して扱うならSDKを第一候補にする。

すでにネイティブ `fetch` で統一されているプロジェクトへ、理由なくSDKを追加しない。

## 環境変数を設定する

例:

```bash
# .env.local
MICROCMS_SERVICE_DOMAIN=your-service
MICROCMS_API_KEY=xxxxxxxxxxxxxxxx
```

原則として `NEXT_PUBLIC_` プレフィックスを付けない。

`NEXT_PUBLIC_` を付けた値はクライアントバンドルから利用する前提になるため、APIキーをサーバー側だけで使いたい場合には不適切。

環境変数をGitへコミットしない。代わりに `.env.example` 等へキー名だけ記載する。

```bash
MICROCMS_SERVICE_DOMAIN=
MICROCMS_API_KEY=
```

## microCMSクライアントを作る

例:

```ts
// src/lib/microcms.ts
import 'server-only'
import { createClient } from 'microcms-js-sdk'

if (!process.env.MICROCMS_SERVICE_DOMAIN) {
  throw new Error('MICROCMS_SERVICE_DOMAIN is required')
}

if (!process.env.MICROCMS_API_KEY) {
  throw new Error('MICROCMS_API_KEY is required')
}

export const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: process.env.MICROCMS_API_KEY,
})
```

ポイント:

- `server-only` でClient Componentからの誤importをビルド時に検出する。既存プロジェクトでは導入済みか確認し、不足する場合だけ追加する。
- クライアント生成を各ページへ重複させない。
- `serviceDomain` には `https://` や `.microcms.io` を含めず、サービスドメイン部分を渡す。
- APIキーが未設定なら、曖昧な401エラーになる前に起動・ビルド時に分かる形にする。
- `retry` は必要性を確認して有効化する。SDKのリトライがすべての障害を解決するわけではない。

## 型を定義する

microCMSのフィールドに対応した型を定義する。

例:

```ts
import type { MicroCMSImage } from 'microcms-js-sdk'

export type Category = {
  name: string
}

export type Article = {
  title: string
  body: string
  eyecatch?: MicroCMSImage
  category?: Category | null
}
```

SDKの `getList<T>` や `getListDetail<T>` に渡す型は、microCMSが自動付与する `id` / `createdAt` 等を重複して書かなくてよい使い方ができる。

コンテンツ参照の空値は `null` になりうるため、`category?: Category` だけで表現しない。参照先のIDが必要なら `Category & MicroCMSContentId` などで明示する。SDKの共通フィールドの付与は、任意の入れ子の型まで自動で補完するものではない。`fields` / `depth` で取得内容を変えた場合は投影後の型に合わせる。

プロジェクト内ですでにAPI型の生成・共通型定義方針がある場合は、それを優先する。

## Server Componentから利用する

App Routerでは、ページやServer Componentから直接サーバー側で呼び出せる。

```tsx
import { client } from '@/lib/microcms'
import type { Article } from '@/types/article'

export default async function Page() {
  const data = await client.getList<Article>({
    endpoint: 'articles',
  })

  return (
    <main>
      {data.contents.map((article) => (
        <article key={article.id}>{article.title}</article>
      ))}
    </main>
  )
}
```

キャッシュをどうするかはこの例だけで決めない。`cacheComponents` の有無と更新要件を確認し、`caching.md` に従って明示的に設計する。

## Client ComponentへAPIキーを持ち込まない

インタラクティブなUIが必要だからといって、microCMSクライアントごとClient Componentへ移動しない。

推奨:

```text
Server Component
  └─ microCMSからデータ取得
       ↓ props
Client Component
  └─ UIの状態・イベントだけ担当
```

クライアントからリアルタイム検索等でContent APIを直接呼ぶ要件がある場合は、APIキーがブラウザから見えることを前提に、公開して問題ないAPI + 必要最低限のGET権限へ限定する。

秘匿が必要ならRoute Handler等のサーバー側境界を設ける。

## プロジェクト構成例

小〜中規模なら次のような構成で十分。

```text
src/
├─ app/
│  ├─ articles/
│  │  ├─ page.tsx
│  │  └─ [id]/page.tsx
│  └─ api/
│     ├─ draft/route.ts
│     └─ revalidate/route.ts
├─ lib/
│  └─ microcms.ts
└─ types/
   └─ article.ts
```

APIごとにラッパー関数が増えたら、`lib/microcms/` 以下へ分割してよい。

```text
lib/microcms/
├─ client.ts
├─ articles.ts
└─ categories.ts
```

最初からRepository層・Service層などを何段も設けない。プロジェクトの規模と既存パターンに合わせる。

## 既存プロジェクトを更新する場合

- 既存の `lib/microcms.ts` があるなら、新しいクライアントを作らず再利用する。
- 既存環境変数名を理由なく変更しない。
- 既存のSDKメジャーバージョンを無断で上げない。
- `pages/` を使っているだけでApp Routerへ移行しない。
- キャッシュ問題を解決するために、セットアップ全体を書き直さない。

必要な変更だけを行い、Next.jsのキャッシュやプレビューなど別責務は対応するリファレンスへ分ける。

## 公式情報

- [microCMS JavaScript SDK](https://github.com/microcmsio/microcms-js-sdk)
- [Next.jsの動作要件](https://nextjs.org/docs/app/getting-started/installation)
- [Server / Client Componentsとserver-only](https://nextjs.org/docs/app/getting-started/server-and-client-components)
- [microCMSのレスポンス形式と空値](https://document.microcms.io/content-api/get-api-field-responses)
- [APIキーと権限](https://document.microcms.io/content-api/x-microcms-api-key)
- [静的エクスポートの制約](https://nextjs.org/docs/app/guides/static-exports)
