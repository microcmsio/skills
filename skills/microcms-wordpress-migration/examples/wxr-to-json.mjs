#!/usr/bin/env node
// 参考実装・無保証。そのまま使わず、案件の migration/scripts/ にコピーし、中身を確認・修正してから使うこと。
// WXR (WordPress のエクスポートファイル) を投稿タイプごとの JSON に変換する。postmeta の PHP シリアライズは配列に戻す。
//
//   node wxr-to-json.mjs <wxr.xml> [出力ディレクトリ]      (既定: ./raw)
//
// 出力先は空のディレクトリを指定する。再変換・分割 WXR は別々の出力先を使う。
// 各投稿の metaEntries に元の postmeta のレコード順と重複を保持する。
// 出力: <投稿タイプ>.json (本文は生のまま。ブロックコメントも残る)、terms.json、authors.json、site.json、counts.json、
//       wxr-warnings.json (戻せなかったシリアライズなど。空でなければ必ず確認する)
// 本文のブロック分割は @wordpress/block-serialization-default-parser、段落付けは @wordpress/autop を使うとよい
// (PHP の parse_blocks() / wpautop() と同じ動き)。
// 既知の制限: ファイル全体を一度に読み込む (数百 MB の WXR は分けて書き出してもらう)、PHP のオブジェクト (O:) は戻さない。
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';

const [input, outDir = 'raw'] = process.argv.slice(2);
if (!input) {
  console.error('使い方: node wxr-to-json.mjs <wxr.xml> [出力ディレクトリ]');
  process.exit(1);
}
// 古い投稿タイプの JSON が次の変換に混ざらないよう、空の出力先だけを使う。
if (existsSync(outDir) && readdirSync(outDir).length) {
  console.error('出力先が空ではありません。前回のデータは残し、別の空ディレクトリを指定してください');
  process.exit(1);
}
const warnings = [];

