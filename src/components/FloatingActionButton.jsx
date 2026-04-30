import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  getLocaleFromPath,
  isEnglishLocale,
  stripLocalePrefix,
} from '../utils/locale';

const FloatingActionButton = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [tocItems, setTocItems] = useState([]);
  const location = useLocation();
  const locale = getLocaleFromPath(location.pathname || '/');
  const isEnglish = isEnglishLocale(locale);
  const normalizedPathname = stripLocalePrefix(location.pathname || '/');
  const isDetailPage = /\/(moth|butterfly|beetle|longhornbeetle|leafbeetle|aphid|plant)\//.test(normalizedPathname);

  // Show/hide based on scroll
  useEffect(() => {
    if (!isDetailPage) {
      setIsVisible(false);
      return undefined;
    }

    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, [isDetailPage]);

  // Close menu when location changes
  useEffect(() => {
    setIsOpen(false);
  }, [location]);

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
      { id: 'basic-info', label: isEnglish ? 'Overview' : '基本情報', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
      { id: 'host-plants', label: isEnglish ? 'Host plants' : '食草・食樹', icon: 'M17,8C8,10 5.9,16.17 3.82,21.34L5.71,22L6.66,19.7C7.14,19.87 7.64,20 8,20C19,20 22,3 22,3C21,5 14,5.25 9,6.25C4,7.25 2,11.5 2,13.5C2,15.5 3.75,17.25 3.75,17.25C7,8 17,8 17,8Z' },
      { id: 'adult-season', label: isEnglish ? 'Adult season' : '発生時期', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
      { id: 'plant-network', label: isEnglish ? 'Network' : 'ネットワーク', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { id: 'food-web', label: isEnglish ? 'Network' : 'ネットワーク', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
      { id: 'related-insects', label: isEnglish ? 'Related insects' : '関連昆虫', icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1' },
      { id: 'plant-photos', label: isEnglish ? 'Photos' : '写真', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2v12a2 2 0 002 2z' }
    ];

    // Check which sections actually exist in the DOM
    // Delay slightly to ensure DOM is ready
    const checkSections = () => {
      const found = possibleSections.filter(section => (
        document.getElementById(section.id) ||
        document.querySelector(`[data-section-id="${section.id}"]`)
      ));
      setTocItems(found);
    };

    const timer = setTimeout(checkSections, 500);
    return () => clearTimeout(timer);
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

  const getHeaderOffset = () => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
    const styles = window.getComputedStyle(document.documentElement);
    const main = parseFloat(styles.getPropertyValue('--app-main-header-height')) || 0;
    const sticky = parseFloat(styles.getPropertyValue('--app-sticky-header-height')) || 0;
    return main + sticky + 16;
  };

  const scrollToSection = (id) => {
    const candidates = [
      document.getElementById(id),
      ...document.querySelectorAll(`[data-section-id="${id}"]`),
    ].filter(Boolean);
    const el = candidates.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    }) || candidates[0];
    if (el) {
      // Offset for header + sticky header
      const headerOffset = getHeaderOffset();
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
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
        className={`relative z-[70] flex items-center justify-center w-14 h-14 rounded-full shadow-xl transition-all duration-300 ${
          isOpen
            ? 'bg-slate-700 text-white rotate-45'
            : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
        }`}
        aria-label={isOpen ? (isEnglish ? 'Close menu' : 'メニューを閉じる') : (isEnglish ? 'Open menu' : 'メニューを開く')}
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
      
      {/* Overlay to close when clicking outside */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

export default FloatingActionButton;
