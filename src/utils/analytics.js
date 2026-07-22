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

export function trackSearch({ query = '', scope = '', source = 'submit' } = {}) {
  const searchTerm = String(query || '').trim();
  if (!searchTerm) return false;
  return trackEvent('search', {
    search_term: searchTerm.slice(0, 100),
    search_scope: String(scope || '').slice(0, 40),
    search_source: String(source || '').slice(0, 40),
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
