import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { isEnglishLocale } from '../utils/locale';
import logger from '../utils/logger';

const ADSENSE_CLIENT =
  import.meta.env.VITE_ADSENSE_CLIENT || 'ca-pub-6982051533473293';

const SLOT_IDS = Object.freeze({
  footer: import.meta.env.VITE_ADSENSE_SLOT_FOOTER || '',
  detail: import.meta.env.VITE_ADSENSE_SLOT_DETAIL || '',
  inFeed: import.meta.env.VITE_ADSENSE_SLOT_IN_FEED || '',
});

const ADSENSE_SCRIPT_ID = 'manual-adsense-script';

let adsenseScriptPromise = null;

const isLocalPreview = () => {
  if (typeof window === 'undefined') return true;
  return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
};

const loadAdsenseScript = () => {
  if (typeof document === 'undefined') return Promise.resolve();
  const existing = document.getElementById(ADSENSE_SCRIPT_ID);
  if (existing) return adsenseScriptPromise || Promise.resolve();

  adsenseScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = ADSENSE_SCRIPT_ID;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
};

const scheduleAdRequest = (callback) => {
  if (typeof window === 'undefined') return undefined;
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(callback, { timeout: 1800 });
    return () => window.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(callback, 900);
  return () => window.clearTimeout(id);
};

const ManualAdSlot = ({
  placement,
  locale = 'ja',
  className = '',
  minHeight = 'min-h-[120px]',
  format = 'auto',
  layout = undefined,
}) => {
  const location = useLocation();
  const isEnglish = isEnglishLocale(locale);
  const slotId = SLOT_IDS[placement] || '';
  const localPreview = isLocalPreview();
  const showPreviewPlaceholder = localPreview || (import.meta.env.DEV && !slotId);
  const isRenderable = Boolean(slotId) || showPreviewPlaceholder;

  const routeKey = `${location.pathname}${location.search}`;
  const containerLabel = isEnglish ? 'Advertisement' : '広告';
  const placeholderText = isEnglish
    ? 'Manual ad slot'
    : '手動広告枠';

  const adKey = useMemo(
    () => `${placement}-${slotId || 'dev'}-${routeKey}`,
    [placement, routeKey, slotId],
  );

  useEffect(() => {
    if (!slotId || localPreview) return undefined;

    let cancelled = false;
    const cancelScheduledRequest = scheduleAdRequest(() => {
      loadAdsenseScript()
        .then(() => {
          if (cancelled) return;
          window.adsbygoogle = window.adsbygoogle || [];
          window.adsbygoogle.push({});
        })
        .catch((error) => {
          logger.warn('AdSense manual slot failed to load:', error);
        });
    });
    return () => {
      cancelled = true;
      cancelScheduledRequest?.();
    };
  }, [adKey, localPreview, slotId]);

  if (!isRenderable) return null;

  return (
    <aside
      className={`manual-ad-slot rounded-xl border border-slate-200/70 bg-white/75 p-3 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-900/55 ${className}`}
      aria-label={containerLabel}
    >
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
        {containerLabel}
      </div>
      {slotId && !showPreviewPlaceholder ? (
        <ins
          key={adKey}
          className={`adsbygoogle block ${minHeight}`}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-ad-layout={layout}
          data-full-width-responsive="true"
        />
      ) : (
        <div className={`${minHeight} flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400`}>
          {slotId ? `${placeholderText}: ${placement}` : placeholderText}
        </div>
      )}
    </aside>
  );
};

export default ManualAdSlot;