// CDATA の中身に <title> などの文字列があっても誤って拾わないよう、先に CDATA を取り出して番号に置き換える
const cdata = [];
const xml = readFileSync(input, 'utf8').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, s) => `\u0000${cdata.push(s) - 1}\u0000`);
// WXR は CDATA 内の "]]>" を "]]]]><![CDATA[>" に分けて書くので、隣り合った CDATA はつなげる
const restore = (s) => s.replace(/\u0000(\d+)\u0000/g, (_, n) => cdata[n]);
const entities = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : entities[e] ?? m));
const value = (raw) => (raw.includes('\u0000') ? restore(raw.trim()) : decode(raw.trim()));
const tag = (block, name) => {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return m ? value(m[1]) : null;
};
const all = (block, name) => [...block.matchAll(new RegExp(`<${name}(\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => ({ attrs: m[1] ?? '', body: m[2] }));
const attr = (attrs, name) => attrs.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;

// PHP の serialize() 形式を戻す。文字列の長さはバイト数で数える
function unserialize(s) {
  const buf = Buffer.from(s, 'utf8');
  let i = 0;
  const until = (ch) => {
    const end = buf.indexOf(ch.charCodeAt(0), i);
    if (end < 0) throw new Error('途中で終わっています');
    const v = buf.toString('utf8', i, end);
    i = end + 1;
    return v;
  };
  const read = () => {
    const t = String.fromCharCode(buf[i]);
    i += 2;
    if (t === 'N') return null;
    if (t === 'b') return until(';') === '1';
    if (t === 'i' || t === 'd') return Number(until(';'));
    if (t === 's') {
      const len = Number(until(':'));
      const v = buf.toString('utf8', i + 1, i + 1 + len);
      i += len + 3;
      return v;
    }
    if (t === 'a') {
      const n = Number(until(':'));
      i++;
      const entries = [];
      for (let k = 0; k < n; k++) entries.push([read(), read()]);
      i++;
      return entries.every(([key], k) => key === k) ? entries.map(([, v]) => v) : Object.fromEntries(entries);
    }
    throw new Error(`戻せない型 ${t}`);
  };
  const v = read();
  if (i !== buf.length) throw new Error('余分なデータがあります');
  return v;
}
const maybeUnserialize = (s, where) => {
  if (!/^(?:[aOs]:\d+:|[bid]:[^;]*;|N;)/.test(s)) return s;
  try {
    return unserialize(s);
  } catch (e) {
    warnings.push({ ...where, warning: `シリアライズを戻せなかった（${e.message}）。値はそのまま残した` });
    return s;
  }
};

if (!/<\/rss>\s*$/.test(xml)) {
  console.error('WXR が途中で切れています（末尾が </rss> で終わっていない）。エクスポートし直してもらってください');
  process.exit(1);
}
const channel = xml.match(/<channel>([\s\S]*)<\/channel>/)[1];
const head = channel.split('<item>')[0];
mkdirSync(outDir, { recursive: true });
const put = (name, data) => writeFileSync(`${outDir}/${name}.json`, JSON.stringify(data, null, 2));

put('site', {
  title: tag(head, 'title'), link: tag(head, 'link'), language: tag(head, 'language'),
  wxr_version: tag(head, 'wp:wxr_version'), base_site_url: tag(head, 'wp:base_site_url'), base_blog_url: tag(head, 'wp:base_blog_url'),
  generator: tag(head, 'generator'),
});
put('authors', all(head, 'wp:author').map(({ body }) => ({
  id: Number(tag(body, 'wp:author_id')), login: tag(body, 'wp:author_login'), email: tag(body, 'wp:author_email'),
  display_name: tag(body, 'wp:author_display_name'), first_name: tag(body, 'wp:author_first_name'), last_name: tag(body, 'wp:author_last_name'),
})));

// カテゴリ・タグ・それ以外のタームは、WXR では書き方が違う。ここで 1 つの形にそろえる
const termMeta = (body, where) => Object.fromEntries(all(body, 'wp:termmeta').map(({ body: m }) => [tag(m, 'wp:meta_key'), maybeUnserialize(tag(m, 'wp:meta_value') ?? '', where)]));
put('terms', [
  ...all(head, 'wp:category').map(({ body }) => ({ term_id: Number(tag(body, 'wp:term_id')), taxonomy: 'category', slug: tag(body, 'wp:category_nicename'), name: tag(body, 'wp:cat_name'), parent: tag(body, 'wp:category_parent') || null, description: tag(body, 'wp:category_description') ?? '', meta: termMeta(body, { term: tag(body, 'wp:category_nicename') }) })),
  ...all(head, 'wp:tag').map(({ body }) => ({ term_id: Number(tag(body, 'wp:term_id')), taxonomy: 'post_tag', slug: tag(body, 'wp:tag_slug'), name: tag(body, 'wp:tag_name'), parent: null, description: tag(body, 'wp:tag_description') ?? '', meta: termMeta(body, { term: tag(body, 'wp:tag_slug') }) })),
  ...all(head, 'wp:term').map(({ body }) => ({ term_id: Number(tag(body, 'wp:term_id')), taxonomy: tag(body, 'wp:term_taxonomy'), slug: tag(body, 'wp:term_slug'), name: tag(body, 'wp:term_name'), parent: tag(body, 'wp:term_parent') || null, description: tag(body, 'wp:term_description') ?? '', meta: termMeta(body, { term: tag(body, 'wp:term_slug') }) })),
].sort((a, b) => a.term_id - b.term_id));

const byType = {};
const counts = {};
for (const { body } of all(channel, 'item')) {
  const id = Number(tag(body, 'wp:post_id'));
  const type = tag(body, 'wp:post_type');
  const status = tag(body, 'wp:status');
  const metaValues = new Map();
  const metaEntries = [];
  for (const { body: m } of all(body, 'wp:postmeta')) {
    const key = tag(m, 'wp:meta_key');
    const v = maybeUnserialize(tag(m, 'wp:meta_value') ?? '', { ID: id, meta_key: key });
    metaEntries.push({ key, value: v });
    if (!metaValues.has(key)) metaValues.set(key, []);
    metaValues.get(key).push(v);
  }
  const meta = Object.fromEntries([...metaValues].map(([key, values]) => [key, values.length === 1 ? values[0] : values]));
  const terms = {};
  for (const { attrs, body: c } of all(body, 'category')) {
    (terms[attr(attrs, 'domain')] ??= []).push(attr(attrs, 'nicename') ?? value(c));
  }
  const row = {
    ID: id, post_type: type, post_status: status, post_title: tag(body, 'title') ?? '', post_name: tag(body, 'wp:post_name') ?? '',
    post_date: tag(body, 'wp:post_date'), post_date_gmt: tag(body, 'wp:post_date_gmt'), post_modified: tag(body, 'wp:post_modified'), post_modified_gmt: tag(body, 'wp:post_modified_gmt'),
    post_author: tag(body, 'dc:creator'), post_parent: Number(tag(body, 'wp:post_parent') ?? 0), menu_order: Number(tag(body, 'wp:menu_order') ?? 0),
    post_password: tag(body, 'wp:post_password') ?? '', sticky: tag(body, 'wp:is_sticky') === '1', comment_status: tag(body, 'wp:comment_status'),
    link: tag(body, 'link'), guid: tag(body, 'guid'), post_content: tag(body, 'content:encoded') ?? '', post_excerpt: tag(body, 'excerpt:encoded') ?? '',
    metaEntries, // 同じキーの複数レコードと、1 レコードの配列値を区別できる元の並び
    terms, meta: Object.fromEntries(Object.entries(meta).sort(([a], [b]) => a.localeCompare(b))),
    comments: all(body, 'wp:comment').map(({ body: c }) => ({
      id: Number(tag(c, 'wp:comment_id')), parent: Number(tag(c, 'wp:comment_parent') ?? 0), author: tag(c, 'wp:comment_author'), author_email: tag(c, 'wp:comment_author_email'),
      date_gmt: tag(c, 'wp:comment_date_gmt'), approved: tag(c, 'wp:comment_approved'), type: tag(c, 'wp:comment_type') || 'comment', user_id: Number(tag(c, 'wp:comment_user_id') ?? 0), content: tag(c, 'wp:comment_content') ?? '',
    })),
  };
  // ACF / SCF の管理画面で作ったフィールドグループとフィールドは、設定が本文にシリアライズされている
  if (type === 'acf-field-group' || type === 'acf-field') row.settings = maybeUnserialize(row.post_content, { ID: id, field: 'post_content' });
  // 添付ファイル：uploads フォルダ内の相対パス。2560px を超える画像は -scaled が添付ファイルの本体で、元画像は original_image
  if (type === 'attachment') {
    row.attachment_url = tag(body, 'wp:attachment_url');
    row.file = typeof meta._wp_attached_file === 'string' ? meta._wp_attached_file : null;
    row.alt = meta._wp_attachment_image_alt ?? '';
    const original = meta._wp_attachment_metadata?.original_image;
    row.original_file = original && row.file ? row.file.replace(/[^/]+$/, original) : null;
  }
  (byType[type] ??= []).push(row);
  counts[type] ??= {};
  counts[type][status] = (counts[type][status] ?? 0) + 1;
}

for (const [type, rows] of Object.entries(byType)) put(type, rows.sort((a, b) => a.ID - b.ID));
put('counts', counts);
put('wxr-warnings', warnings);
console.log(`書き出し完了: ${outDir}（${Object.entries(counts).map(([t, c]) => `${t} ${Object.values(c).reduce((a, b) => a + b, 0)}`).join('、')}）`);
if (warnings.length) console.warn(`${warnings.length} 件の警告があります: ${outDir}/wxr-warnings.json`);
