import { useEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { trackPageView } from '../utils/analytics';

const TRACK_DELAY_MS = 80;

export default function PageViewTracker() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const lastTrackedPathRef = useRef('');

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    if (!pagePath || pagePath === lastTrackedPathRef.current) return undefined;

    // REPLACE遷移はURL正規化（/→/?tab=insects）や検索の逐次入力反映で、
    // ユーザーにとって新しいページ表示ではない。計測すると着地のたびの
    // 二重page_viewや1文字ごとの部分クエリ計測になるためスキップする
    if (navigationType === 'REPLACE') {
      lastTrackedPathRef.current = pagePath;
      return undefined;
    }

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
  }, [location.hash, location.pathname, location.search, navigationType]);

  return null;
}
