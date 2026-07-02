import React, { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';
import { getSearchTypeLabel } from '../utils/siteTaxonomy';
import { isEnglishLocale } from '../utils/locale';
import { formatScientificNameReact } from '../utils/scientificNameFormatter.jsx';

const assignRef = (ref, value) => {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
    return;
  }
  ref.current = value;
};

// カテゴリアイコンコンポーネント
const CategoryIcon = ({ type, className = "w-4 h-4" }) => {
  switch (type) {
    case 'moth':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C9.5 2 7 4 7 7c0 2-1 3-3 4-1 .5-2 1.5-2 3 0 2 1.5 3 3 3 1 0 2-.5 2-1 0 .5 1 2 2 3 .5.5 1 1 2 1h2c1 0 1.5-.5 2-1 1-1 2-2.5 2-3 0 .5 1 1 2 1 1.5 0 3-1 3-3 0-1.5-1-2.5-2-3-2-1-3-2-3-4 0-3-2.5-5-5-5zm-2 6c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1zm4 0c-.5 0-1-.5-1-1s.5-1 1-1 1 .5 1 1-.5 1-1 1z"/>
        </svg>
      );
    case 'butterfly':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 8c-.8 0-1.5.3-2 .8V6c0-1.1-.9-2-2-2s-2 .9-2 2v2.3C4.2 9.1 3 10.4 3 12c0 2.2 1.8 4 4 4 .7 0 1.4-.2 2-.5v3.5c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-3.5c.6.3 1.3.5 2 .5 2.2 0 4-1.8 4-4 0-1.6-1.2-2.9-2.8-3.7V6c0-1.1-.9-2-2-2s-2 .9-2 2v2.8c-.5-.5-1.2-.8-2-.8z"/>
        </svg>
      );
    case 'beetle':
    case 'longhornbeetle':
    case 'leafbeetle':
    case 'aphid':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C9.8 2 8 3.8 8 6v1H6c-1.1 0-2 .9-2 2v2c0 .6.4 1 1 1h1v6c0 2.2 1.8 4 4 4h4c2.2 0 4-1.8 4-4v-6h1c.6 0 1-.4 1-1V9c0-1.1-.9-2-2-2h-2V6c0-2.2-1.8-4-4-4zm-1 6h2v2h-2V8z"/>
        </svg>
      );
    case 'plant':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 22c-4.97 0-9-4.03-9-9 0-4.97 4.03-9 9-9 1.73 0 3.35.49 4.72 1.34C15.25 4.47 13.68 4 12 4c-3.87 0-7 3.13-7 7 0 3.87 3.13 7 7 7 1.98 0 3.77-.83 5.04-2.16A8.96 8.96 0 0 1 12 22zM17 9c-1.1 0-2 .9-2 2v2h-2v2h2v2h2v-2h2v-2h-2v-2c0-1.1-.9-2-2-2z"/>
        </svg>
      );
    default:
      return (
        <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      );
  }
};

// サムネイル画像コンポーネント
const SuggestionThumbnail = ({ src, alt, type }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || error) {
    return (
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        type === 'plant' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' :
        'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
      }`}>
        <CategoryIcon type={type} className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
      <img
        src={src}
        alt={alt || ''}
        className={`w-full h-full object-cover transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
      {!loaded && !error && (
        <div className="absolute inset-0 bg-slate-200 dark:bg-slate-600 animate-pulse" />
      )}
    </div>
  );
};

// モバイル判定とサジェスト件数を返すフック
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile, { passive: true });
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
};

// 検索履歴管理フック
const SEARCH_HISTORY_KEY = 'ihpe-search-history';
const MAX_HISTORY_ITEMS = 5;
const getHistoryStorageKey = (scope = 'default') =>
  `${SEARCH_HISTORY_KEY}:${scope || 'default'}`;

const getSuggestionBadgeClass = (type) => {
  switch (type) {
    case 'plant':
      return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300';
    case 'butterfly':
      return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300';
    case 'beetle':
      return 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300';
    case 'longhornbeetle':
      return 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300';
    case 'leafbeetle':
      return 'bg-lime-100 dark:bg-lime-900/50 text-lime-700 dark:text-lime-300';
    case 'aphid':
      return 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300';
    default:
      return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300';
  }
};

