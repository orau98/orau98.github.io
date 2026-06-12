import { useEffect, useMemo, useState } from 'react';
import {
  collectAvailableSectionItems,
  scrollToSection,
} from '../utils/sectionNavigation';

export default function DetailSectionNav({ items = [], label = 'Sections' }) {
  const normalizedItems = useMemo(
    () => items.filter((item) => item?.id && item?.label),
    [items],
  );
  const [visibleItems, setVisibleItems] = useState(normalizedItems);

  useEffect(() => {
    if (!normalizedItems.length || typeof document === 'undefined' || typeof window === 'undefined') {
      setVisibleItems(normalizedItems);
      return undefined;
    }

    const syncVisibleItems = () => {
      setVisibleItems(collectAvailableSectionItems(normalizedItems));
    };

    const frameId = window.requestAnimationFrame(syncVisibleItems);
    return () => window.cancelAnimationFrame(frameId);
  }, [normalizedItems]);

  if (!visibleItems.length) return null;

  const handleClick = (id) => {
    scrollToSection(id, { behavior: 'smooth', extraOffset: 16, updateHash: true });
  };

  return (
    <nav
      aria-label={label}
      className="md:sticky md:top-[calc(var(--app-main-header-height,0px)+8px)] z-30 mb-6 overflow-x-auto rounded-xl border border-slate-200/70 bg-white/85 px-2 py-2 shadow-sm backdrop-blur dark:border-slate-700/70 dark:bg-slate-900/80"
    >
      <div className="flex min-w-max items-center gap-1">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleClick(item.id)}
            aria-controls={item.id}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
