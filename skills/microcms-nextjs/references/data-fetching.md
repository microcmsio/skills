# microCMS + Next.js データ取得

最終確認: 2026-09-08

仕様の根拠は末尾の公式情報を参照する。設計上の推奨・コード例は本Skillの提案であり、唯一の公式推奨構成を意味しない。

## 目次

- [基本方針](#基本方針)
- [一覧を取得する](#一覧を取得する)
- [詳細を取得する](#詳細を取得する)
- [Dynamic Routes](#dynamic-routes)
- [generateStaticParamsを使う](#generatestaticparamsを使う)
- [全件生成しない選択](#全件生成しない選択)
- [ページネーション](#ページネーション)
- [クエリを組み立てる](#クエリを組み立てる)
- [404とエラーを区別する](#404とエラーを区別する)
- [重複取得を避ける](#重複取得を避ける)
- [Client Componentが必要なケース](#client-componentが必要なケース)
- [大量ページのビルドで429になる場合](#大量ページのビルドで429になる場合)

- [公式情報](#公式情報)

## 基本方針

App Routerでは、microCMSデータをServer Componentから取得する方法を基本にする。

取得方法は次の3点を分けて考える。

1. 何を取得するか: 一覧 / 詳細 / オブジェクト
2. いつ取得するか: build / request / revalidation
3. どこまでキャッシュするか

このファイルでは主に「何を取得するか」を扱う。キャッシュは `caching.md` で決める。以下のページ例をCache Components有効のプロジェクトへ組み込む場合、公開データを `use cache` で囲むか、未キャッシュの取得を行う子コンポーネントを `<Suspense>` 配下に置く。

## 一覧を取得する

```ts
import { client } from '@/lib/microcms'
import type { Article } from '@/types/article'

export async function getArticles() {
  return client.getList<Article>({
    endpoint: 'articles',
    queries: {
      orders: '-publishedAt',
      limit: 20,
    },
  })
}
```

ページ側:

```tsx
export default async function Page() {
  const data = await getArticles()

  return (
    <main>
      {data.contents.map((article) => (
        <article key={article.id}>
          <h2>{article.title}</h2>
        </article>
      ))}
    </main>
  )
}
```

一覧で本文が不要なら `fields` を使う。

```ts
queries: {
  fields: ['id', 'title', 'eyecatch', 'publishedAt'],
}
```

表示に使わない大きなフィールドを毎回取得しない。

## 詳細を取得する

```ts
export async function getArticle(id: string) {
  return client.getListDetail<Article>({
    endpoint: 'articles',
    contentId: id,
  })
}
```

コンテンツIDをURLとして使えるなら、そのままDynamic Segmentに利用できる。

slugフィールドを別に設けている場合は、`filters` で検索する方法もある。ただし「詳細1件取得のために毎回一覧検索する」設計になるため、コンテンツIDをURLに使える要件なら `getListDetail` の方が単純。

## Dynamic Routes

Next.jsの現行App Routerでは `params` がPromiseとして扱われるバージョンがあるため、プロジェクトのNext.jsバージョンに合わせる。

Next.js 16系の例:

```tsx
import { notFound } from 'next/navigation'
import { isMicroCMSRequestError } from 'microcms-js-sdk'
import { client } from '@/lib/microcms'
import type { Article } from '@/types/article'

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const article = await client.getListDetail<Article>({
    endpoint: 'articles',
    contentId: id,
  }).catch((error: unknown) => {
    if (isMicroCMSRequestError(error) && error.status === 404) {
      notFound()
    }
    throw error
  })

  return <article>{article.title}</article>
}
```

この例は `isMicroCMSRequestError` をexportするSDKが前提。導入済みバージョンのexport・型を確認する。401・403・429・5xx・通信障害は再throwし、Next.jsのエラー処理へ渡す。404が続く場合はエンドポイント名の誤りも確認する。

## generateStaticParamsを使う

ビルド時に静的生成したいDynamic Routesでは `generateStaticParams` を使える。

```ts
export async function generateStaticParams() {
  const ids = await client.getAllContentIds({
    endpoint: 'articles',
  })

  return ids.map((id) => ({ id }))
}
```

利用前に次を確認する。

- コンテンツ件数は何件か。
- 全件を毎ビルド生成する必要があるか。
- ビルド時間は許容できるか。
- 新規コンテンツをビルドなしで生成したいか。

数千・数万ページを無条件に全件 `generateStaticParams` へ渡すことをデフォルトにしない。

`generateStaticParams` はISRの再検証時には再実行されない。新規IDの表示には未生成パスを扱える構成が必要で、従来モデルの `dynamicParams = false` は未生成パスを404にする。Cache Components有効時にこの関数を定義する場合は1件以上を返す必要があり、空のCMSから返る `[]` でビルドが失敗しうる。架空のIDで隠す前に、事前生成が必要かを判断する。

## 全件生成しない選択

大量コンテンツでは、ビルド時に一部だけ生成し、残りはアクセス時に生成する方が適する場合がある。

Next.jsのキャッシュモデル・`dynamicParams`・Cache Componentsの有無によって具体的な挙動が異なるため、`caching.md` と現在のNext.js公式仕様を確認する。

判断基準:

- アクセスの大半が上位100記事に偏る → 上位だけ事前生成を検討
- すべてのページに同程度のアクセス → 全件生成も検討
- ビルド時間が長い → 事前生成数を減らす
- 初回アクセスの遅延を絶対避けたい → 事前生成範囲を広げる

## ページネーション

microCMSの `limit` / `offset` を使う。

```ts
const PER_PAGE = 20

export async function getArticles(page: number) {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError('page must be a positive safe integer')
  }
  const offset = (page - 1) * PER_PAGE
  if (!Number.isSafeInteger(offset)) {
    throw new RangeError('offset exceeds the safe integer range')
  }

  return client.getList<Article>({
    endpoint: 'articles',
    queries: {
      limit: PER_PAGE,
      offset,
      orders: '-publishedAt',
    },
  })
}
```

ページ数:

```ts
const totalPages = Math.ceil(data.totalCount / PER_PAGE)
```

すべてのコンテンツを取得してフロントエンドでsliceする方法は、件数が少ない特別なケース以外では避ける。

## クエリを組み立てる

ユーザー入力を `filters` 文字列へ直接連結しない。検索・カテゴリ等の要件に応じて許可する条件を明確にする。

例:

```ts
export async function getArticlesByCategory(categoryId: string) {
  // この例で扱うコンテンツIDの許可文字。既存APIのIDも確認する。
  if (!/^[A-Za-z0-9_-]+$/.test(categoryId)) {
    throw new Error('Invalid category ID')
  }
  return client.getList<Article>({
    endpoint: 'articles',
    queries: {
      filters: `category[equals]${categoryId}`,
      fields: ['id', 'title', 'publishedAt'],
    },
  })
}
```

microCMSの `filters` には値をエスケープする仕様がない。URLエンコードしても、復号後の値に含まれるフィルター構文を無効化できない。IDは許可文字で検証し、自由文検索なら `q` など要件に適した方法を選ぶ。

複雑なクエリをページコンポーネント内へ散在させず、再利用される取得条件はデータ取得関数へまとめる。

## 404とエラーを区別する

microCMS APIの失敗はすべて404ではない。

区別する例:

- 404: 対象コンテンツが存在しない → `notFound()` 候補
- 401 / 403: APIキーや権限の問題 → 設定エラーとして扱う
- 429: レート制限等 → リトライ・取得量確認
- 5xx / ネットワーク: 一時障害 → 404にしない

`microcms-js-sdk` の `isMicroCMSRequestError` を使うと、`status` 等を確認できる。

詳細なSDKエラー仕様は `microcms-guide` の `js-sdk.md` を使う。

## 重複取得を避ける

App Routerでは、同じデータを複数コンポーネントから使うことがある。

まず以下を検討する。

- 親Server Componentで1回取得してpropsで渡す。
- 取得関数を共有する。
- Next.jsの現在のキャッシュ・メモ化機構を利用する。

ただし、古いNext.jsの「同一fetchは必ず自動memoizeされる」などの知識を無条件に前提としない。利用中バージョンの仕様を確認する。

## Client Componentが必要なケース

以下はClient Componentが適することがある。

- 入力中の検索候補を都度取得する。
- ユーザー操作に応じて追加データをロードする。
- ブラウザAPIと連動する。

それでもAPIキーをクライアントへ出したくない場合は、Route Handlerを介す。

一方、通常の記事一覧・詳細表示だけならServer Componentを優先する。

## 大量ページのビルドで429になる場合

ページ生成・全件取得・複数ワーカーの並列実行が重なっていないか確認し、事前生成数や取得の同時実行数を調整する。microCMS公式ヘルプのNext.js向け `experimental.cpus` や `staticGenerationMaxConcurrency` 等は、対応バージョンや実験的機能の条件を確認して使う。ヘルプの例を全Next.jsプロジェクトに追加するデフォルトにしない。[公式ヘルプ：429とビルド並列数](https://help.microcms.io/ja/knowledge/handling-429-errors)

## 公式情報

- [microCMS JavaScript SDK](https://github.com/microcmsio/microcms-js-sdk)
- [microCMSのクエリ仕様](https://document.microcms.io/content-api/get-list-contents)
- [コンテンツIDの設定](https://document.microcms.io/manual/content-id-setting)
- [generateStaticParams](https://nextjs.org/docs/app/api-reference/functions/generate-static-params)
- [Cache ComponentsとSuspense](https://nextjs.org/docs/messages/blocking-route)
