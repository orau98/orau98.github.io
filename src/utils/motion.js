// JS駆動のスクロール等のアニメーションを、OSの「視差効果を減らす」設定に追従させるためのヘルパー。
// CSS側（index.cssの@media prefers-reduced-motion）はクラスベースのアニメーションをカバーするが、
// scrollIntoView({behavior:'smooth'}) のようなJSアニメーションはCSSでは抑制できないため、ここで判定する。

let reducedMotionQuery;

const getReducedMotionQuery = () => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  if (reducedMotionQuery === undefined) {
    try {
      reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      reducedMotionQuery = null;
    }
  }
  return reducedMotionQuery;
};

export const prefersReducedMotion = () => {
  const query = getReducedMotionQuery();
  return query ? query.matches : false;
};

// 希望する behavior（既定: 'smooth'）を、reduced-motion時には 'auto'（瞬間移動）へ落とす。
export const getScrollBehavior = (preferred = 'smooth') =>
  prefersReducedMotion() ? 'auto' : preferred;
