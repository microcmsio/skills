# microCMS + Next.js 画像最適化

最終確認: 2026-09-08

仕様の根拠は末尾の公式情報を参照する。設計上の推奨・コード例は本Skillの提案であり、唯一の公式推奨構成を意味しない。

## 目次

- [基本方針](#基本方針)
- [next/imageでmicroCMS画像を表示する](#nextimageでmicrocms画像を表示する)
- [remotePatternsを設定する](#remotepatternsを設定する)
- [widthとheightを使う](#widthとheightを使う)
- [sizesを適切に設定する](#sizesを適切に設定する)
- [microCMS画像APIとNext.js Image Optimizationを使い分ける](#microcms画像apiとnextjs-image-optimizationを使い分ける)
- [microCMS画像APIのcustom loader](#microcms画像apiのcustom-loader)
- [クエリ付き画像URLとremotePatterns](#クエリ付き画像urlとremotepatterns)
- [データ転送量を減らす](#データ転送量を減らす)
- [避けたい実装](#避けたい実装)
- [トラブルシューティング](#トラブルシューティング)
- [公式情報](#公式情報)

## 基本方針

Next.jsでmicroCMS画像を扱うときは、まず次のどちらが画像最適化の主体かを明確にする。

1. **Next.jsのImage Optimizationを利用する**
2. **microCMS画像APIを最適化サービスとして利用する**

理由なく両方でリサイズ・品質変換・フォーマット変換を重ねない。

microCMS画像API自体のパラメータ・フォーマット・転送量最適化の基本は `microcms-guide` の `image-api.md` を参照する。

## next/imageでmicroCMS画像を表示する

microCMSの画像レスポンスにはURLとwidth / heightが含まれるため、`next/image` へ渡しやすい。

```tsx
import Image from 'next/image'
import type { MicroCMSImage } from 'microcms-js-sdk'

export function Eyecatch({ image }: { image: MicroCMSImage }) {
  if (!image.width || !image.height) {
    return (
      <div style={{ position: 'relative', aspectRatio: '16 / 9' }}>
        <Image src={image.url} alt={image.alt ?? ''} fill
          sizes="(max-width: 768px) 100vw, 720px"
          style={{ objectFit: 'contain' }} />
      </div>
    )
  }
  return (
    <Image
      src={image.url}
      alt={image.alt ?? ''}
      width={image.width}
      height={image.height}
    />
  )
}
```

SDKの `width` / `height` はoptional。上の例は寸法不明時に `fill` を使い、親の比率はレイアウト上の仮定として16:9にしている。実デザインへ合わせる。以降の寸法を直接渡す例は、値の存在を確認済みの画像を前提とする。装飾画像以外のaltは、編集運用に合わせて明示する。

## remotePatternsを設定する

外部URLを `next/image` のデフォルトloaderで最適化する場合、`next.config.*` で許可する。

microCMS標準の画像ホストを使う例:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.microcms-assets.io',
        pathname: '/assets/**',
      },
    ],
  },
}

export default nextConfig
```

カスタムドメイン・Amazon S3連携等を使っている場合は実際の画像ホストへ合わせる。

`hostname: '**'` のように全外部画像を許可しない。Next.js公式も `remotePatterns` はできるだけ具体的にすることを推奨している。

古い `images.domains` より `remotePatterns` を優先する。

## widthとheightを使う

リモート画像ではNext.jsがbuild時に画像サイズを自動解析できないため、原則として `width` と `height` を渡すか `fill` を使う。

microCMS画像フィールドから得られる元画像の `width` / `height` は、アスペクト比の保持にも使える。

重要:

`<Image width={1200} height={630}>` は「常に1200pxの画像を画面へ表示する」という意味ではない。表示サイズはCSSや `sizes` と合わせて決める。

## sizesを適切に設定する

レスポンシブレイアウトでは `sizes` を実際の表示幅へ合わせる。

例:

```tsx
<Image
  src={image.url}
  alt={image.alt ?? ''}
  width={image.width}
  height={image.height}
  sizes="(max-width: 768px) 100vw, 720px"
/>
```

`fill` を使う場合は特に `sizes` を省略しない。ブラウザが必要以上に大きい候補画像を選び、転送量が増える可能性がある。

一覧カードと記事ヒーローで同じ `sizes` を使い回さず、実際のレイアウトに合わせる。

## microCMS画像APIとNext.js Image Optimizationを使い分ける

### Next.js Image Optimizationを主体にする

```tsx
<Image src={image.url} ... />
```

Next.jsのデフォルトloaderがmicroCMSの画像を取得し、Next.js側の画像最適化経路から配信する。

向くケース:

- Next.js標準の画像最適化・キャッシュ運用へ統一したい。
- ホスティング環境がNext.js Image Optimizationを適切に提供する。
- microCMS画像API用の独自loaderを持ちたくない。

### microCMS画像APIを主体にする

Next.jsのcustom loaderで `w` / `q` 等をmicroCMS画像URLへ付与する。

向くケース:

- 画像変換をmicroCMS側へ集約したい。
- すでにmicroCMS画像APIの配信ルールをサイト全体で使っている。
- Next.js内蔵のoptimizerを使わないホスティング構成。

どちらが常に優れているとは決めつけない。ホスティング費用、キャッシュ、データ転送量、既存構成を見て選ぶ。

## microCMS画像APIのcustom loader

概念例:

```ts
// src/lib/microcms-image-loader.ts
import type { ImageLoaderProps } from 'next/image'

export default function microCMSImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  const url = new URL(src)
  url.searchParams.set('w', String(width))
  url.searchParams.set('q', String(quality ?? 75))
  return url.toString()
}
```

App Routerでは、Server Componentから通常の関数を `loader` propとして渡さず、小さなClient Component内でloaderをimportする。

```tsx
// src/components/microcms-image.tsx
'use client'

import Image from 'next/image'
import type { MicroCMSImage } from 'microcms-js-sdk'
import microCMSImageLoader from '@/lib/microcms-image-loader'

type SizedImage = MicroCMSImage & { width: number; height: number }

export function MicroCMSPicture({ image }: { image: SizedImage }) {
  return (
    <Image
      loader={microCMSImageLoader}
      src={image.url}
      alt={image.alt ?? ''}
      width={image.width}
      height={image.height}
      sizes="(max-width: 768px) 100vw, 720px"
      style={{ width: '100%', height: 'auto' }}
    />
  )
}
```

親Server ComponentではAPI取得を行い、寸法を確認した画像オブジェクトだけを渡す。ページ全体をClient Componentにする必要はない。

全画像へ適用したい場合は `images.loader: 'custom'` と `images.loaderFile` を設定する方法もある。その場合はNext.js公式のloaderFile例に合わせてloaderファイルへ `'use client'` を付け、ローカル画像を含めた全 `next/image` の入力を扱えるか確認する。

注意:

- microCMS画像APIが利用できる画像URLか確認する。
- 元URLに既存クエリがある場合は `URL` / `URLSearchParams` を使い、安全に追加する。
- `q` を過度に下げない。
- フォーマット変換を追加するならmicroCMS画像APIの現在の対応形式を確認する。

## クエリ付き画像URLとremotePatterns

Next.jsの `remotePatterns` で `search: ''` を指定すると、クエリ文字列を持つURLは許可されない。

microCMS画像APIの `?w=...&q=...` 等を `src` 自体へ付けてデフォルトloaderへ渡す場合、この制約に注意する。

対応方針:

- 固定クエリなら `search` を厳密に指定する。
- 動的な画像APIパラメータを許可する必要があるなら、`search` を省略する代わりにprotocol / hostname / pathnameを十分狭くする。
- custom loaderはNext.jsのデフォルトoptimizerを経由しない。`remotePatterns` をcustom loader自身のURL検証の代わりにせず、入力元と生成先を限定する。

セキュリティ上、必要以上に広いremote patternを許可しない。

## データ転送量を減らす

転送量削減では次の順に確認する。

1. 表示サイズに対して元画像が大きすぎないか。
2. `next/image` の `sizes` が実レイアウトに合っているか。
3. Next.js optimizerまたはmicroCMS画像APIのどちらが縮小を担当しているか。
4. microCMS画像APIを直接配信するなら `w` / `q` / formatが適切か。
5. 一覧・ヒーロー・サムネイルで同じ巨大画像を使っていないか。
6. 画面外画像をpreloadしていないか。

「Next.jsで `Image` を使っているから最適化済み」と判断しない。実際にブラウザが取得する画像URLとサイズを確認する。

## 避けたい実装

- `images.domains` へ多数のドメインを無制限に追加する。
- `remotePatterns` を実質ワイルドカードにする。
- 画像APIで小さくした画像をさらに意図なくNext.js optimizerで再エンコードする。
- `fill` を使いながら `sizes` を指定せず、必要以上に大きな画像を配信する。
- 300pxのカードへ常に2000px超の画像を直接送る。
- APIから得られるwidth / heightを無視し、すべて固定値へ置き換える。
- SVGへ通常のラスタ画像最適化と同じ方針を適用する。

## トラブルシューティング

### `next/image` で400になる

- `remotePatterns` のprotocol / hostname / pathnameが一致しているか。
- 画像URLにクエリがあるのに `search: ''` になっていないか。
- 実際の画像ホストが `images.microcms-assets.io` か。

### 削除した画像が表示され続ける

microCMSでメディアを削除しても、CDNキャッシュの削除完了まで時間がかかる場合がある。元の画像URLとNext.js optimizer経由のURLを別々に確認し、どの層が旧画像を返しているか切り分ける。[公式ヘルプ](https://help.microcms.io/ja/knowledge/media-deletion-url-access)

### 画像が大きいまま配信される

- ブラウザのNetworkで実取得URLを確認する。
- `sizes` を確認する。
- custom loaderが本当に `w` を付与しているか。
- `unoptimized` を付けていないか。

### 画像が二重に最適化されているように見える

- `src` にmicroCMS画像APIパラメータを付けた上でNext.jsデフォルトoptimizerへ渡していないか。
- どちらの層を最適化主体にするか決める。

### altが空になる

装飾画像なら空文字でよいが、内容を伝える画像ならmicroCMS側でaltを管理しているか、フロントエンド側で適切な代替テキストを設定する。

## 公式情報

- [next/image：loader・loaderFile・remotePatterns・sizes](https://nextjs.org/docs/app/api-reference/components/image)
- [microCMS画像フィールド](https://document.microcms.io/manual/image)
- [microCMS画像API](https://document.microcms.io/image-api/introduction)
- [microCMS画像APIの品質](https://document.microcms.io/image-api/quality)
