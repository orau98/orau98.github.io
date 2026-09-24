const GA_MEASUREMENT_ID = 'G-MFEQF99G0H';
const ANALYTICS_OPT_OUT_KEY = 'orau98.analytics.optOut';
const ANALYTICS_QA_SESSION_KEY = 'orau98.analytics.qaSession';

const safeStorageGet = (storage, key) => {
  try {
    return storage?.getItem?.(key) || '';
  } catch {
    return '';
  }
};

const safeStorageSet = (storage, key, value) => {
  try {
    storage?.setItem?.(key, value);
  } catch {}
};

const safeStorageRemove = (storage, key) => {
  try {
    storage?.removeItem?.(key);
  } catch {}
};

/**
 * AI・管理者の本番確認を通常利用者の指標へ混ぜないための小さな制御面。
 *
 * - `?qa=1`: 現在のタブを閉じるまで計測しない
 * - `?analytics=off`: このブラウザでは継続して計測しない
 * - `?analytics=on`: 上記の除外状態を解除する
 */
export function syncAnalyticsPreference({ search } = {}) {
  if (typeof window === 'undefined') return false;

  let params;
  try {
    params = new URLSearchParams(search ?? window.location?.search ?? '');
  } catch {
    params = new URLSearchParams();
  }

  const analyticsMode = params.get('analytics');
  const qaMode = params.get('qa');

  if (analyticsMode === 'on') {
    safeStorageRemove(window.localStorage, ANALYTICS_OPT_OUT_KEY);
    safeStorageRemove(window.sessionStorage, ANALYTICS_QA_SESSION_KEY);
  } else {
    if (analyticsMode === 'off') {
      safeStorageSet(window.localStorage, ANALYTICS_OPT_OUT_KEY, '1');
    }
    if (qaMode === '1') {
      safeStorageSet(window.sessionStorage, ANALYTICS_QA_SESSION_KEY, '1');
    } else if (qaMode === '0') {
      safeStorageRemove(window.sessionStorage, ANALYTICS_QA_SESSION_KEY);
    }
  }

  const disabled =
    analyticsMode !== 'on' &&
    (analyticsMode === 'off' ||
      qaMode === '1' ||
      safeStorageGet(window.localStorage, ANALYTICS_OPT_OUT_KEY) === '1' ||
      safeStorageGet(window.sessionStorage, ANALYTICS_QA_SESSION_KEY) === '1');

  // Google Analytics公式のオプトアウトフラグ。SPA内の自動計測にも効かせる。
  window[`ga-disable-${GA_MEASUREMENT_ID}`] = disabled;
  return disabled;
}

export function trackEvent(eventName, parameters = {}) {
  if (
    typeof window === 'undefined' ||
    typeof window.gtag !== 'function' ||
    !eventName ||
    syncAnalyticsPreference()
  ) {
    return false;
  }

  window.gtag('event', eventName, {
    send_to: GA_MEASUREMENT_ID,
    ...parameters,
  });
  return true;
}

export function getPageViewPath({ pathname = '/' } = {}) {
  return pathname || '/';
}

export function trackPageView({ pathname = '/' } = {}) {
  // 検索語・タブ・絞り込み・ページ番号は同じExplorer画面内の状態であり、
  // 実ページ表示として数えない。SPAのpathname遷移だけをpage_viewにする。
  const pagePath = getPageViewPath({ pathname });
  const origin = typeof window !== 'undefined' ? window.location?.origin : '';
  if (!origin) return false;
  const pageLocation = new URL(pagePath, origin).toString();

  return trackEvent('page_view', {
    page_title: document.title || '昆虫植物図鑑',
    page_path: pagePath,
    page_location: pageLocation,
  });
}

export function trackLegacyMetaLanding({ sourcePath = '', targetPath = '' } = {}) {
  const legacyPath = String(sourcePath || '').trim();
  const cleanPath = String(targetPath || '').trim();
  if (!legacyPath || !cleanPath) return false;

  return trackEvent('legacy_meta_landing', {
    legacy_path: legacyPath.slice(0, 200),
    clean_path: cleanPath.slice(0, 200),
  });
}

