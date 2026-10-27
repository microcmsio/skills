#!/usr/bin/env node
// 参考実装・無保証。そのまま使わず、案件の migration/scripts/ にコピーし、中身を確認・修正してから使うこと。
// 旧 URL のメディアを microCMS にアップロードし、旧 URL → 新 URL の対応表を作る。
//
//   node --env-file=.env upload-media.mjs <urls.json> [--uploads <wp-content/uploads を展開したフォルダ>] [--map media-map.json] [--skipped media-skipped.json] [--force]
//
// 入力: 旧 URL の配列 ["https://old.example.com/wp-content/uploads/a.png", ...]
//   縮小版 (-300x200 など) ではなく元画像の URL を渡す。
//   5MB を超える画像は圧縮したファイルを手元に作り、{ "url": "<旧 URL>", "file": "<圧縮後のパス>" } と書けば
//   そのファイルを上げる (対応表のキーは旧 URL のまま)。
// --uploads を付けると、URL の /wp-content/uploads/ 以下のパスでそのフォルダからファイルを読む (サイトにはアクセスしない)。
// フォルダにないものは上げずに --skipped に出す。付けないときは URL から取得する。
// 対応表は 1 件ごとに保存するので、途中で止まっても同じコマンドで続きから再開できる。
// 同じ旧 URL の画像を差し替えたときは、その URL だけの入力に --force を付けて再アップロードする。
// 旧メディアは削除しない。対応表を差し替えたあと、本文・画像フィールドも変換し直す。
// 未解決一覧は前回分を保持し、成功した URL だけ除く。未解決が残れば終了コード 1。
// 環境 (サービス) ごとに対応表を分けること (別サービスの URL は使えない)。
// 5MB 超えなど API で上げられないものは --skipped のファイルに理由つきで出す。
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { basename, extname, resolve, relative, isAbsolute, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { createClient, LIMITS } from './microcms.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  uploads: { type: 'string' }, map: { type: 'string', default: 'media-map.json' },
  skipped: { type: 'string', default: 'media-skipped.json' }, force: { type: 'boolean', default: false },
} });
const { map: mapPath, skipped: skippedPath, uploads: uploadsDir, force } = values;
const [input] = positionals;
if (!input || positionals.length !== 1) {
  console.error('使い方: node --env-file=.env upload-media.mjs <urls.json> [--uploads dir] [--map path] [--skipped path] [--force]');
  process.exit(1);
}

const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const uploadsRoot = uploadsDir && realpathSync(uploadsDir);
const assertInside = (path) => {
  const rel = relative(uploadsRoot, path);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error('uploads の外を指すパスは読み込みません');
  }
  return path;
};
const fromUploads = (url) => {
  // 相対 URL（/wp-content/uploads/…）も読めるよう、仮の基準 URL を付けて解釈する
  const rel = URL.canParse(url, 'http://localhost') && new URL(url, 'http://localhost').pathname.split('/wp-content/uploads/')[1];
  if (!rel) return null;
  const path = assertInside(resolve(uploadsRoot, decodeURIComponent(rel)));
  // エンコードされた ../ と、uploads 外へのシンボリックリンクを両方拒否する。
  return assertInside(realpathSync(path));
};
const entries = JSON.parse(readFileSync(input, 'utf8')).map((x) => (typeof x === 'string' ? { url: x } : x));
const files = Object.fromEntries(entries.filter((x) => x.file).map((x) => [x.url, x.file]));
const urls = [...new Set(entries.map((x) => x.url))];
const map = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, 'utf8')) : {};
const skipped = new Map((existsSync(skippedPath) ? JSON.parse(readFileSync(skippedPath, 'utf8')) : []).map((entry) => [entry.url, entry]));
const client = createClient();
// 旧ドメインと新ドメインのように、URL が違っても同じファイルなら同じアップロード先を使う
const byLocal = new Map();
if (uploadsDir && !force) for (const [u, v] of Object.entries(map)) {
  try {
    const local = files[u] ?? fromUploads(u);
    if (local && !skipped.has(u)) byLocal.set(local, v);
  } catch { /* 入力に含まれている場合は下の処理で理由を記録する */ }
}

const todo = urls.filter((u) => force || !map[u] || skipped.has(u));
console.log(`${urls.length} 件中 ${urls.length - todo.length} 件はアップロード済み。残り ${todo.length} 件`);

for (const [i, url] of todo.entries()) {
  try {
    let bytes, type, filename;
    const local = files[url] ?? (uploadsDir && fromUploads(url));
    if (uploadsDir && !local) throw new Error('URL が /wp-content/uploads/ 以下ではありません。公開 URL から取るか、人に確認してください');
    if (local && byLocal.has(local)) {
      map[url] = byLocal.get(local);
      writeFileSync(mapPath, JSON.stringify(map, null, 2));
      skipped.delete(url);
      continue;
    }
    if (local) {
      if (!existsSync(local)) throw new Error(`ファイルがありません: ${local}（移行元でも消えている可能性があります）`);
      bytes = readFileSync(local);
      type = TYPES[extname(local).toLowerCase()] ?? 'application/octet-stream';
      filename = basename(local);
    } else {
      const src = await fetch(url);
      if (!src.ok) throw new Error(`取得失敗 ${src.status}`);
      bytes = Buffer.from(await src.arrayBuffer());
      type = src.headers.get('content-type') ?? 'application/octet-stream';
      filename = decodeURIComponent(basename(new URL(url).pathname));
    }
    if (bytes.length > LIMITS.mediaMaxBytes) {
      const hint = type.startsWith('image/') ? '圧縮したファイルを file で指定してください' : '管理画面から手で上げてください';
      throw new Error(`${(bytes.length / 1024 / 1024).toFixed(1)}MB。API の上限 5MB を超えています。${hint}`);
    }
    map[url] = await client.uploadMedia({ bytes, filename, type });
    if (local) byLocal.set(local, map[url]);
    writeFileSync(mapPath, JSON.stringify(map, null, 2));
    skipped.delete(url);
  } catch (e) {
    skipped.set(url, { url, reason: e.message });
  }
  writeFileSync(skippedPath, JSON.stringify([...skipped.values()], null, 2));
  if ((i + 1) % 20 === 0) console.log(`${i + 1}/${todo.length}`);
}

writeFileSync(skippedPath, JSON.stringify([...skipped.values()], null, 2));
console.log(`完了。対応表 ${Object.keys(map).length} 件: ${mapPath}、未解決 ${skipped.size} 件: ${skippedPath}`);
process.exitCode = skipped.size ? 1 : 0;
