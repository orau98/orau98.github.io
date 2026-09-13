import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getPageViewPath,
  syncAnalyticsPreference,
  trackDetailSelection,
  trackLegacyMetaLanding,
  trackPageView,
} from '../utils/analytics';
import { isKnownDetailPath } from '../utils/siteTaxonomy';

const TRACK_DELAY_MS = 80;

export default function PageViewTracker() {
  const location = useLocation();
  const lastTrackedPathRef = useRef('');
  const legacyLandingTrackedRef = useRef(false);

  useEffect(() => {
    syncAnalyticsPreference({ search: location.search });
  }, [location.search]);

  useEffect(() => {
    const pagePath = getPageViewPath({ pathname: location.pathname });
    if (!pagePath || pagePath === lastTrackedPathRef.current) return undefined;

    const timerId = window.setTimeout(() => {
      if (!legacyLandingTrackedRef.current && window.__LEGACY_META_COMPATIBILITY__) {
        const legacyTracked = trackLegacyMetaLanding({
          sourcePath: window.__LEGACY_META_ENTRY_PATH__,
          targetPath: window.__LEGACY_META_TARGET_PATH__ || location.pathname,
        });
        if (legacyTracked) legacyLandingTrackedRef.current = true;
      }
      const tracked = trackPageView({ pathname: location.pathname });
      if (tracked) {
        lastTrackedPathRef.current = pagePath;
      }
    }, TRACK_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [location.pathname]);

  useEffect(() => {
    const handleInternalDetailClick = (event) => {
      const anchor = event.target?.closest?.('a');
      if (!anchor || event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      let url;
      try {
        url = new URL(anchor.href, window.location.origin);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin || !isKnownDetailPath(url.pathname)) return;

      const segments = url.pathname.split('/').filter(Boolean);
      const contentOffset = segments[0] === 'en' ? 1 : 0;
      if (segments.length <= contentOffset + 1) return;
      const contentType = segments[contentOffset];
      const source = anchor.closest('.related-insects-section')
        ? 'related_insects'
        : anchor.closest('#explorer-results')
          ? 'explorer_results'
          : 'internal_link';

      trackDetailSelection({
        path: url.pathname,
        contentType,
        source,
      });
    };

    // React Router prevents the default action while bubbling a normal Link click.
    // Observe it in capture phase so SPA detail navigation is counted as well.
    document.addEventListener('click', handleInternalDetailClick, true);
    return () => document.removeEventListener('click', handleInternalDetailClick, true);
  }, []);

  return null;
}
