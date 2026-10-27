// 共通部品・WXR変換・メディアCLIの動作確認。ネットワークには出ない。node examples/test.mjs
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createClient, checkItem } from './microcms.mjs';

const identity = { legacyId: '123', legacyUrl: 'https://old.example.com/posts/123/' };
const item = (extra = {}) => ({ endpoint: 'posts', id: 'post-123', identity,
  content: { ...identity, title: 'new title' }, ...extra });

// API の状態と保存内容を保持する。省略された PATCH のキーは既存値を維持する。
function fixture({ exists = true, state = 'PUBLISH', content = {}, reservationTime = null,
  failPut = false, failState = false, denyRead = false, retry = [] } = {}) {
  const calls = [];
  const stored = { ...identity, title: 'old title', description: 'old description', ...content };
  let currentState = state;
  let present = exists;
  const client = createClient({ domain: 'svc', apiKey: 'test-key', sleep: async () => {},
    fetch: async (url, init) => {
      const body = init.body instanceof FormData ? null : init.body ? JSON.parse(init.body) : null;
      const method = init.method ?? 'GET';
      calls.push({ url, method, body });
      const respond = (status, payload = {}) => new Response(JSON.stringify(payload), { status });
      if (retry.length) return respond(retry.shift());
      if (url.endsWith('/media')) return respond(201, { url: 'https://images.microcms-assets.io/a.png' });
      if (url.includes('.microcms-management.io')) {
        if (denyRead && method === 'GET') return respond(403);
        if (url.endsWith('/status')) {
          if (!failState) currentState = body.status[0];
          return respond(200);
        }
        if (!present) return respond(404);
        return respond(200, { id: 'post-123', status: [currentState],
          draftKey: currentState === 'DRAFT' ? 'secret-draft-key' : null, reservationTime });
      }
      if (method === 'GET') return respond(200, stored);
      if (method === 'PUT') {
        if (failPut || present) return respond(400, { message: 'validation failed' });
        present = true;
        currentState = new URL(url).searchParams.get('status') === 'closed' ? 'CLOSED' : 'DRAFT';
        for (const key of Object.keys(stored)) delete stored[key];
        Object.assign(stored, body);
        return respond(201);
      }
      assert.equal(method, 'PATCH');
      assert.ok(currentState !== 'CLOSED');
      assert.equal(new URL(url).searchParams.get('status') === 'draft', currentState === 'DRAFT');
      Object.assign(stored, body);
      return respond(200);
    },
  });
  return { client, calls, stored, state: () => currentState };
}
const writes = (f) => f.calls.filter((c) => ['PUT', 'PATCH', 'POST', 'DELETE'].includes(c.method));

