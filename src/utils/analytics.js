const GA_MEASUREMENT_ID = 'G-MFEQF99G0H';

export function getPageViewPath({ pathname = '/' } = {}) {
  return pathname || '/';
}

export function trackPageView({ pathname = '/' } = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return false;
  }

  // 検索語・タブ・絞り込み・ページ番号は同じExplorer画面内の状態であり、
  // 実ページ表示として数えない。SPAのpathname遷移だけをpage_viewにする。
  const pagePath = getPageViewPath({ pathname });
  const pageLocation = new URL(pagePath, window.location.origin).toString();

  window.gtag('event', 'page_view', {
    send_to: GA_MEASUREMENT_ID,
    page_title: document.title || '昆虫植物図鑑',
    page_path: pagePath,
    page_location: pageLocation,
  });

  return true;
}
