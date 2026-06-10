/**
 * 極小 classNames ヘルパー。falsy を除いてスペース結合する。
 * 例: cx('a', cond && 'b', className)
 */
export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}
