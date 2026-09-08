# microCMS + Next.js Draft Mode

最終確認: 2026-09-08

仕様の根拠は末尾の公式情報を参照する。設計上の推奨・コード例は本Skillの提案であり、唯一の公式推奨構成を意味しない。

## 目次

- [基本構成](#基本構成)
- [microCMS側の画面プレビューURL](#microcms側の画面プレビューurl)
- [プレビュー開始Route Handler](#プレビュー開始route-handler)
- [Draft Modeを確認して下書きを取得する](#draft-modeを確認して下書きを取得する)
- [Draft Keyを保持する方法を設計する](#draft-keyを保持する方法を設計する)
- [プレビューを終了する](#プレビューを終了する)
- [キャッシュとの関係](#キャッシュとの関係)
- [セキュリティ](#セキュリティ)
- [トラブルシューティング](#トラブルシューティング)
- [公式情報](#公式情報)

## 基本構成

Next.js App RouterではDraft Modeを使い、通常の公開ページと同じURLで下書きをプレビューする構成を第一候補にする。

```text
microCMS画面プレビュー
  ↓ contentId / draftKey / secret
/api/draft
  ↓ 検証
Next.js Draft Modeをenable
  ↓
/articles/{contentId}
  ↓
Draft Mode中だけdraftKey付きでmicroCMS取得
```

Next.js 15以降の `draftMode()` は非同期APIなので `await draftMode()` を使う。

## microCMS側の画面プレビューURL

例:

```text
https://example.com/api/draft?secret=YOUR_SECRET&contentId={CONTENT_ID}&draftKey={DRAFT_KEY}
```

`YOUR_SECRET` には推測されにくい値を使い、Next.js側でも同じ値を環境変数へ保持する。

例:

```bash
MICROCMS_PREVIEW_SECRET=xxxxxxxx
```

Draft Keyだけが存在すれば誰でもプレビューモードを開始できる、という設計にしない。

## プレビュー開始Route Handler

以下は下書きコンテンツ専用の最小例。公開済みコンテンツもプレビューする場合は、Draft Keyがない場合に通常のGETへ切り替える分岐を別途設計する。

```ts
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { isMicroCMSRequestError } from 'microcms-js-sdk'
import { client } from '@/lib/microcms'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const expectedSecret = process.env.MICROCMS_PREVIEW_SECRET
  const secret = searchParams.get('secret')
  const contentId = searchParams.get('contentId')
  const draftKey = searchParams.get('draftKey')

  if (
    !expectedSecret || secret !== expectedSecret ||
    !contentId || !/^[A-Za-z0-9_-]+$/.test(contentId) ||
    !draftKey
  ) {
    return new Response('Invalid preview request', { status: 401 })
  }

  // contentId / draftKey が本当に有効かを確認する。
  try {
    await client.getListDetail({
      endpoint: 'articles',
      contentId,
      queries: { draftKey },
      customRequestInit: { cache: 'no-store' },
    })
  } catch (error) {
    if (isMicroCMSRequestError(error) && error.status === 404) {
      return new Response('Invalid content', { status: 404 })
    }
    // 認証設定や通信障害を「無効なコンテンツ」として隠さない。
    throw error
  }

  const draft = await draftMode()
  draft.enable()

  // draftKeyの引き継ぎ方法は下のセクションで決める。
  redirect(`/articles/${encodeURIComponent(contentId)}?draftKey=${encodeURIComponent(draftKey)}`)
}
```

上は仕組みを示す最小例。実際にはDraft KeyをURLへ残し続けるか、HttpOnly Cookieやサーバー側セッションで引き継ぐかをセキュリティ要件に合わせて選ぶ。

リダイレクト先をURLクエリからそのまま受け取り、任意の外部URLへredirectできる実装は避ける。

## Draft Modeを確認して下書きを取得する

ページでDraft Modeの状態を確認する。

```tsx
import { Suspense } from 'react'
import { draftMode } from 'next/headers'
import { client } from '@/lib/microcms'
import type { Article } from '@/types/article'

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ draftKey?: string | string[] }>
}

export default function Page(props: PageProps) {
  return (
    <Suspense fallback={<p>読み込み中...</p>}>
      <ArticleContent {...props} />
    </Suspense>
  )
}

async function ArticleContent({ params, searchParams }: PageProps) {
  const { id } = await params
  const { isEnabled } = await draftMode()
  const draftKey = isEnabled ? (await searchParams).draftKey : undefined

  if (isEnabled && (typeof draftKey !== 'string' || !draftKey)) {
    return <p>管理画面から対象記事のプレビューを開き直してください。</p>
  }

  const article = await client.getListDetail<Article>({
    endpoint: 'articles',
    contentId: id,
    queries: isEnabled && typeof draftKey === 'string' ? { draftKey } : undefined,
    customRequestInit: { cache: 'no-store' },
  })

  return <article>{article.title}</article>
}
```

公開アクセスではDraft Keyを使用しない。この例はプレビュー分岐の確認用として公開取得も `no-store` にしている。実サイトの公開分岐は `caching.md` の取得関数へ接続する。404の扱いは `data-fetching.md` の例を適用する。

プレビュー時は編集直後の状態を見ることが目的なので、公開用の長時間キャッシュをそのまま使わない。

## Draft Keyを保持する方法を設計する

Draft ModeのCookie自体は「Draft Modeが有効か」を示すが、microCMSのどの下書きを取得するかに必要なDraft Keyは別途扱う必要がある。

代表的な方法:

### URLクエリで渡す

実装が単純。

```text
/articles/abc123?draftKey=xxxxx
```

注意:

- URL履歴やログへ残りやすい。
- 外部リンクや解析ツールへの漏えいを考慮する。

### HttpOnly Cookieで引き継ぐ

Draft KeyをページURLへ残し続けたくない場合に検討する。

Cookieはブラウザに保存される。HttpOnlyはJavaScriptからの読み取りを防ぐ属性であり、サーバー側ストレージに保存することとは異なる。HTTPSでの `Secure`、適切な `SameSite`・Path・有効期限を設定し、コンテンツIDとDraft Keyを対応づける。複数タブで別記事を開いた場合の上書きや、プレビュー終了時の削除も扱う。

### 一時トークンへ置き換える

より厳格なセキュリティが必要なら、Draft Keyをサーバー側ストレージへ保存し、一時トークンだけをブラウザへ渡す設計も可能。

小規模なプレビュー機能へ過度なセッション基盤を作らない。要求される機密性に合わせる。

## プレビューを終了する

Route HandlerでDraft Modeをdisableする。

```ts
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

export async function GET() {
  const draft = await draftMode()
  draft.disable()
  redirect('/')
}
```

`<Link>` からDraft Mode終了URLへ遷移させる場合、Next.jsのprefetchによって意図せずCookie削除処理が実行されないよう `prefetch={false}` を使う。

```tsx
<Link href="/api/disable-draft" prefetch={false}>
  プレビューを終了
</Link>
```

## キャッシュとの関係

Draft Modeは、静的に生成される公開ページで下書きを動的に確認するために利用できる。

現行の `use cache` 仕様では、Draft Mode中はキャッシュ対象の関数・コンポーネントが毎リクエスト実行され、結果はキャッシュに保存されない。`no-store` だけが解決方法ではない。`cookies()` / `searchParams` からDraft Keyを読む部分はキャッシュ境界の外に置く。Next.js以外の共有キャッシュまで自動で無効化されるとは考えない。

実装原則:

- 公開表示とプレビュー表示のキャッシュを同一視しない。
- Draft Key付きレスポンスを公開キャッシュへ混ぜない。
- プレビューでは `no-store` 相当を明示するなど、下書きの最新状態を確認できる構成にする。
- Draft Modeが無効なら通常の公開キャッシュ戦略へ戻す。

## セキュリティ

最低限確認する。

- `MICROCMS_PREVIEW_SECRET` を用意しているか。
- secretをクライアントコードへ埋めていないか。
- Draft Keyをログへ出していないか。
- APIキーをサーバー側で管理しているか。
- リダイレクト先を固定・検証しているか。
- `contentId` が想定するAPIのコンテンツか、取得して検証しているか。
- Draft Mode終了手段を用意しているか。

エラーログにリクエストURL全体を出力する場合、Draft Keyが含まれていないか確認する。

microCMS標準メディアの画像・ファイルはアップロード時からURLでアクセスできる。Draft Modeの認証で、下書き記事から参照するメディアURLまで保護されるとは考えない。機密メディアは別のアクセス制御が必要。[公式ヘルプ](https://help.microcms.io/ja/knowledge/file-view-restrictions)

## トラブルシューティング

### Draft Modeが有効にならない

- `await draftMode()` を使っているか。
- Route Handlerから `enable()` しているか。
- ブラウザがCookieを受け入れているか。
- redirect前にレスポンスが確定していないか。

### 公開内容しか表示されない

- `isEnabled` がtrueか。
- Draft KeyをmicroCMSの `queries` に渡しているか。
- 公開用キャッシュをそのまま返していないか。

### 下書きページだけ404になる

- `generateStaticParams` に公開済みIDしか含まれていなくても、未知のDynamic Routeを処理できる設定か。
- Draft Mode時に対象IDを動的取得できるか。
- `contentId` / Draft Keyの組み合わせが有効か。

### プレビュー終了後も状態が残る

- disable Route Handlerが呼ばれているか。
- `<Link>` のprefetchを無効にしているか。
- 独自CookieでDraft Keyを保持している場合、そのCookieも削除しているか。

## 公式情報

- [microCMSの画面プレビュー](https://document.microcms.io/manual/screen-preview)
- [Next.js Draft Mode](https://nextjs.org/docs/app/guides/draft-mode)
- [draftMode API](https://nextjs.org/docs/app/api-reference/functions/draft-mode)
- [use cacheのDraft Mode時の挙動](https://nextjs.org/docs/app/api-reference/directives/use-cache)
- [Cache ComponentsとSuspense](https://nextjs.org/docs/messages/blocking-route)
