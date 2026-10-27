// 参考実装・無保証。そのまま使わず、案件の migration/scripts/ にコピーし、中身を確認・修正してから使うこと。
// microCMS への書き込みの共通部品: 認証・回数制限・再試行・upsert・メディアアップロード
// 依存なし (Node.js 24+)。fetch と sleep は差し替え可能 (test.mjs から使う)

export const LIMITS = {
  writeIntervalMs: 220, // 書き込み: 毎秒 5 回
  managementIntervalMs: 1100, // マネジメント API: IP ごとに 10 秒で 10 回
  mediaMaxBytes: 5 * 1024 * 1024,
  putMaxBytes: 300 * 1000,
  patchMaxBytes: 90 * 1000,
  // 1 コンテンツ約 200KB の保存サイズは内部 DB の計算方式で、送る JSON からは測れないので検査しない
};

export function createClient({
  domain = process.env.MICROCMS_SERVICE_DOMAIN,
  apiKey = process.env.MICROCMS_API_KEY,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  maxRetries = 6,
} = {}) {
  if (!domain || !apiKey) throw new Error('MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY を設定してください');
  const contentBase = `https://${domain}.microcms.io/api/v1`;
  const managementBase = `https://${domain}.microcms-management.io/api/v1`;
  const last = { write: 0, management: 0 };
  const interval = { write: LIMITS.writeIntervalMs, management: LIMITS.managementIntervalMs };

  // 回数制限に合わせて間隔を空け、429 と 5xx は指数バックオフで再試行する
  async function request(bucket, url, init = {}) {
    for (let attempt = 0; ; attempt++) {
      const wait = last[bucket] + interval[bucket] - Date.now();
      if (wait > 0) await sleep(wait);
      last[bucket] = Date.now();
      let res;
      try {
        res = await fetch(url, { ...init, headers: { 'X-MICROCMS-API-KEY': apiKey, ...init.headers } });
      } catch (e) {
        if (attempt >= maxRetries) throw e;
        await sleep(500 * 2 ** attempt);
        continue;
      }
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      return res;
    }
  }

  const bodyText = async (res) => `${res.status} ${await res.text().catch(() => '')}`.trim();

  async function requireOk(res, operation) {
    if (!res.ok) throw new Error(`${operation} 失敗: ${await bodyText(res)}`);
    return res;
  }

  // 存在確認と移行元の照合を先に行う。PUT の 400 は更新の根拠にしない。
  async function upsert(item) {
    const { errors } = checkItem(item);
    if (errors.length) throw new Error(errors.join(' / '));
    const { endpoint, id, status, content, identity } = item;
    const path = `${encodeURIComponent(endpoint)}/${encodeURIComponent(id)}`;
    const url = `${contentBase}/${path}`;
    const metaUrl = `${managementBase}/contents/${path}`;
    const desired = status === 'draft' ? 'DRAFT' : status === 'closed' ? 'CLOSED' : 'PUBLISH';
    const json = (body) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const getMeta = () => request('management', metaUrl);
    const stateOf = (meta) => {
      // API のレスポンス例では status は配列。
      if (!Array.isArray(meta.status) || meta.status.length !== 1) throw new Error('公開状態を判定できません');
      return meta.status[0];
    };
    const setState = async (state) => {
      await requireOk(await request('management', `${metaUrl}/status`, {
        method: 'PATCH', ...json({ status: [state] }),
      }), '公開状態の変更');
      const meta = await (await requireOk(await getMeta(), '公開状態の確認')).json();
      if (stateOf(meta) !== state) throw new Error('公開状態の変更が反映されていません');
    };
    const patch = async (body, draft) => {
      if (!Object.keys(body).length) return;
      if (Buffer.byteLength(JSON.stringify(body)) > LIMITS.patchMaxBytes) throw new Error('PATCH の上限 (約90KB) を超えています');
      await requireOk(await request('write', `${url}${draft ? '?status=draft' : ''}`, {
        method: 'PATCH', ...json(body),
      }), '本文の更新');
    };

    const res = await getMeta();
    const exists = res.ok;
    if (!exists && res.status !== 404) await requireOk(res, '存在確認');
    let current;
    if (exists) {
      const meta = await res.json();
      current = stateOf(meta);
      const query = meta.draftKey ? `?draftKey=${encodeURIComponent(meta.draftKey)}` : '';
      const stored = await (await requireOk(await request('write', `${url}${query}`), '移行元の照合')).json();
      if (!Object.entries(identity).every(([key, value]) => stored[key] === value)) {
        throw new Error('ID 衝突: 移行元の識別情報が一致しないため更新しません');
      }
      if (meta.reservationTime?.publishTime || meta.reservationTime?.stopTime) {
        throw new Error('予約設定があります。扱いを確認し、予約を外してから流し直してください');
      }
      if (!['DRAFT', 'PUBLISH'].includes(current) || desired === 'CLOSED') {
        throw new Error('この公開状態の更新は参考実装では扱えません。管理画面で状態を確認してください');
      }
      if (Buffer.byteLength(JSON.stringify(content)) > LIMITS.patchMaxBytes) {
        throw new Error('PATCH の上限 (約90KB) を超えています。公開状態も変更しません');
      }
      // 公開中の内容を下書きにする場合、公開を止めてから本文を更新する。
      if (current === 'PUBLISH' && desired === 'DRAFT') {
        await setState('DRAFT');
        current = 'DRAFT';
      }
      const { publishedAt, ...draftContent } = content;
      await patch(current === 'DRAFT' ? draftContent : content, current === 'DRAFT');
    } else {
      // 公開日時は、下書きから公開したあとに設定する。公開終了は PUT で直接作る。
      const { publishedAt, ...draftContent } = content;
      const initial = desired === 'CLOSED' ? content : draftContent;
      await requireOk(await request('write', `${url}?status=${desired === 'CLOSED' ? 'closed' : 'draft'}`, {
        method: 'PUT', ...json(omitEmptyForCreate(initial)),
      }), 'PUT');
      current = desired === 'CLOSED' ? 'CLOSED' : 'DRAFT';
    }
    if (current === 'DRAFT' && desired === 'PUBLISH') {
      await setState('PUBLISH');
      if (content.publishedAt !== undefined) await patch({ publishedAt: content.publishedAt }, false);
    }
    const finalMeta = await (await requireOk(await getMeta(), '最終公開状態の確認')).json();
    if (stateOf(finalMeta) !== desired) throw new Error('最終公開状態が移行元と一致しません');
    return { action: exists ? 'updated' : 'created' };
  }

  async function uploadMedia({ bytes, filename, type }) {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), filename);
    const res = await request('management', `${managementBase}/media`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`メディアのアップロード失敗: ${await bodyText(res)}`);
    return (await res.json()).url;
  }

  return { request, upsert, uploadMedia };
}