const renderSuggestionScientificText = (text, isScientific = false) => {
  if (!text) return null;
  return isScientific ? formatScientificNameReact(text) : text;
};

const useSearchHistory = (scope = 'default') => {
  const [history, setHistory] = useState([]);
  const storageKey = useMemo(() => getHistoryStorageKey(scope), [scope]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setHistory(JSON.parse(saved));
        return;
      }
      if (scope === 'default') {
        const legacy = localStorage.getItem(SEARCH_HISTORY_KEY);
        if (legacy) {
          setHistory(JSON.parse(legacy));
        }
      }
    } catch {}
  }, [scope, storageKey]);

  const addToHistory = useCallback((term) => {
    if (!term || term.trim().length < 2) return;
    const trimmed = term.trim();

    setHistory((prev) => {
      const filtered = prev.filter((item) => item !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [storageKey]);

  const removeFromHistory = useCallback((term) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(storageKey, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [storageKey]);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  return { history, addToHistory, removeFromHistory, clearHistory };
};

const SearchInput = React.forwardRef(({
  value,
  onChange,
  placeholder,
  suggestions = [],
  onSelectSuggestion,
  onSubmit,
  ariaLabel,
  historyScope = 'default',
  locale = 'ja',
  compact = false,
}, forwardedRef) => {
  const isEnglish = isEnglishLocale(locale);
  const labels = useMemo(
    () => ({
      search: isEnglish ? 'Search' : '検索',
      clearInput: isEnglish ? 'Clear search input' : '検索入力をクリア',
      recentSearches: isEnglish ? 'Recent searches' : '最近の検索',
      clearHistory: isEnglish ? 'Clear history' : '履歴をクリア',
      removeHistory: (term) =>
        isEnglish ? `Remove "${term}" from search history` : `「${term}」を履歴から削除`,
      noResults: isEnglish ? 'No matching suggestions' : '一致する候補がありません',
    }),
    [isEnglish],
  );
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // IME composition状態を追跡（日本語入力の文字重複を防ぐ）
  const [localValue, setLocalValue] = useState(value);
  const [isComposing, setIsComposing] = useState(false);
  const isComposingRef = useRef(false);
  const inputRef = useRef(null);
  const listboxId = useId();
  const blurTimeoutRef = useRef(null);
  const isMobile = useIsMobile();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory(historyScope);
  const setInputRef = useCallback((node) => {
    inputRef.current = node;
    assignRef(forwardedRef, node);
  }, [forwardedRef]);

  // 外部からvalueが変更された場合にローカル値を同期
  useEffect(() => {
    if (!isComposingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  // モバイルではサジェスト件数を5件に制限
  const maxSuggestions = isMobile ? 5 : 10;
  const displayedSuggestions = useMemo(
    () => suggestions.slice(0, maxSuggestions),
    [suggestions, maxSuggestions]
  );

  // 検索履歴と候補を組み合わせ（入力がない場合は履歴を表示）
  const showHistory = !localValue.trim() && history.length > 0;
  // 1文字入力でも候補計算は走るため、0件なら無言ではなく「候補なし」を出す
  const showNoResults = showSuggestions && !showHistory && !isComposing
    && localValue.trim().length >= 1 && displayedSuggestions.length === 0;
  const activeItems = showHistory ? history : displayedSuggestions;
  const activeItemsLength = activeItems.length;
  const expanded = showSuggestions && (displayedSuggestions.length > 0 || showHistory || showNoResults);
  const activeDescendantId = useMemo(() => {
    if (!expanded || activeIndex < 0) return undefined;
    return `${listboxId}-option-${activeIndex}`;
  }, [activeIndex, expanded, listboxId]);
  const shellClass = compact
    ? expanded
      ? 'rounded-t-xl rounded-b-none border-b-0 shadow-lg'
      : 'rounded-xl hover:shadow-md'
    : expanded
      ? 'rounded-t-xl sm:rounded-t-2xl rounded-b-none border-b-0 shadow-lg'
      : 'rounded-xl sm:rounded-2xl hover:shadow-md';
  const inputClass = compact
    ? 'w-full bg-transparent border-none py-2.5 pl-10 pr-11 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-0 dark:text-slate-100 dark:placeholder-slate-400 sm:py-3 sm:pl-11 sm:pr-12'
    : 'w-full bg-transparent border-none py-3 pl-10 pr-11 text-sm text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-0 dark:text-slate-100 dark:placeholder-slate-400 sm:py-3.5 sm:pl-11 sm:pr-12 sm:text-base';

  const handleChange = (e) => {
    const newValue = e.target.value;
    // ローカル値は常に更新（IME変換中の表示用）
    setLocalValue(newValue);
    setShowSuggestions(true);

    // IME composition中は親コンポーネントに通知しない（重複防止）
    if (!isComposingRef.current) {
      onChange(e);
    }
  };

  // IME composition開始時
  const handleCompositionStart = () => {
    isComposingRef.current = true;
    setIsComposing(true);
  };

  // IME composition終了時（確定時）
  const handleCompositionEnd = (e) => {
    isComposingRef.current = false;
    setIsComposing(false);
    // composition終了後に親コンポーネントに最終値を通知
    onChange(e);
  };

  const handleFocus = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setShowSuggestions(true);
  };

  const handleBlur = () => {
    if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    blurTimeoutRef.current = setTimeout(() => {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }, 120);
  };

  const handleSelect = (suggestion) => {
    const historyValue =
      typeof suggestion === "object" && suggestion !== null
        ? suggestion.value || suggestion.name || ""
        : suggestion;
    addToHistory(historyValue);
    if (typeof onSelectSuggestion === "function") {
      // Pass the full suggestion object so the parent can route specific
      // species/plants straight to their detail page (vs. taxon filters).
      onSelectSuggestion(suggestion);
    }
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    setLocalValue("");
    if (typeof onChange === "function") {
      onChange({ target: { value: "" } });
    }
    setShowSuggestions(false);
    setActiveIndex(-1);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (!expanded) {
      if (e.key === "ArrowDown" && activeItemsLength > 0) {
        setShowSuggestions(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      if (activeItemsLength === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev + 1;
        return next >= activeItemsLength ? 0 : next;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      if (activeItemsLength === 0) return;
      e.preventDefault();
      setActiveIndex((prev) => {
        if (prev <= 0) return activeItemsLength - 1;
        return prev - 1;
      });
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < activeItemsLength) {
        const selected = activeItems[activeIndex];
        const selectValue =
          typeof selected === "object" && selected !== null
            ? selected.value || selected.name || ""
            : selected;
        if (selectValue) handleSelect(selected);
        return;
      }
      const trimmed = localValue.trim();
      if (!trimmed) {
        setShowSuggestions(false);
        setActiveIndex(-1);
        return;
      }
      addToHistory(trimmed);
      if (typeof onSubmit === "function") {
        onSubmit(trimmed);
      }
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (!expanded && localValue) {
        handleClear();
        return;
      }
      setShowSuggestions(false);
      setActiveIndex(-1);
      return;
    }
  };

  useEffect(() => {
    if (!expanded) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((prev) => {
      if (activeItemsLength === 0) return -1;
      if (prev >= activeItemsLength) return activeItemsLength - 1;
      return prev;
    });
  }, [expanded, activeItemsLength]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative group">
      <div className={`relative z-30 border border-slate-200/60 bg-white/90 shadow-sm backdrop-blur-sm transition-all duration-200 dark:border-slate-600/60 dark:bg-slate-800/90 ${shellClass}`}>
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 sm:pl-4">
          <svg className="h-[18px] w-[18px] text-slate-400 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={setInputRef}
          type="text"
          placeholder={placeholder}
          value={localValue}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          enterKeyHint="search"
          spellCheck={false}
          onChange={handleChange}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label={ariaLabel || placeholder || labels.search}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listboxId : undefined}
          aria-activedescendant={activeDescendantId}
          aria-keyshortcuts="/ Control+K Meta+K Escape"
          className={inputClass}
        />
        {localValue && localValue.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-0.5 my-auto flex h-9 w-9 min-h-[42px] min-w-[42px] items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100/70 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700/70 dark:hover:text-slate-200 sm:right-1 sm:h-10 sm:w-10 sm:min-h-[44px] sm:min-w-[44px]"
            aria-label={labels.clearInput}
          >
            <svg className="h-[18px] w-[18px] sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {showSuggestions && (displayedSuggestions.length > 0 || showHistory || showNoResults) && (
        <div
          className="absolute z-20 top-full left-0 right-0 -mt-px"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="overflow-hidden rounded-b-xl border border-t-0 border-slate-200/50 bg-white/95 shadow-lg backdrop-blur-xl dark:border-slate-600/50 dark:bg-slate-800/95 sm:rounded-b-2xl">
            {/* 検索履歴表示（入力がない場合） */}
            {showHistory && (
              <div className="py-2">
                <div className="flex items-center justify-between px-3 py-1 sm:px-4">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{labels.recentSearches}</span>
                  <button
                    type="button"
                    onMouseDown={clearHistory}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {labels.clearHistory}
                  </button>
                </div>
                <ul id={listboxId} role="listbox">
                  {history.map((term, index) => (
                    <li key={`history-${term}-${index}`} role="none">
                      <div
                        className={`flex min-h-[44px] w-full items-center justify-between px-1.5 text-slate-700 transition-colors dark:text-slate-200 sm:min-h-[48px] sm:px-2 ${
                          index === activeIndex
                            ? "bg-slate-50 dark:bg-slate-700/50"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <button
                          type="button"
                          role="option"
                          id={`${listboxId}-option-${index}`}
                          aria-selected={index === activeIndex}
                          tabIndex={-1}
                          onMouseDown={() => handleSelect(term)}
                          onMouseEnter={() => setActiveIndex(index)}
                          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-2.5 text-left sm:gap-3 sm:px-2 sm:py-3"
                        >
                          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate font-medium">{term}</span>
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); removeFromHistory(term); }}
                          onMouseEnter={() => setActiveIndex(index)}
                          className="rounded-md p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          aria-label={labels.removeHistory(term)}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* サジェスト表示（入力がある場合） */}
            {!showHistory && displayedSuggestions.length > 0 && (
              <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-1.5 sm:max-h-80 sm:py-2">
                {displayedSuggestions.map((suggestion, index) => {
                  // サジェストがオブジェクトか文字列かを判定
                  const isObject = typeof suggestion === 'object' && suggestion !== null;
                  const name = isObject ? suggestion.name : suggestion;
                  const type = isObject ? suggestion.type : null;
                  const image = isObject ? suggestion.image : null;
                  const subText = isObject ? suggestion.subText : null;
                  const nameIsScientific = isObject ? Boolean(suggestion.nameIsScientific) : false;
                  const subTextIsScientific = isObject ? Boolean(suggestion.subTextIsScientific) : false;
                  const isNavigable = isObject && Boolean(suggestion.detailPath);

                  return (
                    <li key={`${name}-${index}`} role="none">
                      <button
                        type="button"
                        role="option"
                        id={`${listboxId}-option-${index}`}
                        aria-selected={index === activeIndex}
                        tabIndex={-1}
                        onMouseDown={() => handleSelect(suggestion)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`flex min-h-[52px] w-full items-center gap-2.5 px-3 py-2 text-left text-slate-700 transition-all duration-150 dark:text-slate-200 sm:min-h-[56px] sm:gap-3 sm:px-4 sm:py-2.5 ${
                          index === activeIndex
                            ? "bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-700/70 dark:to-slate-700/30"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        {/* サムネイル画像またはアイコン */}
                        {isObject ? (
                          <SuggestionThumbnail src={image} alt={name} type={type} />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                        )}

                        {/* テキスト部分 */}
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-sm font-medium">
                            {renderSuggestionScientificText(name, nameIsScientific)}
                          </div>
                          {subText && (
                            <div className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {renderSuggestionScientificText(subText, subTextIsScientific)}
                            </div>
                          )}
                        </div>

                        {/* カテゴリバッジ */}
                        {type && (
                          <span className={`hidden flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium sm:inline-flex ${getSuggestionBadgeClass(type)}`}>
                            {getSearchTypeLabel(type, locale)}
                          </span>
                        )}
                        {/* 詳細ページへ直接遷移できる候補（種・植物）に矢印を表示 */}
                        {isNavigable && (
                          <svg className="ml-0.5 h-4 w-4 flex-shrink-0 text-slate-300 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* 候補なしメッセージ（IME入力中でない場合） */}
            {showNoResults && (
              <div className="py-4 text-center text-sm text-slate-400 dark:text-slate-500">
                {labels.noResults}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

export default SearchInput;
