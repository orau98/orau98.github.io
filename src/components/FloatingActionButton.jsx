import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getLocaleFromPath,
  isEnglishLocale,
  stripLocalePrefix,
} from '../utils/locale';
import {
  collectAvailableSectionItems,
  scrollToSection as scrollToSectionHelper,
} from '../utils/sectionNavigation';

const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [tocItems, setTocItems] = useState([]);
  const location = useLocation();
  const locale = getLocaleFromPath(location.pathname || '/');
  const isEnglish = isEnglishLocale(locale);
  const normalizedPathname = stripLocalePrefix(location.pathname || '/');
  const isDetailPage = /\/(moth|butterfly|beetle|longhornbeetle|leafbeetle|aphid|plant)\//.test(normalizedPathname);

  // 詳細ページでは常時表示する。
  // 以前は上部にDetailSectionNav（セクションナビ帯）がありデスクトップは
  // 300pxスクロール後にのみ出していたが、目次機能をこのFABに一本化したため
  // ページ先頭からでもセクションへジャンプできるようにする
  useEffect(() => {
    setIsVisible(isDetailPage);
  }, [isDetailPage]);

  // Close menu when location changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  // キーボード利用者がメニューを閉じられるよう Escape に対応
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Generate Table of Contents (TOC) for detail pages
  useEffect(() => {
    // Only generate TOC for detail pages
    if (!isDetailPage) {
      setTocItems([]);
      return;
    }

    // Define section IDs and labels to look for
    // Note: Parent components (MothDetail, HostPlantDetail) need to add these IDs
    const possibleSections = [
      { id: 'plant-photos', label: isEnglish ? 'Photos' : '写真', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z' },
      { id: 'basic-info', label: isEnglish ? 'Overview' : '基本情報', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'plant-profile', label: isEnglish ? 'Profile' : '解説', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
      { id: 'host-plants', label: isEnglish ? 'Host plants' : '食草・食樹', icon: 'M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z' },
      { id: 'adult-season', label: isEnglish ? 'Adult season' : '発生時期', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { id: 'ecology', label: isEnglish ? 'Ecology' : '生態情報', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'classification-members', label: isEnglish ? 'Relatives' : '同じ分類の植物', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { id: 'related-insects', label: isEnglish ? 'Related insects' : '関連昆虫', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
      { id: 'plant-network', label: isEnglish ? 'Network' : 'ネットワーク', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { id: 'food-web', label: isEnglish ? 'Network' : 'ネットワーク', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { id: 'share', label: isEnglish ? 'Share' : '共有', icon: 'M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z' }
    ];

    // Check which sections actually exist in the DOM.
    // 直接URLで開いた場合はデータ読み込み完了までセクションが描画されないため、
    // 1回きりの判定ではなく、見つかるまで一定回数リトライする
    let cancelled = false;
    let attempts = 0;
    let timer = null;
    const checkSections = () => {
      if (cancelled) return;
      const items = collectAvailableSectionItems(possibleSections);
      setTocItems(items);
      attempts += 1;
      if (items.length === 0 && attempts < 20) {
        timer = setTimeout(checkSections, 500);
      }
    };

    timer = setTimeout(checkSections, 500);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [isDetailPage, isEnglish, location.pathname]);

  useEffect(() => {
    if (!isVisible) {
      setIsOpen(false);
    }
  }, [isVisible]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
    setIsOpen(false);
  };

  const scrollToSection = (id) => {
    if (scrollToSectionHelper(id, { behavior: 'smooth', extraOffset: 16, updateHash: true })) {
      setIsOpen(false);
    }
  };

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 md:right-6 z-[70] flex flex-col items-end gap-3">
      {/* Menu Items */}
      <div
        id="fab-menu"
        inert={!isOpen ? true : undefined}
        aria-hidden={!isOpen}
        className={`relative z-[70] flex flex-col gap-3 transition-all duration-300 origin-bottom ${
          isOpen
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-90 translate-y-10 pointer-events-none'
        }`}
      >
        {/* TOC Items (Only on detail pages) */}
        {tocItems.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-2 mb-2 min-w-[160px]">
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 px-3 py-1 mb-1 border-b border-slate-100 dark:border-slate-700">
              {isEnglish ? 'Contents' : '目次'}
            </p>
            {tocItems.map((item) => (
              <button
                key={item.id}
                onClick={() => scrollToSection(item.id)}
                className="w-full flex items-center px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-left"
              >
                <span className="mr-2 text-slate-400">
                  {item.id === 'host-plants' ? (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={item.icon} /></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} /></svg>
                  )}
                </span>
                {item.label}
              </button>
            ))}
          </div>
        )}

        {/* Back to Top Button */}
        <button
          onClick={scrollToTop}
          className="flex items-center justify-center w-12 h-12 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full shadow-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          aria-label={isEnglish ? 'Back to top' : 'トップへ戻る'}
          title={isEnglish ? 'Back to top' : 'ページトップへ'}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      </div>

      {/* Main FAB Toggle */}
      <button
        onClick={toggleMenu}
        className={`relative z-[70] flex h-12 items-center justify-center gap-1.5 rounded-full px-4 shadow-xl transition-all duration-300 md:h-14 md:px-5 ${
          isOpen
            ? 'bg-slate-700 text-white'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
        }`}
        aria-label={isOpen ? (isEnglish ? 'Close contents' : '目次を閉じる') : (isEnglish ? 'Open contents' : '目次を開く')}
        aria-expanded={isOpen}
        aria-controls="fab-menu"
      >
        <svg
          className={`h-7 w-7 transition-transform duration-300 md:h-8 md:w-8 ${isOpen ? 'rotate-45' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        {/* PCでも「＋」だけでは用途が分からないためラベルを常時表示する */}
        <span className="text-sm font-semibold">
          {isOpen ? (isEnglish ? 'Close' : '閉じる') : (isEnglish ? 'Contents' : '目次')}
        </span>
      </button>
      
      {/* Overlay to close when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[65]"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default FloatingActionButton;
