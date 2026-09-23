const buttonBase =
  'inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900';

const formatCount = (value, locale) =>
  Number(value || 0).toLocaleString(locale === 'en' ? 'en-US' : 'ja-JP');

/**
 * 絞り込みチップの列。
 * scrollable: スマホでは折り返さず横スクロールの1行にする（結果を初期画面から押し出さないため）。
 * sm以上は従来どおり見出し付きで折り返す。chip.count があれば件数を添える。
 */
export function PresetFilterChips({ label, chips = [], scrollable = false, locale = 'ja' }) {
  if (!chips.length) return null;
  const renderChip = (chip) => (
    <button
      key={chip.key}
      type="button"
      onClick={chip.onClick}
      aria-pressed={chip.active}
      className={`${buttonBase} ${scrollable ? 'shrink-0 whitespace-nowrap' : ''} ${
        chip.active
          ? 'border-emerald-300 bg-emerald-100 text-emerald-800 focus:ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
          : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700'
      } ${!chip.active && chip.count === 0 ? 'opacity-50' : ''}`}
    >
      {chip.label}
      {typeof chip.count === 'number' && (
        <span
          className={`ml-1.5 font-medium tabular-nums ${
            chip.active ? 'text-emerald-700/80 dark:text-emerald-200/80' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {formatCount(chip.count, locale)}
        </span>
      )}
    </button>
  );

  if (scrollable) {
    return (
      <div role="group" aria-label={label || undefined}>
        <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 py-1 scrollbar-none scroll-fade-right sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:py-0 sm-scroll-fade-none">
          {label && (
            <span className="hidden shrink-0 text-xs font-semibold text-slate-500 dark:text-slate-400 sm:inline">
              {label}
            </span>
          )}
          {chips.map(renderChip)}
          {/* 最後のチップが右端のフェードに隠れたままにならないよう末尾に余白を足す */}
          <span aria-hidden="true" className="w-5 shrink-0 sm:hidden" />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 sm:mt-3">
      {label && (
        <span className="w-full text-xs font-semibold text-slate-500 dark:text-slate-400 sm:w-auto">
          {label}
        </span>
      )}
      {chips.map(renderChip)}
    </div>
  );
}

const selectClassName =
  'max-w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200';

const ViewModeToggle = ({ viewMode, onViewModeChange, labels }) => (
  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
    {[
      { value: 'cards', label: labels.cards },
      { value: 'compact', label: labels.compact },
    ].map((item) => (
      <button
        key={item.value}
        type="button"
        onClick={() => onViewModeChange(item.value)}
        className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
          viewMode === item.value
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
        }`}
        aria-pressed={viewMode === item.value}
      >
        {item.label}
      </button>
    ))}
  </div>
);

const SortSelect = ({ sortMode, onSortModeChange, sortOptions, label }) => (
  <label className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
    {label}
    <select
      value={sortMode}
      onChange={(event) => onSortModeChange(event.target.value)}
      className={selectClassName}
    >
      {sortOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

/** 表示件数の選択（sm以上では詳細フィルタ内、スマホでは表示設定の行に置く） */
export function PerPageSelect({ value = 'auto', autoItemsPerPage, onChange, labels, block = false }) {
  if (!onChange) return null;
  return (
    <label
      className={
        block
          ? 'block space-y-1 text-xs font-medium text-slate-500 dark:text-slate-400'
          : 'flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400'
      }
    >
      <span className={block ? 'ml-1 block' : ''}>{labels.perPage}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={block ? `${selectClassName} w-full py-2` : selectClassName}
      >
        <option value="auto">{labels.autoPerPage ? labels.autoPerPage(autoItemsPerPage) : 'Auto'}</option>
        {[20, 50, 100].map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * 表示方法（カード/コンパクト）・表示件数・並び替え。
 * variant="inline": sm以上の詳細フィルタ見出し行に並べる省スペース版（表示件数は詳細フィルタ内へ）
 */
export function ListDisplayControls({
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
  sortOptions = [],
  itemsPerPageValue = 'auto',
  autoItemsPerPage,
  onItemsPerPageChange,
  labels,
  variant = 'full',
}) {
  if (variant === 'inline') {
    return (
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} labels={labels} />
        <SortSelect
          sortMode={sortMode}
          onSortModeChange={onSortModeChange}
          sortOptions={sortOptions}
          label={labels.sort}
        />
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border border-slate-200/70 bg-white/70 p-2.5 dark:border-slate-700/70 dark:bg-slate-900/50 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {labels.view}
        </span>
        <ViewModeToggle viewMode={viewMode} onViewModeChange={onViewModeChange} labels={labels} />
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <PerPageSelect
          value={itemsPerPageValue}
          autoItemsPerPage={autoItemsPerPage}
          onChange={onItemsPerPageChange}
          labels={labels}
        />
        <SortSelect
          sortMode={sortMode}
          onSortModeChange={onSortModeChange}
          sortOptions={sortOptions}
          label={labels.sort}
        />
      </div>
    </div>
  );
}
