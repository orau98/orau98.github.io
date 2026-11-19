import { useEffect, useRef, useState } from 'react';
import useNearViewport from '../hooks/useNearViewport';
import { isEnglishLocale } from '../utils/locale';
import logger from '../utils/logger';

const ADSENSE_CLIENT =
  import.meta.env.VITE_ADSENSE_CLIENT || 'ca-pub-6982051533473293';

const SLOT_IDS = Object.freeze({
  footer: import.meta.env.VITE_ADSENSE_SLOT_FOOTER || '',
  detail: import.meta.env.VITE_ADSENSE_SLOT_DETAIL || '',
  inFeed: import.meta.env.VITE_ADSENSE_SLOT_IN_FEED || '',
});

const ADSENSE_SCRIPT_PATH = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
let adsenseScriptPromise = null;

const isLocalPreview = () => {
  if (typeof window === 'undefined') return true;
  return ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
};

const loadAdsenseScript = () => {
  if (adsenseScriptPromise) return adsenseScriptPromise;
  // 一覧などの初期HTMLに公式タグがある場合はそのキューを使う。
  if (document.querySelector(`script[src^="${ADSENSE_SCRIPT_PATH}"]`)) {
    return Promise.resolve();
  }

  adsenseScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = 'manual-adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `${ADSENSE_SCRIPT_PATH}?client=${ADSENSE_CLIENT}`;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
};

const AdSlotInstance = ({
  placement,
  slotId,
  locale,
  className,
  minHeight,
  format,
  layout,
  showPreviewPlaceholder,
}) => {
  const isEnglish = isEnglishLocale(locale);
  const label = isEnglish ? 'Advertisement' : '広告';
  const containerRef = useRef(null);
  const insRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);
  const isNear = useNearViewport(containerRef, {
    rootMargin: '600px 0px',
    disabled: showPreviewPlaceholder || collapsed,
  });

  useEffect(() => {
    const slot = insRef.current;
    if (!isNear || !slot) return undefined;

    let cancelled = false;
    const checkStatus = () => {
      if (slot.getAttribute('data-ad-status') === 'unfilled') setCollapsed(true);
    };
    const observer = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(checkStatus);
    observer?.observe(slot, { attributes: true, attributeFilter: ['data-ad-status'] });
    checkStatus();

    loadAdsenseScript()
      .then(() => {
        if (cancelled || !slot.isConnected || slot.hasAttribute('data-adsbygoogle-status')) return;
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      })
      .catch((error) => {
        if (cancelled) return;
        setCollapsed(true);
        logger.warn('AdSense manual slot failed to load:', error);
      });

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, [isNear, collapsed]);

  if (collapsed) return null;

  return (
    <aside
      ref={containerRef}
      className={`manual-ad-slot rounded-xl border border-slate-200/70 bg-white/75 p-3 text-center shadow-sm dark:border-slate-700/70 dark:bg-slate-900/55 ${className}`}
      aria-label={label}
    >
      <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      {showPreviewPlaceholder ? (
        <div className={`${minHeight} flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-400`}>
          {isEnglish ? 'Manual ad slot' : '手動広告枠'}{slotId ? `: ${placement}` : ''}
        </div>
      ) : isNear ? (
        <ins
          ref={insRef}
          className={`adsbygoogle block ${minHeight}`}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slotId}
          data-ad-format={format}
          data-ad-layout={layout}
          data-full-width-responsive="true"
        />
      ) : (
        <div className={minHeight} aria-hidden="true" />
      )}
    </aside>
  );
};

const ManualAdSlot = ({
  placement,
  locale = 'ja',
  className = '',
  minHeight = 'min-h-[120px]',
  format = 'auto',
  layout,
  instanceKey = '',
}) => {
  const slotId = SLOT_IDS[placement] || '';
  const showPreviewPlaceholder = isLocalPreview() || (import.meta.env.DEV && !slotId);
  if (!slotId && !showPreviewPlaceholder) return null;

  // 同じ詳細コンポーネントで別種へ移動したときだけ枠を作り直す。
  // 常設フッターはルート移動で再リクエストしない。
  return (
    <AdSlotInstance
      key={`${placement}-${slotId}-${instanceKey}`}
      placement={placement}
      slotId={slotId}
      locale={locale}
      className={className}
      minHeight={minHeight}
      format={format}
      layout={layout}
      showPreviewPlaceholder={showPreviewPlaceholder}
    />
  );
};

export default ManualAdSlot;
