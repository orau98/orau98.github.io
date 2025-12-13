import React from 'react';

// A tiny helper that retries loading React.lazy chunks when transient
// network/CDN errors (e.g., GitHub Pages 429) occur. It retries with
// exponential backoff and surfaces the final error to React's error
// boundary if all attempts fail.
export default function lazyWithRetry(importer, { retries = 2, delay = 700 } = {}) {
  let attempt = 0;

  const shouldRetry = (err) => {
    const message = (err && err.message) || '';
    // 429/503 from CDNs come through as TypeError: Failed to fetch...
    return (
      err?.name === 'TypeError' ||
      /Failed to fetch/i.test(message) ||
      /Loading chunk \d+ failed/i.test(message) ||
      /NetworkError/i.test(message) ||
      /ERR_(INTERNET|CONNECTION)/i.test(message)
    );
  };

  return React.lazy(() =>
    importer().catch((error) => {
      if (attempt < retries && shouldRetry(error)) {
        const wait = delay * 2 ** attempt;
        attempt += 1;
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            importer().then(resolve).catch(reject);
          }, wait);
        });
      }
      throw error;
    }),
  );
}
