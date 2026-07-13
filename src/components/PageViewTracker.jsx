import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { getPageViewPath, trackPageView } from '../utils/analytics';

const TRACK_DELAY_MS = 80;

export default function PageViewTracker() {
  const location = useLocation();
  const lastTrackedPathRef = useRef('');

  useEffect(() => {
    const pagePath = getPageViewPath({ pathname: location.pathname });
    if (!pagePath || pagePath === lastTrackedPathRef.current) return undefined;

    const timerId = window.setTimeout(() => {
      const tracked = trackPageView({ pathname: location.pathname });
      if (tracked) {
        lastTrackedPathRef.current = pagePath;
      }
    }, TRACK_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [location.pathname]);

  return null;
}
