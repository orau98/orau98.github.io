import { cx } from './cx';

/**
 * 詳細ページ等のセクション見出し。タイトル＋任意の件数＋右側アクション枠。
 */
export default function SectionHeader({
  title,
  count = null,
  action = null,
  icon = null,
  className = '',
}) {
  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        {icon}
        <span>{title}</span>
        {count != null && (
          <span className="text-sm font-semibold text-ink-muted">({count})</span>
        )}
      </h2>
      {action}
    </div>
  );
}
