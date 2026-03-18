const GA_MEASUREMENT_ID = 'G-MFEQF99G0H';

export function trackPageView({ pathname = '/', search = '', hash = '' } = {}) {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return false;
  }

  const pagePath = `${pathname || '/'}${search || ''}${hash || ''}` || '/';
  const pageLocation = new URL(pagePath, window.location.origin).toString();

  window.gtag('event', 'page_view', {
    send_to: GA_MEASUREMENT_ID,
    page_title: document.title || '昆虫植物図鑑',
    page_path: pagePath,
    page_location: pageLocation,
  });

  return true;
}
