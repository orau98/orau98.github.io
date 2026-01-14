import React, { useEffect, useId, useMemo, useRef, useState, useCallback } from 'react';

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
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0">
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

const useSearchHistory = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch {}
  }, []);

  const addToHistory = useCallback((term) => {
    if (!term || term.trim().length < 2) return;
    const trimmed = term.trim();

    setHistory((prev) => {
      const filtered = prev.filter((item) => item !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_HISTORY_ITEMS);
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const removeFromHistory = useCallback((term) => {
    setHistory((prev) => {
      const updated = prev.filter((item) => item !== term);
      try {
        localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(SEARCH_HISTORY_KEY);
    } catch {}
  }, []);

  return { history, addToHistory, removeFromHistory, clearHistory };
};

const SearchInput = ({
  value,
  onChange,
  placeholder,
  suggestions = [],
  onSelectSuggestion,
  ariaLabel,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const blurTimeoutRef = useRef(null);
  const isMobile = useIsMobile();
  const { history, addToHistory, removeFromHistory, clearHistory } = useSearchHistory();

  // モバイルではサジェスト件数を5件に制限
  const maxSuggestions = isMobile ? 5 : 10;
  const displayedSuggestions = useMemo(
    () => suggestions.slice(0, maxSuggestions),
    [suggestions, maxSuggestions]
  );

  // 検索履歴と候補を組み合わせ（入力がない場合は履歴を表示）
  const showHistory = !value && history.length > 0;
  const expanded = showSuggestions && (displayedSuggestions.length > 0 || showHistory);
  const activeDescendantId = useMemo(() => {
    if (!expanded || activeIndex < 0) return undefined;
    return `${listboxId}-option-${activeIndex}`;
  }, [activeIndex, expanded, listboxId]);

  const handleChange = (e) => {
    // 入力値はそのまま保持（変換しない）
    onChange(e);
    setShowSuggestions(true);
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
    addToHistory(suggestion);
    if (typeof onSelectSuggestion === "function") {
      onSelectSuggestion(suggestion);
    }
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleClear = () => {
    if (typeof onChange === "function") {
      onChange({ target: { value: "" } });
    }
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!expanded) {
      if (e.key === "ArrowDown" && displayedSuggestions.length > 0) {
        setShowSuggestions(true);
        setActiveIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => {
        const next = prev + 1;
        return next >= displayedSuggestions.length ? 0 : next;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        if (prev <= 0) return displayedSuggestions.length - 1;
        return prev - 1;
      });
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < displayedSuggestions.length) {
        e.preventDefault();
        handleSelect(displayedSuggestions[activeIndex]);
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
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
      if (displayedSuggestions.length === 0) return -1;
      if (prev >= displayedSuggestions.length) return displayedSuggestions.length - 1;
      return prev;
    });
  }, [expanded, displayedSuggestions.length]);

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
      <div className={`relative z-30 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/60 dark:border-slate-600/60 transition-all duration-200 shadow-sm ${showSuggestions && suggestions.length > 0 ? 'rounded-t-2xl rounded-b-none border-b-0 shadow-lg' : 'rounded-2xl hover:shadow-md'}`}>
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label={ariaLabel || placeholder || "検索"}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listboxId : undefined}
          aria-activedescendant={activeDescendantId}
          className="w-full pl-11 pr-12 py-3.5 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-0 text-slate-800 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400"
        />
        {value && value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-1 flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] my-auto rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-700/70 transition-colors"
            aria-label="検索入力をクリア"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {showSuggestions && (displayedSuggestions.length > 0 || showHistory) && (
        <div
          className="absolute z-20 top-full left-0 right-0 -mt-px"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-t-0 border-slate-200/50 dark:border-slate-600/50 rounded-b-2xl shadow-lg overflow-hidden">
            {/* 検索履歴表示（入力がない場合） */}
            {showHistory && (
              <div className="py-2">
                <div className="px-4 py-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">最近の検索</span>
                  <button
                    type="button"
                    onMouseDown={clearHistory}
                    className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    履歴をクリア
                  </button>
                </div>
                <ul id={listboxId} role="listbox">
                  {history.map((term, index) => (
                    <li key={`history-${term}-${index}`} role="none">
                      <button
                        type="button"
                        role="option"
                        id={`${listboxId}-option-${index}`}
                        aria-selected={index === activeIndex}
                        tabIndex={-1}
                        onMouseDown={() => handleSelect(term)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`w-full text-left px-4 py-3 min-h-[48px] text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-between ${
                          index === activeIndex
                            ? "bg-slate-50 dark:bg-slate-700/50"
                            : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="truncate font-medium">{term}</span>
                        </div>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.stopPropagation(); removeFromHistory(term); }}
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                          aria-label={`「${term}」を履歴から削除`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* サジェスト表示（入力がある場合） */}
            {!showHistory && displayedSuggestions.length > 0 && (
              <ul id={listboxId} role="listbox" className="max-h-80 overflow-y-auto py-2">
                {displayedSuggestions.map((suggestion, index) => {
                  // サジェストがオブジェクトか文字列かを判定
                  const isObject = typeof suggestion === 'object' && suggestion !== null;
                  const name = isObject ? suggestion.name : suggestion;
                  const type = isObject ? suggestion.type : null;
                  const image = isObject ? suggestion.image : null;
                  const subText = isObject ? suggestion.subText : null;
                  const selectValue = isObject ? (suggestion.value || suggestion.name) : suggestion;

                  return (
                    <li key={`${name}-${index}`} role="none">
                      <button
                        type="button"
                        role="option"
                        id={`${listboxId}-option-${index}`}
                        aria-selected={index === activeIndex}
                        tabIndex={-1}
                        onMouseDown={() => handleSelect(selectValue)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`w-full text-left px-4 py-2.5 min-h-[56px] text-slate-700 dark:text-slate-200 transition-all duration-150 flex items-center gap-3 ${
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
                          <div className="truncate font-medium text-sm">{name}</div>
                          {subText && (
                            <div className="truncate text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subText}</div>
                          )}
                        </div>

                        {/* カテゴリバッジ */}
                        {type && (
                          <span className={`flex-shrink-0 px-2 py-0.5 text-xs rounded-full font-medium ${
                            type === 'plant'
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                              : type === 'butterfly'
                              ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300'
                              : type === 'beetle'
                              ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                              : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300'
                          }`}>
                            {type === 'moth' ? '蛾' : type === 'butterfly' ? '蝶' : type === 'beetle' ? '甲虫' : type === 'plant' ? '植物' : type}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchInput;
