import React, { useState, useEffect, useRef } from 'react';
import SearchInput from './SearchInput';

const StickyHeader = ({ 
  activeTab, 
  setActiveTab, 
  searchTerm, 
  onSearchChange,
  suggestions = [],
  onSelectSuggestion,
  onSubmitSearch,
  onNeedInsectsData,
  onNeedPlantsData,
  theme,
  setTheme,
  heroId = 'hero-section',
  scrollTargetId = 'explorer-results',
  onVisibilityChange
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const headerBarRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const heroEl = heroId ? document.getElementById(heroId) : null;
    const canObserve = heroEl && 'IntersectionObserver' in window;

    if (canObserve) {
      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries && entries[0];
          // Show when hero is out of view (or not intersecting)
          setIsVisible(!(entry && entry.isIntersecting));
        },
        {
          root: null,
          threshold: 0,
          // Start showing slightly before the hero fully disappears
          rootMargin: '-120px 0px 0px 0px',
        },
      );
      observer.observe(heroEl);
      return () => observer.disconnect();
    }

    // Fallback: scroll threshold
    const handleScroll = () => setIsVisible(window.scrollY > 400);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [heroId]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const root = document.documentElement;
    const update = () => {
      const h = isVisible && headerBarRef.current
        ? headerBarRef.current.getBoundingClientRect().height
        : 0;
      root.style.setProperty('--app-sticky-header-height', `${Math.max(0, Math.round(h))}px`);
    };

    update();
    window.addEventListener('resize', update, { passive: true });
    return () => {
      window.removeEventListener('resize', update);
      root.style.setProperty('--app-sticky-header-height', '0px');
    };
  }, [isVisible]);

  useEffect(() => {
    if (typeof onVisibilityChange === 'function') {
      onVisibilityChange(isVisible);
    }
  }, [isVisible, onVisibilityChange]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'insects' && onNeedInsectsData) onNeedInsectsData();
    if (tab === 'plants' && onNeedPlantsData) onNeedPlantsData();
    
    // Scroll to the list container instead of a fixed pixel position
    try {
      const el = scrollTargetId ? document.getElementById(scrollTargetId) : null;
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch { /* ignore */ }
  };

  return (
    <>
    {/* レイアウトシフト防止用のスペースホルダー */}
    <div
      className="h-0 transition-[height] duration-300"
      style={{ height: isVisible ? 'var(--app-sticky-header-height, 0px)' : '0px' }}
      aria-hidden="true"
    />
    <div
      id="sticky-header"
      aria-hidden={!isVisible}
      inert={!isVisible ? '' : undefined}
      className={`fixed top-0 left-0 right-0 z-50 transform transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      }`}
    >
      <div
        ref={headerBarRef}
        className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-lg border-b border-slate-200 dark:border-slate-700 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
      >
        <div className="max-w-6xl mx-auto flex items-center gap-3 sm:gap-4">
          {/* Logo / Top Button */}
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex-shrink-0 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-emerald-600 dark:text-emerald-400"
            aria-label="トップへ戻る"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>

          {/* Search Bar - Compact */}
          <div className="flex-1 max-w-2xl relative">
            <SearchInput
              value={searchTerm}
              onChange={onSearchChange}
              placeholder={`${activeTab === 'plants' ? '植物' : '昆虫'}を検索...`}
              suggestions={suggestions}
              onSelectSuggestion={onSelectSuggestion}
              onSubmit={onSubmitSearch}
              ariaLabel={`${activeTab === 'plants' ? '植物' : '昆虫'}を検索`}
              historyScope={activeTab}
            />
            {/* 検索アクティブ状態のインジケーター */}
            {searchTerm && searchTerm.trim() && (
              <div className="hidden md:flex absolute -bottom-5 left-0 right-0 items-center justify-center">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                  「{searchTerm.trim().length > 10 ? searchTerm.trim().slice(0, 10) + '...' : searchTerm.trim()}」で検索中
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Tabs - Compact (Icon only on mobile, Text on desktop) */}
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex-shrink-0">
              <button
                onClick={() => handleTabChange('insects')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'insects'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                aria-label="昆虫タブ"
              >
                {/* Butterfly Icon */}
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 512 512">
                  <path d="M243.695,179.339c0.703,4.906,5.813,7.438,7.719,1.406c1.891-6.031-4.828-17.219-22.219-36.531c-14.828-16.484-35.625-39.391-23.844-51.578c14.609-10.078,8.469-27.75-4.172-29.469c-11.313-1.516-21.609,13.578-15.031,38.703C192.711,126.964,241.695,165.292,243.695,179.339z"/>
                  <path d="M445.898,83.886c-74.469,0-160.703,89.859-174.516,111.078c-3.594-4.578-9.109-7.578-15.375-7.578c-6.281,0-11.797,3-15.391,7.578C226.805,173.73,140.57,83.886,66.102,83.886c-76.828,0-70.547,68.984-59.578,112.891c10.969,43.922,56.453,92.516,106.609,94.094c-56.438,25.078-61.141,89.375-43.891,119.156c16.359,28.25,103.266,92.016,167.156-50.296v29.141c0,10.813,8.781,19.593,19.609,19.593c10.813,0,19.594-8.781,19.594-19.593v-29.156c63.891,142.328,150.813,78.562,167.156,50.312c17.25-29.781,12.547-94.078-43.891-119.156c50.172-1.578,95.641-50.172,106.609-94.094C516.445,152.871,522.727,83.886,445.898,83.886z"/>
                  <path d="M268.305,179.339c2-14.047,50.984-52.375,57.563-77.469c6.563-25.125-3.734-40.219-15.047-38.703c-12.641,1.719-18.766,19.391-4.172,29.469c11.781,12.188-9.016,35.094-23.844,51.578c-17.391,19.313-24.109,30.5-22.219,36.531C262.492,186.777,267.602,184.246,268.305,179.339z"/>
                </svg>
                <span className="hidden sm:inline">昆虫</span>
              </button>
              <button
                onClick={() => handleTabChange('plants')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'plants'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
                aria-label="植物タブ"
              >
                {/* Leaf Icon */}
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 512 512">
                  <path d="M377.478,0.174c-34.179-3.423-37.602,44.438-119.644,78.618c-83.543,34.808-166.39,80.55-167.693,254.14c-0.155,18.807-1.314,51.296-1.513,65.056c-0.276,19.691,0.287,40.872-8.69,51.738c-7.311,8.857-20.176,18.818-32.866,27.531L81.87,512c31.032-24.306,39.834-26.493,46.35-26.35c15.549,0.342,31.33,0.496,47.155-0.762c100.318-7.995,202.137-56.718,253.379-149.714C521.042,167.679,411.657,3.598,377.478,0.174z M368.81,109.802c-6.184,20.817-26.957,51.826-91.925,128.445c-33.517,39.535-72.158,107.672-99.743,168.344c-8.361,18.388-36.432,4.925-26.405-13.473c13.042-19.403,43.08-104.117,86.558-160.968c43.489-56.862,101.411-105.685,110.378-133.801C351.857,79.112,377.048,82.116,368.81,109.802z"/>
                </svg>
                <span className="hidden sm:inline">植物</span>
              </button>
            </div>

            {/* Theme toggle */}
            {theme && setTheme && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="テーマを切り替え"
                title="テーマを切り替え"
              >
                {theme === 'dark' ? (
                  <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-slate-700 dark:text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default StickyHeader;
