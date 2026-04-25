const stickyTopStyle = {
  top: 'calc(var(--app-main-header-height, 0px) + var(--app-sticky-header-height, 0px) + 12px)',
};

export default function ListFilterPanel({
  title,
  isOpen,
  onToggle,
  panelId,
  hasAnyCriteria = false,
  filteredByLabel = '',
  activeFilters = [],
  onResetAll,
  resetAllLabel = '',
  getClearFilterLabel,
  controlsClassName = '',
  resultsLabel = '',
  children,
}) {
  return (
    <div className="mt-4">
      <div className="md:sticky md:z-40" style={stickyTopStyle}>
        <div className="rounded-xl bg-white/70 dark:bg-slate-900/55 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onToggle}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isOpen
                  ? 'bg-slate-200/80 text-slate-800 dark:bg-slate-700/80 dark:text-slate-200'
                  : 'bg-white/70 text-slate-600 border border-slate-300/70 hover:bg-slate-50/80 dark:bg-slate-800/70 dark:text-slate-300 dark:border-slate-600/70 dark:hover:bg-slate-700/70'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {title}
              <svg className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className="flex flex-wrap gap-2 items-center flex-1">
              {hasAnyCriteria && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1">
                  {filteredByLabel}
                </span>
              )}
              {activeFilters.map((filter, idx) => (
                <span
                  key={`${filter.type}-${idx}`}
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200 border border-slate-200/60 dark:border-slate-700/60 transition-all hover:bg-slate-200/70 dark:hover:bg-slate-800"
                >
                  {filter.type}: {filter.value}
                  <button
                    onClick={filter.clear}
                    className="ml-1.5 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-100 focus:outline-none"
                    aria-label={getClearFilterLabel ? getClearFilterLabel(filter.type) : ''}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              {hasAnyCriteria && onResetAll && (
                <button type="button" onClick={onResetAll} className="ui-btn ui-btn-secondary">
                  {resetAllLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        id={panelId}
        aria-hidden={!isOpen}
        inert={!isOpen ? true : undefined}
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <fieldset disabled={!isOpen} className={controlsClassName}>
          {children}
        </fieldset>
      </div>

      <div className="mt-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300" role="status" aria-live="polite">
        {resultsLabel}
      </div>
    </div>
  );
}
