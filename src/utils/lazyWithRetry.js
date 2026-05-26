import React from 'react';

// タイムアウト付きPromiseラッパー
const withTimeout = (promise, timeoutMs, errorMessage = 'タイムアウトしました') => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
};

// A tiny helper that retries loading React.lazy chunks when transient
// network/CDN errors (e.g., GitHub Pages 429) occur. It retries with
// exponential backoff and surfaces the final error to React's error
// boundary if all attempts fail.
// タイムアウト設定付き（デフォルト15秒）
export default function lazyWithRetry(
  importer,
  { retries = 2, delay = 700, timeout = 30000 } = {}
) {
  const shouldRetry = (err) => {
    const message = (err && err.message) || '';
    // 429/503 from CDNs come through as TypeError: Failed to fetch...
    return (
      err?.name === 'TypeError' ||
      /Failed to fetch/i.test(message) ||
      /Loading chunk \d+ failed/i.test(message) ||
      /NetworkError/i.test(message) ||
      /ERR_(INTERNET|CONNECTION)/i.test(message) ||
      /タイムアウト/i.test(message)
    );
  };

  const importWithTimeout = () => withTimeout(
    importer(),
    timeout,
    'コンポーネントの読み込みがタイムアウトしました'
  );

  return React.lazy(async () => {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await importWithTimeout();
      } catch (error) {
        lastError = error;
        if (attempt >= retries || !shouldRetry(error)) {
          break;
        }
        const wait = delay * 2 ** attempt;
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
    }

    throw lastError;
  });
}
