import React, { useState } from 'react';

const SearchInput = ({ value, onChange, placeholder, suggestions = [], onSelectSuggestion }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleChange = (e) => {
    // 入力値はそのまま保持（変換しない）
    onChange(e);
    setShowSuggestions(true);
  };

  const handleSelect = (suggestion) => {
    onSelectSuggestion(suggestion);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    if (typeof onChange === "function") {
      onChange({ target: { value: "" } });
    }
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
          className="w-full pl-10 pr-12 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200/50 dark:border-slate-600/50 rounded-xl focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 dark:focus:ring-blue-400/50 dark:focus:border-blue-400/50 transition-all duration-200 shadow-sm hover:shadow-md placeholder-slate-400 dark:placeholder-slate-500 text-slate-700 dark:text-slate-200"
        />
        {value && value.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute inset-y-0 right-2 flex items-center justify-center w-8 h-8 my-1 rounded-full text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-700/70 transition-colors"
            aria-label="検索入力をクリア"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 w-full mt-1">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-600/50 rounded-xl shadow-xl overflow-hidden">
            <ul className="max-h-60 overflow-y-auto">
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onMouseDown={() => handleSelect(suggestion)}
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-all duration-200 border-b border-slate-100/50 dark:border-slate-700/50 last:border-b-0 flex items-center space-x-2"
                  >
                    <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="truncate">{suggestion}</span>
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
