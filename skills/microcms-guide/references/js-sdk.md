# microcms-js-sdk ガイド

最終確認: 2026-09-08

このリファレンスは、JavaScript / TypeScript から microCMS を利用する際に `microcms-js-sdk` をどう使うか判断するためのガイド。API リファレンスの転載ではなく、実装時に選択すべきメソッド、型、安全な API キー運用、エラーハンドリングなどの実践的な判断を扱う。

## 目次

- [基本方針](#基本方針)
- [セットアップ](#セットアップ)
- [API形式とメソッドの選び方](#api形式とメソッドの選び方)
- [コンテンツ取得](#コンテンツ取得)
- [queries の使い方](#queries-の使い方)
- [全件取得](#全件取得)
- [TypeScript](#typescript)
- [書き込み操作](#書き込み操作)
- [APIキーの扱い](#apiキーの扱い)
- [retry](#retry)
- [customRequestInit](#customrequestinit)
- [エラーハンドリング](#エラーハンドリング)
- [Management API クライアント](#management-api-クライアント)
- [判断ルール](#判断ルール)
- [公式情報](#公式情報)

## 基本方針

- JavaScript / TypeScript で一般的なコンテンツ API 操作を実装する場合は、まず `microcms-js-sdk` の利用を検討する。
- SDK を使うこと自体を目的にしない。既存実装が `fetch` で簡潔かつ安全に成立している場合は、不要な置き換えを行わない。
- フレームワーク固有のキャッシュ、ルーティング、プレビューなどは、このリファレンスで一般化しすぎない。Next.js 固有の挙動は `microcms-nextjs` へ委ねる。
- SDK のバージョンやランタイム要件は変わりうるため、バージョン依存の回答では公式 README / npm を確認する。
- `microcms-js-sdk` v3.0.0 以降は Node.js 18 以上が必要。

## セットアップ

Node.js ではパッケージをインストールし、`createClient` でクライアントを作成する。

```bash
npm install microcms-js-sdk
```

```ts
import { createClient } from 'microcms-js-sdk';

export const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN!,
  apiKey: process.env.MICROCMS_API_KEY!,
});
```

`serviceDomain` には `xxxx.microcms.io` 全体ではなく、`xxxx` の部分を指定する。

ブラウザでも SDK は利用できるが、クライアントサイドから API を呼ぶ場合は API キーが利用者から確認できる。CSR を選択する場合は、API キーの権限を必要最小限に制限する。

## API形式とメソッドの選び方

microCMS の API 形式に合わせてメソッドを選ぶ。

| やりたいこと | API形式 | SDKメソッド |
| --- | --- | --- |
| コンテンツ一覧を取得 | リスト形式 | `getList` |
| IDを指定して1件取得 | リスト形式 | `getListDetail` |
| 単一コンテンツを取得 | オブジェクト形式 | `getObject` |
| コンテンツIDを全件取得 | リスト形式 | `getAllContentIds` |
| コンテンツを全件取得 | リスト形式 | `getAllContents` |
| コンテンツを作成 | リスト形式 | `create` |
| コンテンツを更新 | リスト形式 / オブジェクト形式 | `update` |
| コンテンツを削除 | リスト形式 | `delete` |

API 形式が分からない場合は、コードだけから推測せず microCMS 側の API 設定を確認する。

## コンテンツ取得

### 一覧を取得する

```ts
const data = await client.getList<Article>({
  endpoint: 'articles',
});
```

`getList` は `contents`, `totalCount`, `limit`, `offset` を含むレスポンスを返す。

### IDを指定して1件取得する

```ts
const article = await client.getListDetail<Article>({
  endpoint: 'articles',
  contentId: 'article-id',
});
```

リスト形式 API の詳細ページなど、コンテンツ ID が分かっている場合は `getListDetail` を優先する。単一コンテンツを得るためだけに `getList` + `filters` を使わない。

### オブジェクト形式APIを取得する

```ts
const settings = await client.getObject<SiteSettings>({
  endpoint: 'settings',
});
```

サイト設定や固定情報など、オブジェクト形式 API では `getObject` を使う。

## queries の使い方

取得条件は `queries` にまとめて指定する。

```ts
const data = await client.getList<Article>({
  endpoint: 'articles',
  queries: {
    limit: 20,
    offset: 0,
    orders: '-publishedAt',
    fields: 'id,title,publishedAt',
    filters: 'category[equals]news',
    depth: 1,
  },
});
```

主なクエリには `draftKey`, `limit`, `offset`, `orders`, `q`, `fields`, `ids`, `filters`, `depth` などがある。利用可能な条件や対象フィールドは Content API の仕様に従う。

### 推奨

- 一覧表示で不要な大きなフィールドを使わない場合は `fields` で必要な要素だけ取得することを検討する。
- API 側で絞り込める条件は、全件取得後にアプリ側で絞り込むのではなく `filters` や `q` の利用を検討する。
- `limit` のデフォルト値は 10、上限値は 100。101件以上が必要なら全件取得メソッドまたはページングを使う。
- `depth` は参照コンテンツを必要な深さだけ取得する。必要以上に深くしない。
- 下書き取得の `draftKey` は、公開ページやクライアントに不用意に露出させない。

### 検索方法を選ぶ

`q` は全文検索向けで、検索対象フィールドを指定できない。特定フィールドの正確な部分一致には、対応するフィールドに `filters` の `contains` を使うが、全件走査になるため件数が多い場合は応答時間を確認する。CMS外のページを含む検索や検索語のハイライトが必要なら、外部の検索基盤も検討する。microCMS APIがハイライト結果を返すと想定しない。[公式ヘルプ：サイト内検索](https://help.microcms.io/ja/knowledge/add-search-to-site)

## 全件取得

101件以上のコンテンツが必要な場合、SDK には以下が用意されている。

```ts
const contents = await client.getAllContents<Article>({
  endpoint: 'articles',
});

const ids = await client.getAllContentIds({
  endpoint: 'articles',
});
```

`getAllContentIds` では `filters`, `draftKey`, `alternateField` も利用できる。

### 推奨

- 本当に全件が必要かを先に確認する。
- ID だけでよい場合は `getAllContents` ではなく `getAllContentIds` を使う。
- 大量コンテンツの全件取得は複数回の API リクエストにつながる。ページ表示のたびに無条件で実行する設計は避け、ビルド時処理やバッチ処理など利用目的に合わせて検討する。
- 任意の件数だけ必要な場合や取得過程を細かく制御したい場合は、`limit` / `offset` を用いたページングを実装する。

## TypeScript

SDK は TypeScript の型定義を提供している。コンテンツスキーマに対応する型を定義し、ジェネリクスとして渡す。

```ts
type Article = {
  title: string;
  description?: string;
};

const list = await client.getList<Article>({
  endpoint: 'articles',
});

const detail = await client.getListDetail<Article>({
  endpoint: 'articles',
  contentId: 'article-id',
});
```

SDK が付与する `id`, `createdAt`, `updatedAt`, `publishedAt`, `revisedAt` などの共通情報を独自に重複定義する必要がないケースでは、SDK のレスポンス型を活用する。

型引数は実データを検証せず、`fields` で省いたフィールドも自動的には型から消えない。部分取得は `Pick` 等で型も絞る。コンテンツ参照の空値は `null`、セレクトは単一選択でも配列など、実レスポンスに合わせる。

型定義は実際の microCMS スキーマと一致させる。コード上の都合だけで optional / required を推測しない。

## 書き込み操作

`create`, `update`, `delete` は API キーに対応する書き込み権限が必要。

```ts
await client.create<Article>({
  endpoint: 'articles',
  content: {
    title: 'タイトル',
  },
});
```

```ts
await client.update<Article>({
  endpoint: 'articles',
  contentId: 'article-id',
  content: {
    title: '更新後のタイトル',
  },
});
```

書き込み系の API キーをブラウザへ露出させない。原則としてサーバーサイドや信頼できる実行環境から呼び出す。

SDK のバージョンによって `isDraft`, `isClosed` など利用できるオプションが異なる場合があるため、公開状態を操作するコードを生成するときは現在の公式 README を確認する。

### 繰り返しフィールドの更新

`update` / PATCHで繰り返しフィールドを更新するときは、変更する要素だけでなく、その繰り返しフィールド内の全要素・保持したい全フィールドを送る。省略した内部フィールドは空値になり得る。対象の公開／下書き状態を確認して現在値を取得し、変更箇所以外を維持した配列を作る。GETの参照展開結果をそのまま送らず、WRITE APIが受け取る形に整える。[公式ヘルプ：繰り返しのPATCH](https://help.microcms.io/ja/knowledge/patch-api-repeat-field-request-body)

読み取りから書き込みまでの間に編集者が更新すると上書きする可能性があるため、実行直前の再確認や編集時間の調整も検討する。これはread-modify-writeに関する実装上の注意であり、SDKの自動マージ機能ではない。

## APIキーの扱い

API キーは「常にクライアントへ出してはいけない」という単純な扱いではなく、付与された権限で判断する。

- CSR で API キーを利用すると、利用者からキーを確認できる。
- クライアントから直接 GET する必要がある場合は、公開して問題のない API だけに GET 権限を限定するなど、必要最低限の権限にする。
- 書き込み権限、下書き全取得、非公開 API へのアクセスなどを含むキーはサーバーサイドで扱う。
- 読み取り用と書き込み用の API キーを分けることを検討する。
- コード例では実値を直接記述せず、環境変数や安全な設定方法を使う。

## retry

`createClient` の `retry: true` を指定すると、SDK のリトライ機能を有効にできる。公式 README では最大2回まで再試行すると案内されている。

```ts
const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN!,
  apiKey: process.env.MICROCMS_API_KEY!,
  retry: true,
});
```

### 推奨

- 一時的な失敗への耐性が必要な処理では利用を検討する。
- リトライを有効にすれば大量アクセスや不適切なリクエスト設計が解決する、と説明しない。
- 書き込み処理や外部副作用を含む設計では、処理全体の冪等性も別途検討する。

GETのエラー応答もCDNに最大10秒キャッシュされる場合があり、即座の再試行では同じエラーを受け取り得る。SDKのretryは対象エラーに対して待機を挟むため、呼び出し元のタイムアウトも確認する。独自リトライは回数を制限し、待機時間を増やす方式を検討する。待機・対象ステータスの詳細は導入済みSDKで確認し、外側のリトライと重ねてリクエストを増幅させない。[公式ヘルプ：再試行で同じエラーが返る場合](https://help.microcms.io/ja/knowledge/retry-error-same-response)

## customRequestInit

`customRequestInit` では underlying `fetch` に渡す設定を指定できる。

AbortController の例:

```ts
const controller = new AbortController();

const data = await client.getObject<SiteSettings>({
  endpoint: 'settings',
  customRequestInit: {
    signal: controller.signal,
  },
});
```

フレームワークが `fetch` を拡張している場合、そのオプションを `customRequestInit` から指定できることがある。たとえば Next.js App Router のキャッシュ関連オプションは公式 README に例があるが、意味や推奨設定は Next.js 側の仕様に依存するため `microcms-nextjs` で扱う。

## エラーハンドリング

通常は標準の `Error` として扱える。`isMicroCMSRequestError` をexportするSDKでは、microCMS リクエスト由来のエラーを判定できる。公式READMEの最新版とインストール済みのリリースは一致するとは限らないため、使用前に対象バージョンのexport・型定義を確認する。

```ts
import {
  createClient,
  isMicroCMSRequestError,
} from 'microcms-js-sdk';

try {
  await client.getList({ endpoint: 'articles' });
} catch (error) {
  if (isMicroCMSRequestError(error)) {
    console.error(error.status);
    // urlやoriginalErrorの出力は、秘密情報が含まれないか確認した場合のみ。
  }
  throw error;
}
```

- HTTP エラーでは `status` に HTTP ステータスコードが入る。
- ネットワークエラーでは `status` は `undefined` になる。
- `url` に `draftKey` が含まれる場合、SDK は値を `***` にマスクする。
- `originalError` の形式は実行環境によって異なるため、その具体的な構造に依存した処理を書かない。

エラーを握りつぶさない。ユーザーにデバッグを依頼された場合は、HTTP エラーかネットワークエラーかをまず切り分ける。

## Management API クライアント

SDK には `createManagementClient` も用意されており、現在は Management API を利用したメディアアップロードなどに使用できる。

```ts
import { createManagementClient } from 'microcms-js-sdk';

const client = createManagementClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN!,
  apiKey: process.env.MICROCMS_MANAGEMENT_API_KEY!,
});
```

Content API 用の `createClient` と Management API 用の `createManagementClient` を混同しない。Management API はベータ提供のため、対応範囲や仕様を回答するときは最新の公式情報を確認する。

## 判断ルール

ユーザーの依頼に対して、以下を優先する。

1. API 形式を確認して適切な SDK メソッドを選ぶ。
2. 必要なデータだけ取得できるよう `queries` を検討する。
3. 全件取得は必要性を確認してから使う。
4. TypeScript プロジェクトではコンテンツ型を明示する。
5. API キーは利用場所と権限をセットで確認する。
6. フレームワーク固有のキャッシュやデータ取得挙動は専門 Skill に委ねる。
7. SDK の仕様が不明な場合は、推測せず現在の公式 README / npm / microCMS ドキュメントを確認する。

## 公式情報

- [microCMS JavaScript SDK](https://github.com/microcmsio/microcms-js-sdk)
- [npm](https://www.npmjs.com/package/microcms-js-sdk)
- [GET API におけるクエリパラメータ](https://document.microcms.io/content-api/content-api-query)
- [コンテンツ一覧取得 API](https://document.microcms.io/content-api/get-list-contents)
- [APIキー（認証と権限管理）](https://document.microcms.io/content-api/x-microcms-api-key)
- [101件以上のコンテンツ取得](https://help.microcms.io/ja/knowledge/fetch-big-data)
- [フィールドごとのレスポンス形式](https://document.microcms.io/content-api/get-api-field-responses)
