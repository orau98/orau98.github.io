const buttonBase =
  'inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-slate-900';

export function PresetFilterChips({ label, chips = [] }) {
  if (!chips.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {label && (
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
      )}
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onClick}
          aria-pressed={chip.active}
          className={`${buttonBase} ${
            chip.active
              ? 'border-emerald-300 bg-emerald-100 text-emerald-800 focus:ring-emerald-400 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
              : 'border-slate-200 bg-white/80 text-slate-600 hover:bg-slate-50 focus:ring-slate-300 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-700'
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

export function ListDisplayControls({
  viewMode,
  onViewModeChange,
  sortMode,
  onSortModeChange,
  sortOptions = [],
  labels,
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white/70 p-3 dark:border-slate-700/70 dark:bg-slate-900/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {labels.view}
        </span>
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
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
        {labels.sort}
        <select
          value={sortMode}
          onChange={(event) => onSortModeChange(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
