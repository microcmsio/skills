# リッチエディタ（richEditorV2）への HTML 変換

microCMS のリッチエディタは、受け取った HTML を自分の内部構造に変換して保存する。**一覧にない書式は、エラーにならずに捨てられるか、ただの段落の文字になる**（エラーにならないので、ログに失敗が出ないまま内容が欠ける）。解析に失敗すると 5xx で登録自体が失敗することもある。WordPress の HTML はそのまま送らず、下の範囲に収めてから送る。

旧リッチエディタ（`richEditor`）は HTML を受け付けない。移行先のフィールドは必ず `richEditorV2` にする。

## 入稿できる HTML

| 書式 | HTML |
|---|---|
| 見出し | `h1`〜`h5`（`h6` は使えない → `h5` か太字の段落に） |
| 段落・改行 | `p`、`br` |
| 太字・斜体・下線・取り消し線 | `strong`、`em`、`u`、`s` |
| インラインコード | `code` |
| 文字色 | `span style="color: #RRGGBB"`（色をプリセットだけに限定している場合、それ以外は消える） |
| 文字揃え | `p style="text-align: left/center/right"` |
| 区切り線 | `hr` |
| 引用 | `blockquote` |
| コードブロック | `pre > code`。言語とファイル名は `div[data-filename="a.js"] > pre > code.language-js` |
| 表 | `table > tbody > tr > th / td`（`colspan`・`rowspan` 可） |
| リスト | `ul > li`、`ol > li`（入れ子可。深すぎると失敗する） |
| リンク | `a[href]`、新しいタブは `target="_blank"` |
| 画像 | `img[src][alt][width][height]`。`src` は**同じサービスの microCMS 画像 URL のみ** |
| 画像＋キャプション | `figure > img + figcaption`、揃えは `figure style="text-align: …"` |
| ファイルへのリンク | `a[data-embed-type="file"][href]`（同じサービスのファイル URL のみ） |
| カスタムクラス | `span[class]`（スキーマの `customClassList` に登録したもの） |

使えないもの：文字サイズの `style`（スキーマでサイズのプリセットを作った場合を除く）、`div` などの汎用ブロック、`iframe`・`script`・`style`、任意の `class` 属性、`h6`。

## WordPress からの変換表

| WordPress | 変換先 |
|---|---|
| `core/paragraph`、`core/heading`、`core/list`、`core/quote`、`core/code`、`core/table`、`core/separator` | 上の表の対応する HTML。ブロックが付けた `class`（`wp-block-*` など）は消す |
| `core/image`（キャプションあり） | `figure > img + figcaption` |
| `core/gallery` | 本文内なら画像を順に並べる。ギャラリーとして扱いたいなら `mediaList` フィールドに逃がす |
| `core/quote` の `cite` | `cite` は使えない。引用の最後に `<p>— 出典</p>` として入れる |
| `core/embed`（YouTube、X など） | URL は `div.wp-block-embed__wrapper` の中の文字として入っている。**リッチエディタの埋め込み（`oembedly`）は API では入れられない**。残し方を決める。① 本文に URL だけのリンクを置く ② 繰り返しフィールドに「埋め込み」用カスタムフィールド（URL の `text`）を作って逃がす ③ 移行後に人が管理画面で埋め込みを入れる（対象を `report.md` の「人がやること」に載せる。入れたあとは、そのコンテンツの本文を流し直さない） |
| `core/columns`、`core/group` | 中身を順に並べて平らにする。レイアウトを残したいなら繰り返しフィールドで表す |
| `core/block`（再利用ブロック） | 中身を展開する |
| `core/shortcode`、本文中のショートコード | `wordpress.md` の方針どおり。展開するか、逃がすか、記録する |
| `core/html`（カスタム HTML） | 中身を見て判断。多くは記録して人が直す |
| `[caption]` | `figure > img + figcaption` |
| `<span style="font-size">` | 文字サイズのプリセットがあれば対応させる。なければ外す（中の文字は残す） |
| 独自クラスの `div`（注意書きボックスなど） | 中身の段落だけ残す。見た目を残したいならカスタムクラスの `span`、または繰り返しフィールドに逃がす |
| `iframe`（Google マップなど） | リッチエディタには送れない。本文から外し、URL を別フィールドに入れるか記録する |
| `img src` が WP の URL | `media-map.json` で microCMS の URL に置き換える。縮小版の URL（`-300x200`）の引き方は `wordpress.md` の 2 章 |
| 内部リンク | 合意済みの新サイトのパスに書き換える（URL 対応表と同じものを使う）。新 URL が未定なら旧リンクを保持し、未解決一覧に載せる |

## 変換の進め方

1. 本文を DOM として解析する（正規表現で HTML を書き換えない。入れ子が壊れる）。Node なら `parse5` や `linkedom`、PHP なら `DOMDocument` など。
2. 上の表にない要素・属性に出会ったら、消すか展開するかを決め、`logs/transform-warnings.ndjson` に記録する。黙って捨てない。
3. 変換後の HTML に、許可した要素以外が残っていないことを機械的に確かめる（`validation.md` の本文チェック）。
4. 登録したら、送った本文と、GET で返ってくる本文を比べる（タグを除いたテキストの長さ、画像・リンク・表の数）。
5. 最初の 3〜5 件は、microCMS に登録したあと管理画面で表示を見る。
