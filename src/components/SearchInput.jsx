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
          className="w-full pl-11 pr-12 py-3.5 bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500"
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
            <ul className="max-h-64 overflow-y-auto py-2">
              {suggestions.map((suggestion, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onMouseDown={() => handleSelect(suggestion)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 transition-colors flex items-center space-x-3"
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
