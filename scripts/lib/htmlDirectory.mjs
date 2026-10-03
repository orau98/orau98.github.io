// XMLと同じ正規・indexableな詳細ページを、人もたどれる名前一覧にする。
// 検索UIや旧 /meta/ の互換ルートから独立させ、JSによる置換でリンクを失わない。
const ORIGIN = 'https://orau98.github.io';
const escapeHtml = (value) => String(value).replace(/&/g, '&amp;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const decodeText = (value) => value.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

export function directoryLabel(html) {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  return decodeText(heading.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim());
}

export const directoryPath = (key, page = 1) => `/sitemap/${key}/${page === 1 ? '' : `${page}/`}`;

export function buildHtmlDirectory(sections, { pageSize = 200 } = {}) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid directory page size');
  const pages = [];
  for (const { key, title, entries } of sections) {
    if (!/^[a-z]+$/.test(key)) throw new Error(`Invalid directory section: ${key}`);
    const unique = new Map();
    for (const { loc, label } of entries) {
      const url = new URL(loc);
      if (url.origin !== ORIGIN || !url.pathname.startsWith(`/${key}/`) ||
          url.pathname === `/${key}/` || url.search || url.hash || !label) {
        throw new Error(`Invalid directory entry: ${loc}`);
      }
      unique.set(url.href, { loc: url.pathname, label });
    }
    const items = [...unique.values()].sort((a, b) =>
      a.label.localeCompare(b.label, 'ja') || a.loc.localeCompare(b.loc, 'en'));
    const count = Math.max(1, Math.ceil(items.length / pageSize));
    for (let page = 1; page <= count; page++) {
      const current = items.slice((page - 1) * pageSize, page * pageSize);
      const route = directoryPath(key, page);
      const heading = `${title}（${page}/${count}ページ）`;
      const description = `${title}を名前順に掲載。全${items.length}件のうち${current.length}件を表示しています。名前を選ぶと、食草・寄主植物や関連する昆虫、出典を確認できます。`;
      const pager = `<nav class="pager" aria-label="一覧のページ送り">${Array.from({ length: count }, (_, i) => {
        const number = i + 1;
        return number === page ? `<span aria-current="page">${number}</span>`
          : `<a href="${directoryPath(key, number)}"${number === page + 1 ? ' rel="next"' : number === page - 1 ? ' rel="prev"' : ''}>${number}</a>`;
      }).join('')}</nav>`;
      const structured = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: heading, url: ORIGIN + route, inLanguage: 'ja',
        mainEntity: { '@type': 'ItemList', numberOfItems: current.length,
          itemListElement: current.map((item, i) => ({ '@type': 'ListItem', position: i + 1,
            name: item.label, url: ORIGIN + item.loc })) },
      }).replace(/</g, '\\u003c');
      pages.push({ route, html: `<!doctype html>
<html lang="ja"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(heading)} | 昆虫植物図鑑</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${ORIGIN}${route}">
  <meta property="og:title" content="${escapeHtml(heading)} | 昆虫植物図鑑">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${ORIGIN}${route}">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary">
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <script defer src="/assets/analytics-loader.js" data-measurement-id="G-MFEQF99G0H"></script>
  <script type="application/ld+json">${structured}</script>
  <style>
    *{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font:16px/1.7 system-ui,sans-serif}
    main,header,footer{max-width:1000px;margin:auto;padding:20px}header{border-bottom:1px solid #cbd5e1}
    a{color:#166534;text-underline-offset:3px}a:focus-visible{outline:3px solid #0284c7;outline-offset:3px}
    h1{font-size:clamp(1.35rem,4vw,1.9rem);line-height:1.4}.lead{color:#475569}
    .names{list-style:none;padding:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0 20px}
    .names li{min-width:0;border-bottom:1px solid #e2e8f0}.names a{display:block;padding:10px 0;overflow-wrap:anywhere}
    .pager{display:flex;flex-wrap:wrap;gap:8px;margin:20px 0}.pager a,.pager span{padding:7px 13px;background:#fff;border:1px solid #cbd5e1;border-radius:6px}
    .pager [aria-current]{background:#166534;color:#fff}footer{border-top:1px solid #cbd5e1}
    @media(max-width:700px){.names{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:420px){.names{grid-template-columns:1fr}}
  </style>
</head><body>
  <header><a href="/">昆虫植物図鑑</a> / <a href="/sitemap.html">名前から探す</a></header>
  <main><h1>${escapeHtml(heading)}</h1><p class="lead">${escapeHtml(description)}</p>
    <p><a href="/${key === 'plant' ? 'plant' : 'moth'}/">検索画面で名前・条件を絞り込む</a></p>
    ${pager}
    <ul class="names">${current.map(({ loc, label }) => `<li><a href="${escapeHtml(loc)}">${escapeHtml(label)}</a></li>`).join('\n')}</ul>
    ${pager}
  </main><footer><a href="/sitemap.html">ほかの昆虫・植物の一覧へ</a></footer>
</body></html>\n` });
    }
  }
  return pages;
}
