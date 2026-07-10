import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buildInsectPath } from '../utils/insectSlug';
import { makeDetailLinkState } from '../utils/navState';
import { buildPlantPath } from '../utils/siteTaxonomy';

// Helper to get previous and next items from a sorted list
// `items` should be sorted in the desired order (e.g., alphabetical or taxonomic)
// `currentItemId` or `currentItemName` is used to find the current index
const useNeighborItems = (items, currentItemIdentifier, identifierKey = 'id') => {
  // 1万件超のリストを毎レンダー線形探索しないよう、識別子→indexのマップをメモ化する
  const indexMap = useMemo(() => {
    const map = new Map();
    (items || []).forEach((item, index) => {
      const key = identifierKey === 'name' ? item?.name : item?.id;
      if (key != null && !map.has(key)) map.set(key, index);
    });
    return map;
  }, [items, identifierKey]);

  const currentIndex = indexMap.has(currentItemIdentifier) ? indexMap.get(currentItemIdentifier) : -1;

  if (currentIndex === -1) return { prevItem: null, nextItem: null };

  const prevItem = currentIndex > 0 ? items[currentIndex - 1] : null;
  const nextItem = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

  return { prevItem, nextItem };
};

// Navigation Link Component
const NeighborLink = ({ item, direction, type = 'insect', locale = 'ja' }) => {
  const location = useLocation();
  const isEnglish = locale === 'en';
  if (!item) return <div className="flex-1" />; // Placeholder for alignment

  const getRoute = (item, type) => {
    if (type === 'plant') return buildPlantPath(item.name, locale);
    return buildInsectPath(item, locale);
  };

  const route = getRoute(item, type);
  const isPrev = direction === 'prev';
  // 英語版では昆虫・植物とも学名があれば学名を表示（和名のままにならないように）
  const displayName = isEnglish
    ? item.scientificName || item.name
    : item.name;

  return (
    <Link
      to={route}
      state={makeDetailLinkState(location)}
      // min-w-0: 長い学名（分割不能な単語）でflexアイテムの最小幅が押し広げられ、
      // 375px幅で横スクロールが発生するのを防ぐ（line-clampを効かせるため子にも付与）
      className={`flex-1 min-w-0 flex items-center ${isPrev ? 'justify-start' : 'justify-end'} group p-4 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300 shadow-sm hover:shadow-md`}
    >
      {isPrev && (
        <div className="shrink-0 mr-3 p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 dark:group-hover:bg-blue-900/30 dark:group-hover:text-blue-400 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </div>
      )}
      
      <div className={`min-w-0 flex flex-col ${isPrev ? 'items-start' : 'items-end'}`}>
        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-0.5">
          {isPrev
            ? isEnglish
              ? 'Previous'
              : type === 'plant' ? '前の植物' : '前の種'
            : isEnglish
              ? 'Next'
              : type === 'plant' ? '次の植物' : '次の種'}
        </span>
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
          {displayName}
        </span>
      </div>

      {!isPrev && (
        <div className="shrink-0 ml-3 p-2 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-600 dark:group-hover:bg-blue-900/30 dark:group-hover:text-blue-400 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </Link>
  );
};

// Main Component
// allItems は呼び出し側で並び替え済みを渡す前提（親でメモ化）。
// 昆虫・植物いずれも分類順（科→属…）で渡され、前後が近縁種になる。
const DetailNavigation = ({ allItems, currentId, type = 'insect', locale = 'ja' }) => {
  const { prevItem, nextItem } = useNeighborItems(allItems, currentId, type === 'plant' ? 'name' : 'id');

  if (!prevItem && !nextItem) return null;

  return (
    <div className="flex justify-between gap-4 mt-12 border-t border-slate-200/50 dark:border-slate-700/50 pt-8">
      <NeighborLink item={prevItem} direction="prev" type={type} locale={locale} />
      <NeighborLink item={nextItem} direction="next" type={type} locale={locale} />
    </div>
  );
};

export default DetailNavigation;
