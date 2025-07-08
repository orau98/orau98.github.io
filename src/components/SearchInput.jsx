import React, { useState } from 'react';

const SearchInput = ({ value, onChange, placeholder, suggestions = [], onSelectSuggestion }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleChange = (e) => {
    onChange(e);
    setShowSuggestions(true);
  };

  const handleSelect = (suggestion) => {
    onSelectSuggestion(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 100)}
        className="w-full px-4 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition shadow-sm hover:shadow-md"
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onMouseDown={() => handleSelect(suggestion)}
              className="px-4 py-2 cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SearchInput;