// 書き込む前の検査。エラーは登録できないもの、警告は登録できるが確認が必要なもの
export function checkItem(item) {
  const errors = [];
  const warnings = [];
  if (!item || typeof item !== 'object' || Array.isArray(item)) return { errors: ['オブジェクトではありません'], warnings };
  if (!item.endpoint) errors.push('endpoint がありません');
  if (!item.id) errors.push('id がありません');
  if (!item.content || typeof item.content !== 'object' || Array.isArray(item.content)) errors.push('content はオブジェクトで指定してください');
  if (item.status && !['draft', 'closed'].includes(item.status)) errors.push(`status が不正: ${item.status}`);
  if (item.status === 'draft' && item.content && typeof item.content === 'object' && 'publishedAt' in item.content) errors.push('下書きでは publishedAt を指定できません');
  // ID だけでなく元サイトと元コンテンツの両方を照合する。
  if (!item.identity || typeof item.identity !== 'object' || Array.isArray(item.identity)
      || !['legacyId', 'legacyUrl'].every((key) =>
        (typeof item.identity[key] === 'string' && item.identity[key].length > 0)
        || (key === 'legacyId' && typeof item.identity[key] === 'number' && Number.isFinite(item.identity[key])))) {
    errors.push('identity に legacyId と legacyUrl を指定してください');
  } else if (!Object.entries(item.identity).every(([key, value]) => item.content?.[key] === value)) {
    errors.push('identity と content の識別情報が一致しません');
  }
  if (errors.length) return { errors, warnings };

  const bytes = Buffer.byteLength(JSON.stringify(item.content));
  if (bytes > LIMITS.putMaxBytes) errors.push(`リクエスト ${bytes} バイトが PUT の上限 (約300KB) を超えています`);
  else if (bytes > LIMITS.patchMaxBytes) warnings.push(`リクエスト ${bytes} バイトは PATCH の上限 (約90KB) 超え。流し直しで更新できません`);

  return { errors, warnings };
}

// 新規作成では空値を省略する。PATCH には適用しない（省略すると既存値が残る）。
export function omitEmptyForCreate(value) {
  if (value === null || value === '') return undefined;
  if (Array.isArray(value)) {
    const entries = value.map(omitEmptyForCreate).filter((v) => v !== undefined);
    return entries.length ? entries : undefined;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => [k, omitEmptyForCreate(v)]).filter(([, v]) => v !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value;
}
