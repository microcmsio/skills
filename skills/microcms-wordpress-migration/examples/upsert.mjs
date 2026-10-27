#!/usr/bin/env node
// 参考実装・無保証。そのまま使わず、案件の migration/scripts/ にコピーし、中身を確認・修正してから使うこと。
// 変換済みコンテンツを microCMS に登録する。同じ ID が既にあれば移行元の識別情報を照合してから更新する。リスト形式の API 専用 (オブジェクト形式は PATCH で手で入れる)。
//
//   node --env-file=.env upsert.mjs <file.json | dir> [--dry-run] [--log logs/upsert-results.ndjson]
//
// 入力: 次の形の配列を持つ JSON ファイル (dir を渡すと中の *.json を名前順に全部)
//   [{ "endpoint": "posts", "id": "post-123", "status": "draft",
//      "identity": { "legacyId": "123", "legacyUrl": "https://old.example.com/post/123/" },
//      "content": { "legacyId": "123", "legacyUrl": "https://old.example.com/post/123/", "title": "…", "description": "" } }]
// identity の値と型は content と一致させる。スキーマにも識別情報用フィールドを作る。
// 変換で管理するフィールドは空になったものも型に応じた空値を送る。省略は「既存値を維持」。
//   status は省略で公開、"draft" で下書き、"closed" で公開終了。
// 既存の CLOSED / PUBLISH_AND_DRAFT、予約あり、既存から closed への変更は自動更新せず失敗にする。
// 参照される側 (カテゴリなど) のファイルが先に処理されるよう、ファイル名に番号を付けて順番を決める
//   (例: 10-categories.json, 20-authors.json, 30-posts.json)。
// --dry-run: 接続せずローカル入力だけ検査する。ID 衝突と状態・権限は実行時に確認する。最初に必ずこれで流す。
// 検査の結果 (エラーと警告) は logs/upsert-check.ndjson に書く。エラーのもの (PUT の上限超えなど) は登録せずに飛ばし、
// 登録結果のログに action: invalid として残す。残りはそのまま登録する。
import { readFileSync, readdirSync, statSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createClient, checkItem } from './microcms.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const logPath = args.includes('--log') ? args[args.indexOf('--log') + 1] : 'logs/upsert-results.ndjson';
const input = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--log');
if (!input) {
  console.error('使い方: node --env-file=.env upsert.mjs <file.json | dir> [--dry-run] [--log path]');
  process.exit(1);
}

const files = statSync(input).isDirectory()
  ? readdirSync(input).filter((f) => f.endsWith('.json')).sort().map((f) => join(input, f))
  : [input];
const items = files.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')).map((item) => ({ ...item, _file: f })));

const seen = new Set();
const checkPath = join(dirname(logPath), 'upsert-check.ndjson');
mkdirSync(dirname(logPath), { recursive: true });
writeFileSync(checkPath, '');
let invalid = 0;
for (const item of items) {
  const key = `${item.endpoint}/${item.id}`;
  const { errors, warnings } = checkItem(item);
  if (seen.has(key)) errors.push('同じ endpoint と id が重複しています');
  seen.add(key);
  for (const e of errors) console.error(`エラー ${key} (${item._file}): ${e}`);
  for (const w of warnings) console.warn(`警告 ${key}: ${w}`);
  if (errors.length || warnings.length) appendFileSync(checkPath, JSON.stringify({ endpoint: item.endpoint, id: item.id, file: item._file, errors, warnings }) + '\n');
  if (errors.length) { invalid++; item._errors = errors; }
}
console.log(`${items.length} 件を検査、エラー ${invalid} 件（登録しない）。検査結果: ${checkPath}`);
if (dryRun) process.exit(invalid ? 1 : 0);

const client = createClient();
const counts = { created: 0, updated: 0, failed: 0, invalid: 0 };
for (const [i, { _file, _errors, ...item }] of items.entries()) {
  const entry = { at: new Date().toISOString(), endpoint: item.endpoint, id: item.id };
  if (_errors) {
    Object.assign(entry, { action: 'invalid', error: _errors.join(' / ') });
    counts.invalid++;
    appendFileSync(logPath, JSON.stringify(entry) + '\n');
    continue;
  }
  try {
    entry.action = (await client.upsert(item)).action;
  } catch (e) {
    entry.action = 'failed';
    entry.error = e.message;
    console.error(`失敗 ${item.endpoint}/${item.id}: ${e.message}`);
  }
  counts[entry.action]++;
  appendFileSync(logPath, JSON.stringify(entry) + '\n');
  if ((i + 1) % 50 === 0) console.log(`${i + 1}/${items.length}`);
}
console.log(`作成 ${counts.created}、更新 ${counts.updated}、失敗 ${counts.failed}、検査エラーで飛ばした ${counts.invalid}。ログ: ${logPath}`);
process.exit(counts.failed || counts.invalid ? 1 : 0);
