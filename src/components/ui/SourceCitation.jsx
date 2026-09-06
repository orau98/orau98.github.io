import { Fragment } from 'react';
import { getReferenceMetaList } from '../../utils/sourceLinks';
import { isAmazonAssociateUrl } from '../../utils/amazonAssociates';
import { cx } from './cx';

const splitPlain = (sources) =>
  (Array.isArray(sources) ? sources : [sources])
    .flatMap((v) => String(v || '').split(/[;；]/))
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * 出典の統一表示（サイト全体で配置・トーンを単一化）。
 * - 常に「本文の下・独立した1行」に、控えめ（text-xs / ink-muted）で表示する。
 *   ＝ インライン（文の右）と混在させない。出典の多いデータベースでは、本文を汚さず
 *   内容の長さに依存せず一貫して読める「下配置」を採用。
 * - resolveLinks=true（既定）: getReferenceMetaList で正規化・重複除去・URL 解決（昆虫文献キー向き）。
 * - resolveLinks=false: 与えられた文字列をそのまま表示（ページ番号付きの植物プロフィール等、
 *   正規化でページが消える用途）。
 * - リンク可能なものだけ地味な下線でクリック可能性を残す（出典明記はサイトの長所なので残す）。
 */
export default function SourceCitation({
  sources,
  isEnglish = false,
  resolveLinks = true,
  label,
  className = '',
}) {
  if (!sources || (Array.isArray(sources) && sources.length === 0)) return null;

  const items = resolveLinks
    ? getReferenceMetaList(sources)
    : splitPlain(sources).map((displayLabel) => ({ displayLabel, link: null }));

  if (!items.length) return null;

  const resolvedLabel = label ?? (isEnglish ? 'Source' : '出典');

  return (
    <p className={cx('text-xs leading-5 text-ink-muted', className)}>
      <span className="text-ink-subtle">{resolvedLabel}</span>{' '}
      {items.map(({ displayLabel, link }, i) => (
        <Fragment key={`${displayLabel}-${i}`}>
          {i > 0 && <span className="text-ink-subtle">, </span>}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel={isAmazonAssociateUrl(link) ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
              className="underline decoration-line underline-offset-2 transition-colors hover:text-ink hover:decoration-ink-muted"
            >
              {displayLabel}
            </a>
          ) : (
            <span>{displayLabel}</span>
          )}
        </Fragment>
      ))}
    </p>
  );
}
