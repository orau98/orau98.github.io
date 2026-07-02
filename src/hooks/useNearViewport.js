import { useEffect, useState } from 'react';

// 対象要素がビューポートに近づいたら true を返すフック。
// 重いコンポーネント（力学グラフ等）のダウンロード・マウントを
// スクロール到達の直前まで遅延させるために使う。
export default function useNearViewport(ref, { rootMargin = '600px' } = {}) {
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    if (isNear) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      // 古い環境では遅延させず即マウント
      setIsNear(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNear(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, rootMargin, isNear]);

  return isNear;
}
