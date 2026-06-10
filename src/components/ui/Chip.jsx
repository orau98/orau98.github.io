import { cx } from './cx';

/**
 * トグル可能なクイックフィルタ用ピル（フィルタの ON/OFF）。
 * active で選択状態を表現し、aria-pressed を付与する。
 */
export default function Chip({ active = false, className = '', children, ...rest }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-95',
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-900/30 dark:text-brand-200'
          : 'border-line bg-surface text-ink-muted hover:border-brand-400/60 hover:text-brand-600 dark:hover:text-brand-300',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
