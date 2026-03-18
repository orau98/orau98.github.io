import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

const TRACK_DELAY_MS = 80;

export default function PageViewTracker() {
  const location = useLocation();
  const lastTrackedPathRef = useRef('');

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    if (!pagePath || pagePath === lastTrackedPathRef.current) return undefined;

    const timerId = window.setTimeout(() => {
      const tracked = trackPageView({
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      });
      if (tracked) {
        lastTrackedPathRef.current = pagePath;
      }
    }, TRACK_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [location.hash, location.pathname, location.search]);

  return null;
}
