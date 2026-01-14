import React, { useEffect, useId, useMemo, useRef, useState } from 'react';

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

  // モバイルではサジェスト件数を5件に制限
  const maxSuggestions = isMobile ? 5 : 10;
  const displayedSuggestions = useMemo(
    () => suggestions.slice(0, maxSuggestions),
    [suggestions, maxSuggestions]
  );

  const expanded = showSuggestions && displayedSuggestions.length > 0;
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
      
      {showSuggestions && displayedSuggestions.length > 0 && (
        <div
          className="absolute z-20 top-full left-0 right-0 -mt-px"
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-t-0 border-slate-200/50 dark:border-slate-600/50 rounded-b-2xl shadow-lg overflow-hidden">
            <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-2">
              {displayedSuggestions.map((suggestion, index) => (
                <li key={`${suggestion}-${index}`} role="none">
                  <button
                    type="button"
                    role="option"
                    id={`${listboxId}-option-${index}`}
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    onMouseDown={() => handleSelect(suggestion)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full text-left px-4 py-3 min-h-[48px] text-slate-700 dark:text-slate-200 transition-colors flex items-center space-x-3 ${
                      index === activeIndex
                        ? "bg-slate-50 dark:bg-slate-700/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="truncate font-medium">{suggestion}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchInput;
