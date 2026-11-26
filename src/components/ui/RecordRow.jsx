import { Link, useLocation } from 'react-router-dom';
import { makeDetailLinkState } from '../../utils/navState';
import { buildPlantPath } from '../../utils/siteTaxonomy';

export function RecordRow({ children, action, compact = false }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 sm:gap-x-4">
      <div className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1${compact ? '' : ' py-2.5'}`}>
        {children}
      </div>
      {action}
    </div>
  );
}

export function RecordPlantLink({ name, locale, children, family = false }) {
  const location = useLocation();
  return (
    <Link
      to={buildPlantPath(name, locale)}
      state={makeDetailLinkState(location)}
      className={`min-w-0 break-words underline-offset-2 hover:underline ${family ? 'text-xs text-ink-muted' : 'text-sm font-semibold text-emerald-800 dark:text-emerald-300'}`}
    >
      {children}
    </Link>
  );
}

export function RecordToggle({ expanded, controls, describedBy, label, onToggle, children, compact = false }) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-describedby={describedBy}
      aria-label={label}
      onClick={onToggle}
      className={`inline-flex ${compact ? 'min-h-6' : 'min-h-[44px]'} items-center gap-1.5 whitespace-nowrap px-1 text-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500`}
    >
      {children}
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className={`h-3.5 w-3.5 ${expanded ? 'rotate-180' : ''}`}>
        <path d="m5 8 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
