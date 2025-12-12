import React, { useEffect, useId, useMemo, useState } from 'react';

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
  const expanded = showSuggestions && suggestions.length > 0;
  const activeDescendantId = useMemo(() => {
    if (!expanded || activeIndex < 0) return undefined;
    return `${listboxId}-option-${activeIndex}`;
  }, [activeIndex, expanded, listboxId]);

  const handleChange = (e) => {
    // 入力値はそのまま保持（変換しない）
    onChange(e);
    setShowSuggestions(true);
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
      if (e.key === "ArrowDown" && suggestions.length > 0) {
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
        return next >= suggestions.length ? 0 : next;
      });
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => {
        if (prev <= 0) return suggestions.length - 1;
        return prev - 1;
      });
      return;
    }
    if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        e.preventDefault();
        handleSelect(suggestions[activeIndex]);
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
      if (suggestions.length === 0) return -1;
      if (prev >= suggestions.length) return suggestions.length - 1;
      return prev;
    });
  }, [expanded, suggestions.length]);

  return (
    <div className="relative group">
      <div className={`relative z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 transition-all duration-200 shadow-sm ${showSuggestions && suggestions.length > 0 ? 'rounded-t-2xl rounded-b-none border-b-0 shadow-lg' : 'rounded-2xl hover:shadow-md'}`}>
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
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-label={ariaLabel || placeholder || "検索"}
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listboxId : undefined}
          aria-activedescendant={activeDescendantId}
          className="w-full pl-11 pr-12 py-3.5 bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:ring-offset-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
        />
        {value && value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-3 flex items-center justify-center w-8 h-8 my-auto rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-700/70 transition-colors"
            aria-label="検索入力をクリア"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 -mt-px">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-t-0 border-slate-200/50 dark:border-slate-600/50 rounded-b-2xl shadow-lg overflow-hidden">
            <ul id={listboxId} role="listbox" className="max-h-64 overflow-y-auto py-2">
              {suggestions.map((suggestion, index) => (
                <li key={`${suggestion}-${index}`} role="none">
                  <button
                    type="button"
                    role="option"
                    id={`${listboxId}-option-${index}`}
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    onMouseDown={() => handleSelect(suggestion)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={`w-full text-left px-4 py-3 text-slate-700 dark:text-slate-200 transition-colors flex items-center space-x-3 ${
                      index === activeIndex
                        ? "bg-slate-50 dark:bg-slate-700/50"
                        : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
