import { Fragment, useId, useState } from 'react';
import { getReferenceMetaList } from '../../utils/sourceLinks';
import { isAmazonAssociateUrl } from '../../utils/amazonAssociates';
import { cx } from './cx';
import { RecordToggle } from './RecordRow';

export function SourceReferenceList({ items, label, isEnglish = false, renderDetails }) {
  return (
    <ul aria-label={label} className="mb-2 divide-y divide-line rounded-lg border border-line bg-slate-50/70 px-3 dark:bg-slate-900/40">
      {items.map((item) => {
        const title = item.label || item.displayLabel || (isEnglish ? 'Source unspecified' : '出典の記載なし');
        const details = renderDetails?.(item);
        return (
          <li key={item.key || title} className="min-w-0 space-y-1 py-2 text-xs">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 break-words text-ink-muted">
              {item.link ? (
                <a href={item.link} target="_blank" rel={isAmazonAssociateUrl(item.link) ? 'sponsored noopener noreferrer' : 'noopener noreferrer'} className="font-semibold text-ink underline underline-offset-2">
                  {title}
                </a>
              ) : (
                <span className="font-medium text-ink">{title}</span>
              )}
              {item.publication && item.publication !== title && <span>{item.publication}</span>}
              {item.pages && <span>{isEnglish ? `pp. ${item.pages}` : `${item.pages}頁`}</span>}
              {item.location && <span>{item.location}</span>}
              {details?.badges}
            </div>
            {details?.notes}
          </li>
        );
      })}
    </ul>
  );
}

const splitPlain = (sources) =>
  (Array.isArray(sources) ? sources : [sources])
    .flatMap((v) => String(v || '').split(/[;；]/))
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * 出典の統一表示（サイト全体で配置・トーンを単一化）。
 * - 詳細ページでは collapsible を指定し、出典件数から書誌を展開する。
 * - 一覧などの既存呼び出しでは控えめな書誌の行を表示する。
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
  collapsible = false,
  renderInlineToggle,
  describedBy,
  className = '',
}) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  if (!sources || (Array.isArray(sources) && sources.length === 0)) return renderInlineToggle?.(null) ?? null;

  const items = resolveLinks
    ? getReferenceMetaList(sources, { compact: collapsible })
    : (collapsible ? [...new Set(splitPlain(sources))] : splitPlain(sources))
      .map((displayLabel) => ({ displayLabel, link: null }));

  if (!items.length) return renderInlineToggle?.(null) ?? null;

  if (collapsible) {
    const countLabel = isEnglish ? `Sources (${items.length})` : `出典 ${items.length}件`;
    const toggle = (
      <RecordToggle
        expanded={expanded}
        controls={panelId}
        describedBy={describedBy}
        onToggle={() => setExpanded(!expanded)}
        compact={Boolean(renderInlineToggle)}
      >
        {countLabel}
      </RecordToggle>
    );
    const panel = (
      <div id={panelId} hidden={!expanded} className={renderInlineToggle ? 'mt-1' : undefined}>
        {expanded && <SourceReferenceList items={items} label={countLabel} isEnglish={isEnglish} />}
      </div>
    );

    if (renderInlineToggle) return <>{renderInlineToggle(toggle)}{panel}</>;

    return (
      <div className={className}>
        <div className="flex justify-end">{toggle}</div>
        {panel}
      </div>
    );
  }

  const resolvedLabel = label ?? (isEnglish ? 'Source' : '出典');

  return (
    <p className={cx('text-xs leading-5 text-ink-muted', className)}>
      <span className="font-medium text-ink-muted">{resolvedLabel}</span>{' '}
      {items.map(({ displayLabel, link }, i) => (
        <Fragment key={`${displayLabel}-${i}`}>
          {i > 0 && <span className="text-ink-subtle">, </span>}
          {link ? (
            <a
              href={link}
              target="_blank"
              rel={isAmazonAssociateUrl(link) ? 'sponsored noopener noreferrer' : 'noopener noreferrer'}
              // 指で押しやすいよう上下に余白を足して高さ24pxにする（以前は文字の高さ15pxだけだった）
              className="inline-block py-0.5 underline decoration-line underline-offset-2 transition-colors hover:text-ink hover:decoration-ink-muted"
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
