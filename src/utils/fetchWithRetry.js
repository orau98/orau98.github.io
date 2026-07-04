// 一時的な失敗（ネットワーク断・429/502/503/504）だけを指数バックオフで再試行する
// 共有fetchヘルパー。404などの決定的なエラーは再試行しない。
// 以前は App.jsx と services/imageIndex.js がそれぞれ別実装を持っていた。
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function fetchWithRetry(url, opts = {}, {
  retries = 2,
  delay = 250,
  // trueなら最終的に !res.ok を Error(err.status付き) として投げる
  // （呼び出し側が catch でフォールバックする imageIndex 系の契約）。
  // falseならレスポンスをそのまま返し、呼び出し側が res.ok を見る（App系の契約）。
  throwOnHttpError = false,
  // 過負荷系(429/503)はサーバ保護のため最低これだけ待ってから再試行する
  minProtectedDelayMs = 0,
} = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let res = null;
    try {
      res = await fetch(url, opts);
    } catch (error) {
      lastError = error;
      if (opts.signal?.aborted || attempt >= retries) throw error;
      await sleep(delay * Math.pow(2, attempt));
      continue;
    }
    if (RETRYABLE_STATUSES.has(res.status) && attempt < retries) {
      const backoff = delay * Math.pow(2, attempt);
      const isProtected = res.status === 429 || res.status === 503;
      await sleep(isProtected ? Math.max(minProtectedDelayMs, backoff) : backoff);
      continue;
    }
    if (throwOnHttpError && !res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res;
  }
  throw lastError || new Error('fetch failed');
}