// 初回作成は空値を省略し、0・false は残す。公開日時は公開後に設定する。
{
  const f = fixture({ exists: false });
  const content = { ...identity, title: 'new', description: '', count: 0, featured: false,
    category: {}, tags: [], score: null, publishedAt: '2020-01-01T00:00:00Z' };
  assert.equal((await f.client.upsert(item({ content }))).action, 'created');
  const put = f.calls.find((c) => c.method === 'PUT');
  assert.deepEqual(put.body, { ...identity, title: 'new', count: 0, featured: false });
  assert.equal(f.state(), 'PUBLISH');
  assert.equal(f.stored.publishedAt, content.publishedAt);
}
// 公開・下書きの全組合せで、内容と最終状態が一致する。
for (const state of ['DRAFT', 'PUBLISH']) for (const target of ['DRAFT', 'PUBLISH']) {
  const f = fixture({ state });
  await f.client.upsert(item({ status: target === 'DRAFT' ? 'draft' : undefined }));
  assert.equal(f.state(), target);
  assert.equal(f.stored.title, 'new title');
  if (state !== target) assert.equal(writes(f).filter((c) => c.url.endsWith('/status')).length, 1);
}
// PATCH では型ごとの空値を保持し、管理外のキーは維持する。
{
  const f = fixture({ content: { custom: { fieldId: 'seo', title: 'old' }, external: 'keep' } });
  const content = { ...identity, description: '', score: null, category: {}, tags: [], custom: {} };
  await f.client.upsert(item({ content }));
  for (const [key, value] of Object.entries(content)) assert.deepEqual(f.stored[key], value);
  assert.equal(f.stored.external, 'keep');
}
// 別の移行元・識別情報なしの ID 衝突は、本文も状態も変更しない。
for (const content of [{ legacyId: 'other' }, { legacyUrl: 'https://another.example.com/' }, { legacyId: undefined }]) {
  const f = fixture({ content });
  await assert.rejects(f.client.upsert(item({ status: 'draft' })), /ID 衝突/);
  assert.equal(writes(f).length, 0);
}
// 存在確認に失敗した場合と PUT 400 は PATCH にフォールバックしない。
{
  const f = fixture({ denyRead: true });
  await assert.rejects(f.client.upsert(item()), /存在確認 失敗: 403/);
  assert.equal(writes(f).length, 0);
}
{
  const f = fixture({ exists: false, failPut: true });
  await assert.rejects(f.client.upsert(item()), /PUT 失敗: 400/);
  assert.deepEqual(writes(f).map((c) => c.method), ['PUT']);
}
// 対応していない状態や予約は、自動で状態変更・更新しない。
for (const options of [{ state: 'CLOSED' }, { state: 'PUBLISH_AND_DRAFT' },
  { reservationTime: { publishTime: '2027-01-01T00:00:00Z' } }]) {
  const f = fixture(options);
  await assert.rejects(f.client.upsert(item()));
  assert.equal(writes(f).length, 0);
}
{
  const f = fixture();
  await assert.rejects(f.client.upsert(item({ status: 'closed' })), /公開状態/);
  assert.equal(writes(f).length, 0);
}
// API が 200 を返しても状態が変わっていなければ失敗。
{
  const f = fixture({ state: 'DRAFT', failState: true });
  await assert.rejects(f.client.upsert(item()), /反映されていません/);
}
// 大きな PATCH は公開を止める前に拒否する。
{
  const f = fixture();
  await assert.rejects(f.client.upsert(item({ status: 'draft', content: { ...identity, body: 'a'.repeat(100000) } })), /PATCH の上限/);
  assert.equal(writes(f).length, 0);
}
// 新規下書き・公開終了も最終状態を確認する。
for (const status of ['draft', 'closed']) {
  const f = fixture({ exists: false });
  assert.equal((await f.client.upsert(item({ status }))).action, 'created');
  assert.equal(f.state(), status === 'draft' ? 'DRAFT' : 'CLOSED');
}
// 通信の 429 / 5xx は再試行する。
{
  const f = fixture({ retry: [429, 503] });
  await f.client.upsert(item());
  assert.equal(f.calls.filter((c) => c.method === 'GET' && c.url.includes('/contents/')).length, 4);
}
{
  const f = fixture();
  assert.equal(await f.client.uploadMedia({ bytes: Buffer.from('x'), filename: 'a.png', type: 'image/png' }), 'https://images.microcms-assets.io/a.png');
}
// ローカル検査は空値を禁止せず、識別情報の不整合を拒否する。
assert.deepEqual(checkItem(item()), { errors: [], warnings: [] });
assert.deepEqual(checkItem(item({ content: { ...identity, description: '', score: null } })).errors, []);
assert.match(checkItem(item({ identity: undefined })).errors.join(), /identity/);
assert.match(checkItem(item({ content: { ...identity, legacyId: 'other' } })).errors.join(), /一致/);
assert.match(checkItem(item({ status: 'draft', content: { ...identity, publishedAt: '2020-01-01T00:00:00Z' } })).errors.join(), /publishedAt/);
assert.match(checkItem(item({ content: { ...identity, body: 'あ'.repeat(40000) } })).warnings[0], /PATCH の上限/);
assert.match(checkItem(item({ content: { ...identity, body: 'a'.repeat(310000) } })).errors[0], /PUT の上限/);
assert.match(checkItem(item({ status: 'publish' })).errors[0], /status が不正/);

