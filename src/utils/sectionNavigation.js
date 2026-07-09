const getSectionCandidates = (id) => {
  if (!id || typeof document === 'undefined') return [];
  return [
    document.getElementById(id),
    ...document.querySelectorAll(`[data-section-id="${id}"]`),
  ].filter(Boolean);
};

export const isVisibleSectionTarget = (element) => {
  if (!element || typeof window === 'undefined') return false;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.display !== 'none' &&
    style.visibility !== 'hidden'
  );
};

export const findSectionTarget = (id) => {
  const candidates = getSectionCandidates(id);
  return candidates.find(isVisibleSectionTarget) || candidates[0] || null;
};

// 高さ0の空アンカーしか無いセクションは目次に載せない
// （ジャンプしても中身の無い位置へスクロールするだけになるため）
export const collectAvailableSectionItems = (items = []) =>
  items.filter(
    (item) =>
      item?.id &&
      item?.label &&
      getSectionCandidates(item.id).some(isVisibleSectionTarget),
  );

export const getSectionHeaderOffset = ({ extraOffset = 16 } = {}) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  const styles = window.getComputedStyle(document.documentElement);
  const main = parseFloat(styles.getPropertyValue('--app-main-header-height')) || 0;
  const sticky = parseFloat(styles.getPropertyValue('--app-sticky-header-height')) || 0;
  return main + sticky + extraOffset;
};

export const buildCurrentHashHref = (locationLike, id) => {
  const pathname = locationLike?.pathname || '/';
  const search = locationLike?.search || '';
  const hash = id ? `#${id}` : '';
  return `${pathname}${search}${hash}`;
};

export const scrollElementWithOffset = (
  element,
  { behavior = 'smooth', extraOffset = 16, updateHashId } = {},
) => {
  if (!element || typeof window === 'undefined') return false;
  const headerOffset = getSectionHeaderOffset({ extraOffset });
  const elementPosition = element.getBoundingClientRect().top;
  const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
  window.scrollTo({ top: offsetPosition, behavior });
  if (updateHashId) {
    try {
      // 第1引数にnullを渡すとReact Routerの履歴state({usr,key,idx})が丸ごと
      // 破壊され、戻る/進む後にlocation.state(「一覧に戻る」のフィルタ・ページ
      // 情報など)が失われる。既存のstateを保持したままURLのみ更新する
      window.history.replaceState(
        window.history.state,
        '',
        buildCurrentHashHref(window.location, updateHashId),
      );
    } catch {}
  }
  return true;
};

export const scrollToSection = (
  id,
  { behavior = 'smooth', extraOffset = 16, updateHash = true } = {},
) => {
  const target = findSectionTarget(id);
  if (!target) return false;
  return scrollElementWithOffset(target, {
    behavior,
    extraOffset,
    updateHashId: updateHash ? id : undefined,
  });
};

// セクションハッシュをURLから取り除く（「トップへ戻る」等でセクションを
// 離れた後もハッシュが残ると、リロード・共有時に先頭ではなくセクションを
// 指してしまう）。React Routerの履歴stateは保持する
export const clearSectionHash = () => {
  if (typeof window === 'undefined' || !window.location.hash) return;
  try {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    );
  } catch {}
};