export function trackSearch({ query = '', scope = '', source = 'submit' } = {}) {
  const searchTerm = String(query || '').trim();
  if (!searchTerm) return false;
  return trackEvent('search', {
    search_term: searchTerm.slice(0, 100),
    search_scope: String(scope || '').slice(0, 40),
    search_source: String(source || '').slice(0, 40),
  });
}

// 検索しても1件も見つからなかった語。別名（例: ナミアゲハ）の追加などデータ改善の手がかりにする
export function trackSearchNoResults({ query = '', scope = '' } = {}) {
  const searchTerm = String(query || '').trim();
  if (!searchTerm) return false;
  return trackEvent('search_no_results', {
    search_term: searchTerm.slice(0, 100),
    search_scope: String(scope || '').slice(0, 40),
  });
}

export function trackDetailSelection({ path = '', contentType = '', source = 'internal_link' } = {}) {
  const itemId = String(path || '').trim();
  if (!itemId) return false;
  return trackEvent('select_content', {
    content_type: String(contentType || 'detail').slice(0, 40),
    item_id: itemId.slice(0, 200),
    selection_source: String(source || '').slice(0, 40),
  });
}

export function trackCrossSearch({ query = '', fromScope = '', toScope = '' } = {}) {
  const searchTerm = String(query || '').trim();
  if (!searchTerm) return false;
  return trackEvent('cross_search', {
    search_term: searchTerm.slice(0, 100),
    from_scope: String(fromScope || '').slice(0, 40),
    to_scope: String(toScope || '').slice(0, 40),
  });
}

// ---- エラーの見える化 ----
// 利用者の画面で起きたエラー（データの読み込み失敗・画面の不具合など）を件数として把握する。
// GA4 推奨の exception イベントで送る。同じエラーは1ページにつき1回、合計も上限つき。
const MAX_ERROR_REPORTS_PER_PAGE = 10;
const reportedErrorKeys = new Set();

// 無害・対処不能なものは送らない（拡張機能・他サイトのスクリプト・ページ移動で中断した通信など）
const IGNORED_ERROR_PATTERN =
  /ResizeObserver loop|^Script error\.?$|AbortError|aborted/i;

const toErrorText = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value.message === 'string' && value.message) return value.message;
  try {
    return String(value);
  } catch {
    return '';
  }
};

// URLは同じサイト内ならパスだけ、外部ならドメインだけにする（検索語など余計な情報を送らない）
export function sanitizeErrorText(value, origin = '') {
  return toErrorText(value)
    .replace(/https?:\/\/[^\s)'"]+/g, (rawUrl) => {
      try {
        const url = new URL(rawUrl);
        return origin && url.origin === origin ? url.pathname : url.origin;
      } catch {
        return '[url]';
      }
    })
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150);
}

export function shouldIgnoreError(message = '') {
  const text = String(message || '').trim();
  return !text || IGNORED_ERROR_PATTERN.test(text);
}

/**
 * kind: 'js_error' | 'unhandled_rejection' | 'chunk_load' | 'render_error' | 'data_load' など
 * fatal: 利用者がそのページを使えなくなったもの（読み込み失敗の表示・画面エラー）
 */
export function trackError({ kind = 'error', error = null, message = '', fatal = false } = {}) {
  if (typeof window === 'undefined') return false;
  const origin = window.location?.origin || '';
  const text = sanitizeErrorText(message || error, origin);
  if (shouldIgnoreError(text)) return false;
  const errorKind = String(kind || 'error').slice(0, 40);
  const key = `${errorKind}:${text}`;
  if (reportedErrorKeys.has(key) || reportedErrorKeys.size >= MAX_ERROR_REPORTS_PER_PAGE) return false;
  reportedErrorKeys.add(key);
  return trackEvent('exception', {
    description: `${errorKind}: ${text}`.slice(0, 150),
    fatal: Boolean(fatal),
    error_kind: errorKind,
    page_path: String(window.location?.pathname || '').slice(0, 200),
  });
}

// テスト用: 送信済みの記録を消す
export function resetTrackedErrorsForTest() {
  reportedErrorKeys.clear();
}
