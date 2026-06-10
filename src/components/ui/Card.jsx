import { forwardRef } from 'react';
import { cx } from './cx';

/**
 * トークン化された面（surface / line / radius / elevation）を持つ汎用カード。
 * - as でタグを差し替え（'article' 等）、ref は転送する。
 * - interactive=true でホバー時の影を付与。固有のホバー色等は className で足す。
 */
const Card = forwardRef(function Card(
  { as: Tag = 'div', interactive = false, className = '', children, ...rest },
  ref,
) {
  return (
    <Tag
      ref={ref}
      className={cx(
        'rounded-card border border-line bg-surface shadow-e1',
        interactive && 'transition hover:shadow-e2',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default Card;
