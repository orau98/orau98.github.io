import { cx } from './cx';

/**
 * 静的ラベル用の小型ピル（写真有無・件数・観察種別・利用部位など）。
 * tone でカラーファミリーを、variant で塗り方を選ぶ。データ意味色（生活史/部位）は
 * 既存の Tailwind クラス文字列を className 経由で渡せる（getLifeStageIcon 等が真実源）。
 */
const SOFT_TONES = {
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  neutral: 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300',
};

export default function Badge({
  tone = 'neutral',
  variant = 'soft',
  className = '',
  children,
  ...rest
}) {
  const toneClass =
    variant === 'outline'
      ? 'border border-line bg-surface/60 dark:bg-surface/30'
      : SOFT_TONES[tone] || SOFT_TONES.neutral;

  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-5',
        toneClass,
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
