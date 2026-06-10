import { cx } from './cx';

/**
 * 既存の .ui-btn ユーティリティ（src/index.css）を集約する薄いラッパ。
 * スタイルは再発明せず、variant でクラスを切り替えるだけ。as で <Link> 等に差し替え可能。
 */
const VARIANTS = {
  primary: 'ui-btn ui-btn-primary',
  secondary: 'ui-btn ui-btn-secondary',
  ghost: 'ui-btn ui-btn-ghost',
};

export default function Button({
  as: Tag = 'button',
  variant = 'secondary',
  className = '',
  children,
  ...rest
}) {
  return (
    <Tag className={cx(VARIANTS[variant] || VARIANTS.secondary, className)} {...rest}>
      {children}
    </Tag>
  );
}
