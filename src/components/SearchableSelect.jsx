import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { normalizeForSearch } from '../utils/text';

// メイン検索と同じかな正規化を通し、「ぶな」でも「ブナ」候補が出るようにする
const normalize = (value = '') => normalizeForSearch(value);

export default function SearchableSelect({
  id,
  label,
  value = '',
  options = [],
  onChange,
  placeholder = '',
  emptyLabel = '',
  locale = 'ja',
}) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const listboxId = `${inputId}-listbox`;
  const isEnglish = locale === 'en';
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const blurTimerRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => () => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
  }, []);

  const { filteredOptions, hiddenMatchCount } = useMemo(() => {
    const q = normalize(query);
    const unique = Array.from(new Set((options || []).filter(Boolean)));
    let matched;
    if (!q) {
      matched = unique;
    } else {
      const startsWith = [];
      const includes = [];
      unique.forEach((option) => {
        const text = normalize(option);
        if (text.startsWith(q)) startsWith.push(option);
        else if (text.includes(q)) includes.push(option);
      });
      matched = [...startsWith, ...includes];
    }
    // 表示は40件まで。切り捨てた件数はリスト末尾に案内する
    // （上限を知らせないと、41件目以降の候補が「存在しない」ように見える）
    return {
      filteredOptions: matched.slice(0, 40),
      hiddenMatchCount: Math.max(0, matched.length - 40),
    };
  }, [options, query]);

  const selectedLabel = value || '';
  const hasValue = !!selectedLabel;

  const selectOption = (option) => {
    setQuery(option || '');
    setOpen(false);
    setActiveIndex(0);
    onChange?.(option || '');
  };

  const clearValue = () => {
    setQuery('');
    setOpen(false);
    setActiveIndex(0);
    onChange?.('');
  };

  const handleBlur = () => {
    blurTimerRef.current = setTimeout(() => {
      setOpen(false);
      setActiveIndex(0);
      setQuery(value || '');
    }, 120);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === 'Enter') {
      if (!open || filteredOptions.length === 0) return;
      event.preventDefault();
      selectOption(filteredOptions[activeIndex] || filteredOptions[0]);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery(value || '');
    }
  };

  return (
    <div className="space-y-1">
      <label className="ml-1 text-xs font-medium text-slate-500 dark:text-slate-400" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && filteredOptions[activeIndex] ? `${listboxId}-${activeIndex}` : undefined}
          value={query}
          placeholder={placeholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
            if (!event.target.value) onChange?.('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-16 text-sm text-slate-700 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-1">
          {hasValue && (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearValue}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 sm:min-h-0 sm:min-w-0 sm:p-2"
              aria-label={isEnglish ? `Clear ${label}` : `${label}を解除`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {open && (
          <div
            id={listboxId}
            role="listbox"
            className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  id={`${listboxId}-${index}`}
                  role="option"
                  aria-selected={option === selectedLabel}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                  className={`block w-full px-3 py-2 text-left text-sm transition ${
                    index === activeIndex
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                      : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {option}
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                {emptyLabel || (isEnglish ? 'No options found' : '候補がありません')}
              </div>
            )}
            {hiddenMatchCount > 0 && (
              <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
                {isEnglish
                  ? `${hiddenMatchCount} more — keep typing to narrow down`
                  : `他${hiddenMatchCount}件 — 入力で絞り込めます`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