// 掲載した --env-file の起動方法と dry-run を実際の Node プロセスで確認する。
const dir = mkdtempSync(join(tmpdir(), 'microcms-migration-test-'));
try {
  writeFileSync(join(dir, '.env'), 'MICROCMS_SERVICE_DOMAIN=fixture\nMICROCMS_API_KEY=fixture-key\n');
  const env = { ...process.env };
  delete env.MICROCMS_SERVICE_DOMAIN;
  delete env.MICROCMS_API_KEY;
  const probe = spawnSync(process.execPath, ['--env-file=.env', '--input-type=module', '-e',
    'if (process.env.MICROCMS_SERVICE_DOMAIN !== "fixture" || process.env.MICROCMS_API_KEY !== "fixture-key") process.exit(1)'], { cwd: dir, env });
  assert.equal(probe.status, 0, probe.stderr.toString());
  writeFileSync(join(dir, 'items.json'), JSON.stringify([item({ content: { ...identity, description: '' } })]));
  const run = spawnSync(process.execPath, ['--env-file=.env', fileURLToPath(new URL('./upsert.mjs', import.meta.url)), 'items.json', '--dry-run'], { cwd: dir, env });
  assert.equal(run.status, 0, run.stderr.toString());
  assert.equal(readFileSync(join(dir, 'logs/upsert-check.ndjson'), 'utf8'), '');

  // WXR の重複 meta は配列を平坦化せず、元レコードも残す。
  const wxrPath = join(dir, 'input.xml');
  const wxrScript = fileURLToPath(new URL('./wxr-to-json.mjs', import.meta.url));
  const post = (kind, meta = '') => `<item><wp:post_id>1</wp:post_id><wp:post_type>${kind}</wp:post_type><wp:status>publish</wp:status>${meta}</item>`;
  const wxr = (body) => `<rss><channel><title>fixture</title>${body}</channel></rss>`;
  const meta = (key, value) => `<wp:postmeta><wp:meta_key>${key}</wp:meta_key><wp:meta_value><![CDATA[${value}]]></wp:meta_value></wp:postmeta>`;
  writeFileSync(wxrPath, wxr(post('post', meta('repeated', 'a:2:{i:0;i:1;i:1;i:2;}') + meta('repeated', 'a:2:{i:0;i:3;i:1;i:4;}') + meta('single', 'a:2:{i:0;i:5;i:1;i:6;}'))));
  const convert = (output) => spawnSync(process.execPath, [wxrScript, wxrPath, output], { cwd: dir });
  assert.equal(convert('raw').status, 0);
  const original = readFileSync(join(dir, 'raw/post.json'), 'utf8');
  const converted = JSON.parse(original)[0];
  assert.deepEqual(converted.meta.repeated, [[1, 2], [3, 4]]);
  assert.deepEqual(converted.meta.single, [5, 6]);
  assert.deepEqual(converted.metaEntries, [
    { key: 'repeated', value: [1, 2] }, { key: 'repeated', value: [3, 4] }, { key: 'single', value: [5, 6] },
  ]);
  // 再変換は古い出力を変更しない。別の空ディレクトリには最新データだけ出す。
  writeFileSync(wxrPath, wxr(post('page')));
  const refused = convert('raw');
  assert.equal(refused.status, 1);
  assert.match(refused.stderr.toString(), /出力先が空ではありません/);
  assert.equal(readFileSync(join(dir, 'raw/post.json'), 'utf8'), original);
  mkdirSync(join(dir, 'raw-final'));
  assert.equal(convert('raw-final').status, 0);
  assert.equal(existsSync(join(dir, 'raw-final/post.json')), false);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, 'raw-final/counts.json'), 'utf8')), { page: { publish: 1 } });

  // メディア CLI を通信モック付きの別プロセスで実行する。
  const uploads = join(dir, 'uploads');
  mkdirSync(uploads);
  writeFileSync(join(dir, 'outside.txt'), 'outside-fixture');
  symlinkSync(join(dir, 'outside.txt'), join(uploads, 'outside-link.png'));
  const mock = join(dir, 'mock-fetch.mjs');
  const uploadedLog = join(dir, 'uploaded.ndjson');
  writeFileSync(uploadedLog, '');
  writeFileSync(mock, `import { appendFileSync } from 'node:fs';
    globalThis.fetch = async (url, init) => {
      if (!url.endsWith('.microcms-management.io/api/v1/media') || init.method !== 'POST') throw new Error('unexpected fetch');
      const text = await init.body.get('file').text();
      appendFileSync(${JSON.stringify(uploadedLog)}, JSON.stringify(text) + String.fromCharCode(10));
      return new Response(JSON.stringify({url: 'https://images.microcms-assets.io/' + encodeURIComponent(text)}), {status: 201});
    };`);
  const mediaScript = fileURLToPath(new URL('./upload-media.mjs', import.meta.url));
  const mediaInput = join(dir, 'media-input.json');
  const skippedPath = join(dir, 'media-skipped.json');
  const mediaEnv = { ...env, MICROCMS_SERVICE_DOMAIN: 'fixture', MICROCMS_API_KEY: 'fixture-key' };
  const runMedia = (entries, extra = []) => {
    writeFileSync(mediaInput, JSON.stringify(entries));
    const result = spawnSync(process.execPath, ['--import', mock, mediaScript, ...extra, mediaInput, '--uploads', uploads], { cwd: dir, env: mediaEnv });
    assert.ok(existsSync(skippedPath), result.stderr.toString());
    return result;
  };
  const skipped = () => JSON.parse(readFileSync(skippedPath, 'utf8'));
  const mediaMap = () => JSON.parse(readFileSync(join(dir, 'media-map.json'), 'utf8'));
  const uploaded = () => readFileSync(uploadedLog, 'utf8').trim().split('\n').filter(Boolean).map((s) => JSON.parse(s));
  const escape = 'https://old.example/wp-content/uploads/..%2foutside.txt';
  const link = 'https://old.example/wp-content/uploads/outside-link.png';
  assert.equal(runMedia([escape, link]).status, 1);
  assert.equal(uploaded().length, 0);
  assert.equal(skipped().length, 2);
  assert.ok(skipped().every((entry) => /uploads の外/.test(entry.reason)));
  // 次のシナリオは独立した未解決一覧で開始。
  writeFileSync(skippedPath, '[]');
  const first = 'https://old.example/wp-content/uploads/first.png';
  const second = 'https://old.example/wp-content/uploads/second.png';
  assert.equal(runMedia([first, second]).status, 1);
  assert.equal(skipped().length, 2);
  writeFileSync(join(uploads, 'first.png'), 'first-version');
  assert.equal(runMedia([first]).status, 1); // second は未解決のまま
  assert.deepEqual(skipped().map((entry) => entry.url), [second]);
  const firstUrl = mediaMap()[first];
  writeFileSync(join(uploads, 'second.png'), 'second-version');
  assert.equal(runMedia([second]).status, 0);
  assert.equal(skipped().length, 0);
  assert.equal(uploaded().length, 2);
  // 通常の再開では再送しない。差し替え指定では新ファイルを送って対応表を更新する。
  writeFileSync(join(uploads, 'first.png'), 'replacement-version');
  assert.equal(runMedia([first]).status, 0);
  assert.equal(uploaded().length, 2);
  assert.equal(mediaMap()[first], firstUrl);
  assert.equal(runMedia([first], ['--force']).status, 0); // オプションが入力より前でも受け付ける
  assert.equal(uploaded().length, 3);
  assert.equal(uploaded().at(-1), 'replacement-version');
  assert.notEqual(mediaMap()[first], firstUrl);
  assert.equal(mediaMap()[second], 'https://images.microcms-assets.io/second-version');

} finally {
  rmSync(dir, { recursive: true, force: true });
}
console.log('ok');
