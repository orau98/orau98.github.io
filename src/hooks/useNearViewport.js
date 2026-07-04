import { useEffect, useState } from 'react';

// 対象要素がビューポートに近づいたら true を返すフック。
// 重いコンポーネント（力学グラフ等）のダウンロード・マウントを
// スクロール到達の直前まで遅延させるために使う。
// disabled: true のときは観測せず常に false を返す
// （優先表示などで判定自体が不要なケース用。呼び出し側で || を取る想定）。
export default function useNearViewport(ref, { rootMargin = '600px', disabled = false } = {}) {
  const [isNear, setIsNear] = useState(false);

  useEffect(() => {
    if (disabled || isNear) return undefined;
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
  }, [ref, rootMargin, isNear, disabled]);

  return isNear;
}
