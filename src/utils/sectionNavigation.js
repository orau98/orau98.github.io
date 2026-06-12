import { getScrollBehavior } from './motion.js';

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

export const collectAvailableSectionItems = (items = []) =>
  items.filter((item) => item?.id && item?.label && findSectionTarget(item.id));

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
  window.scrollTo({ top: offsetPosition, behavior: getScrollBehavior(behavior) });
  if (updateHashId) {
    try {
      window.history.replaceState(
        null,
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
