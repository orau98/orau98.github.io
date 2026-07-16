const sanitizeMeasurementId = (value) =>
  String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9-]/g, '');

export function buildAnalyticsHeadTags(measurementId) {
  const safeMeasurementId = sanitizeMeasurementId(measurementId);
  if (!safeMeasurementId) return '';

  return `<script>
  (function () {
    var measurementId = '${safeMeasurementId}';
    var persistentKey = 'orau98.analytics.optOut';
    var sessionKey = 'orau98.analytics.qaSession';
    var params;
    try {
      params = new URLSearchParams(window.location.search || '');
    } catch (e) {
      params = new URLSearchParams();
    }

    var analyticsMode = params.get('analytics');
    var qaMode = params.get('qa');
    var disabled = analyticsMode === 'off' || qaMode === '1';
    try {
      if (analyticsMode === 'on') {
        localStorage.removeItem(persistentKey);
        sessionStorage.removeItem(sessionKey);
        disabled = false;
      } else {
        if (analyticsMode === 'off') localStorage.setItem(persistentKey, '1');
        if (qaMode === '1') sessionStorage.setItem(sessionKey, '1');
        if (qaMode === '0') sessionStorage.removeItem(sessionKey);
        disabled = disabled || localStorage.getItem(persistentKey) === '1' || sessionStorage.getItem(sessionKey) === '1';
      }
    } catch (e) {}

    window['ga-disable-' + measurementId] = disabled;
    if (disabled) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
    var analytics = document.createElement('script');
    analytics.async = true;
    analytics.src = 'https://www.googletagmanager.com/gtag/js?id=' + measurementId;
    document.head.appendChild(analytics);
    window.gtag('js', new Date());
    window.gtag('config', '${safeMeasurementId}');
  })();
</script>`;
}
