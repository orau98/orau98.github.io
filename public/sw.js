/*
 * Service Worker。
 *
 * 方針:
 * - HTML/JS/データ(JSON/CSV)は「ネットワーク優先」: 常に最新を取得し、
 *   成功したGETレスポンスをキャッシュへ複製。ネットワーク失敗時のみキャッシュで代替。
 *   プリキャッシュは行わない（古いHTML/JSを配り続ける事故を構造的に避ける）。
 * - 画像は「stale-while-revalidate」: キャッシュがあれば即座に表示し、
 *   裏でネットワークから取り直してキャッシュを更新する。
 *   GitHub Pages は Cache-Control: max-age=600 のため、以前は10分以上経って
 *   戻ってくると全カード画像が条件付きGETのネットワーク往復を待ってから
 *   表示されていた（キャッシュに実体があるのにスピナーが並ぶ）。
 *   画像は差し替え頻度が低く、差し替え時も「次回訪問で最新化」で十分。
 * - 外部オリジン（GA/AdSense/Instagram等）には一切関与しない。
 */
const OFFLINE_CACHE = 'ihpe-offline-v1';
const IMAGE_CACHE = 'ihpe-images-v1';
const ACTIVE_CACHES = [OFFLINE_CACHE, IMAGE_CACHE];
// SPAシェルの正準キャッシュキー。実際のナビゲーションURLはクエリ付き
// （/?tab=insects 等）でキーが揺れるため、クエリなしの固定キーで別途保持する
const SHELL_URL = new URL('./', self.location.href).href;
// 画像キャッシュの上限（best-effort・挿入順で古いものから削除）。
// リサイズ画像は1枚あたり数十KBなので、上限到達時でも概ね数十MB規模に収まる
const IMAGE_CACHE_MAX_ENTRIES = 1000;

const isCacheableResponse = (response) =>
  !!response &&
  response.ok &&
  (response.type === 'basic' || response.type === 'default');

const isImageRequest = (request, url) =>
  request.destination === 'image' || url.pathname.includes('/images/');

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // シェルを1部だけ確保しておく（オフライン時のナビゲーション代替用）。
  // 初回訪問のナビゲーションはSW制御前に発生してfetchハンドラを通らないため、
  // ここで取得しないと「一度も開き直していないタブしか無い状態」で
  // オフラインフォールバックが空振りする。
  // ネットワークから今その場で取得するため、古いHTMLを配る事故にはならない。
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch(new Request(SHELL_URL, { cache: 'no-cache' }));
        if (isCacheableResponse(response)) {
          const cache = await caches.open(OFFLINE_CACHE);
          await cache.put(SHELL_URL, response);
        }
      } catch {}
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => !ACTIVE_CACHES.includes(key))
          .map((key) => caches.delete(key)),
      );
      // 旧SW時代にオフライン用キャッシュへ入った画像は今後参照されないため掃除する
      try {
        const offline = await caches.open(OFFLINE_CACHE);
        const requests = await offline.keys();
        await Promise.all(
          requests
            .filter((request) => new URL(request.url).pathname.includes('/images/'))
            .map((request) => offline.delete(request)),
        );
      } catch {}
      await self.clients.claim();
    })(),
  );
});

let trimming = false;
const trimImageCache = async (cache) => {
  if (trimming) return;
  trimming = true;
  try {
    const keys = await cache.keys();
    const excess = keys.length - IMAGE_CACHE_MAX_ENTRIES;
    for (let i = 0; i < excess; i += 1) {
      await cache.delete(keys[i]);
    }
  } catch {} finally {
    trimming = false;
  }
};

// 画像: キャッシュ即返し + 背景更新（未キャッシュ時はネットワーク待ち）
const handleImageRequest = async (event) => {
  const { request } = event;
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then((response) => {
    if (isCacheableResponse(response)) {
      cache
        .put(request, response.clone())
        .then(() => trimImageCache(cache))
        .catch(() => {});
    }
    return response;
  });

  if (cached) {
    // 背景更新の完了までSWを生かす（失敗は無視して次回に任せる）
    event.waitUntil(networkFetch.then(() => {}, () => {}));
    return cached;
  }
  return networkFetch;
};

// それ以外: ネットワーク優先 + オフライン時のみキャッシュ代替
const handleNetworkFirst = async (request) => {
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      const cache = await caches.open(OFFLINE_CACHE);
      cache.put(request, response.clone()).catch(() => {});
      // 成功したナビゲーション(=シェルHTML)は正準キーにも複製して常に最新へ更新
      if (request.mode === 'navigate') {
        cache.put(SHELL_URL, response.clone()).catch(() => {});
      }
    }
    return response;
  } catch (error) {
    const cache = await caches.open(OFFLINE_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    // ナビゲーションはSPAシェルでフォールバック（React Routerが描画する）
    if (request.mode === 'navigate') {
      const shell =
        (await cache.match(SHELL_URL)) ||
        // 正準キー導入前にクエリ付きで入った旧エントリも救済
        (await cache.match(SHELL_URL, { ignoreSearch: true }));
      if (shell) return shell;
    }
    throw error;
  }
};

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

  if (isImageRequest(request, url)) {
    event.respondWith(handleImageRequest(event));
    return;
  }
  event.respondWith(handleNetworkFirst(request));
});
