/*
 * ネットワーク優先のService Worker。
 *
 * 方針:
 * - 常にネットワークから最新を取得し、成功したGETレスポンスをキャッシュに複製する
 * - ネットワークが失敗したとき（オフライン・圏外）だけキャッシュから返す
 * - プリキャッシュは行わない（古いHTML/JSを配り続ける事故を構造的に避ける）
 * - 外部オリジン（GA/AdSense/Instagram等）には一切関与しない
 *
 * これにより、野外など電波の悪い環境での再訪時に、
 * 一度見たページ・データ・画像をオフラインでも閲覧できる。
 */
const CACHE_NAME = 'ihpe-offline-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok && (response.type === 'basic' || response.type === 'default')) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch (error) {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        if (cached) return cached;
        // ナビゲーションはSPAシェルでフォールバック（React Routerが描画する）
        if (request.mode === 'navigate') {
          const shell =
            (await cache.match('/index.html')) || (await cache.match('/'));
          if (shell) return shell;
        }
        throw error;
      }
    })(),
  );
});
