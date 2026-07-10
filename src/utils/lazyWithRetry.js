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

// Dynamic imports cannot be usefully retried with the same URL after a failed
// module fetch. Vite's preload-error handler performs the effective recovery
// (a full reload); this wrapper only adds a timeout and forwards the error.
export default function lazyWithRetry(
  importer,
  { timeout = 30000 } = {}
) {
  return React.lazy(() => withTimeout(
    importer(),
    timeout,
    'コンポーネントの読み込みがタイムアウトしました',
  ));
}
