import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_ORIGIN = 'https://orau98.github.io';

const failures = [];

const ensure = (condition, message) => {
  if (!condition) failures.push(message);
};

const readFile = (filePath) => fs.readFileSync(filePath, 'utf8');

const collectHtmlFiles = (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return collectHtmlFiles(fullPath);
    if (entry.isFile() && entry.name.endsWith('.html')) return [fullPath];
    return [];
  });
};

const getTags = (html, tagName) =>
  html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) || [];

const decodeHtmlAttribute = (value) =>
  String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&');

const parseAttributes = (tag) => {
  const attrs = {};
  tag.replace(/([:@\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, key, _quoted, dq, sq) => {
    attrs[key.toLowerCase()] = decodeHtmlAttribute(dq ?? sq ?? '');
    return '';
  });
  return attrs;
};

const getTitle = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
};

const getMetaContent = (html, attrName, attrValue) => {
  const needleName = String(attrName || '').toLowerCase();
  const needleValue = String(attrValue || '');
  for (const tag of getTags(html, 'meta')) {
    const attrs = parseAttributes(tag);
    if (attrs[needleName] === needleValue) {
      return String(attrs.content || '').trim();
    }
  }
  return '';
};

const getLinkHref = (html, relValue) => {
  const targetRel = String(relValue || '').toLowerCase();
  for (const tag of getTags(html, 'link')) {
    const attrs = parseAttributes(tag);
    if (String(attrs.rel || '').toLowerCase() === targetRel) {
      return String(attrs.href || '').trim();
    }
  }
  return '';
};

const getAlternateLinks = (html) => {
  const links = [];
  for (const tag of getTags(html, 'link')) {
    const attrs = parseAttributes(tag);
    if (String(attrs.rel || '').toLowerCase() !== 'alternate') continue;
    const hreflang = String(attrs.hreflang || '').trim().toLowerCase();
    const href = String(attrs.href || '').trim();
    if (hreflang && href) links.push({ hreflang, href });
  }
  return links;
};

const getMetaHttpEquivContent = (html, httpEquivValue) => {
  const targetEquiv = String(httpEquivValue || '').toLowerCase();
  for (const tag of getTags(html, 'meta')) {
    const attrs = parseAttributes(tag);
    if (String(attrs['http-equiv'] || '').toLowerCase() === targetEquiv) {
      return String(attrs.content || '').trim();
    }
  }
  return '';
};

const getJsonLdCount = (html) =>
  (html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) || []).length;

const getJsonLdBlocks = (html) =>
  Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi))
    .map((match) => match[1].trim())
    .filter(Boolean);

const hasType = (node, typeName) => {
  const value = node?.['@type'];
  if (Array.isArray(value)) return value.includes(typeName);
  return value === typeName;
};

const collectNodesByType = (node, typeName, collected = []) => {
  if (!node || typeof node !== 'object') return collected;
  if (hasType(node, typeName)) collected.push(node);
  if (Array.isArray(node)) {
    node.forEach((item) => collectNodesByType(item, typeName, collected));
    return collected;
  }
  Object.values(node).forEach((value) => collectNodesByType(value, typeName, collected));
  return collected;
};

const validateJsonLd = (filePath, html) => {
  const relativePath = path.relative(ROOT, filePath);
  for (const block of getJsonLdBlocks(html)) {
    let payload = null;
    try {
      payload = JSON.parse(block);
    } catch (error) {
      ensure(false, `${relativePath}: invalid JSON-LD (${error.message})`);
      continue;
    }

    const datasets = collectNodesByType(payload, 'Dataset');
    datasets.forEach((dataset) => {
      const name = String(dataset.name || dataset['@id'] || 'Dataset');
      const description = String(dataset.description || '').trim();
      ensure(
        description.length >= 50 && description.length <= 5000,
        `${relativePath}: Dataset description for ${name} must be 50-5000 characters`,
      );
    });
  }
};

const resolveSitePathToDistPath = (hrefOrPath) => {
  if (!hrefOrPath) return null;
  let url = null;
  if (/^https?:\/\//i.test(hrefOrPath)) {
    try {
      url = new URL(hrefOrPath);
    } catch {
      return null;
    }
  } else {
    try {
      url = new URL(String(hrefOrPath).startsWith('/') ? hrefOrPath : `/${hrefOrPath}`, SITE_ORIGIN);
    } catch {
      return null;
    }
  }
  if (url.origin !== SITE_ORIGIN) return null;
  const pathname = url.pathname || '/';
  if (pathname === '/' || pathname === '') {
    return path.join(DIST_DIR, 'index.html');
  }
  const rawSegments = pathname
    .split('/')
    .filter(Boolean);
  const decodedSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  const decodedPath = path.join(DIST_DIR, ...decodedSegments);
  const rawPath = path.join(DIST_DIR, ...rawSegments);
  const resolveIndex = (candidate) => {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return path.join(candidate, 'index.html');
    }
    return candidate;
  };
  if (fs.existsSync(decodedPath)) return resolveIndex(decodedPath);
  if (fs.existsSync(rawPath)) return resolveIndex(rawPath);
  return pathname.endsWith('/') ? path.join(decodedPath, 'index.html') : decodedPath;
};

const resolveCanonicalToDistPath = (href) => resolveSitePathToDistPath(href);

const validateHtml = (filePath, html, options = {}) => {
  const relativePath = path.relative(ROOT, filePath);
  const title = getTitle(html);
  const description = getMetaContent(html, 'name', 'description');
  const robots = getMetaContent(html, 'name', 'robots');
  const canonical = getLinkHref(html, 'canonical');
  const ogTitle = getMetaContent(html, 'property', 'og:title');
  const ogDescription = getMetaContent(html, 'property', 'og:description');
  const ogUrl = getMetaContent(html, 'property', 'og:url');
  const twitterCard = getMetaContent(html, 'name', 'twitter:card');
  const jsonLdCount = getJsonLdCount(html);
  const shouldRequireAdsenseTags = relativePath === 'dist/en/index.html' ||
    relativePath === 'dist/sitemap.html' ||
    /^dist\/(?:en\/)?meta\/[^/]+\/index\.html$/.test(relativePath);

  ensure(title.length > 0, `${relativePath}: missing <title>`);
  ensure(description.length > 0, `${relativePath}: missing meta description`);
  ensure(robots.length > 0, `${relativePath}: missing robots meta`);
  ensure(canonical.length > 0, `${relativePath}: missing canonical link`);
  ensure(
    canonical.startsWith(SITE_ORIGIN),
    `${relativePath}: canonical must use ${SITE_ORIGIN}`,
  );
  ensure(jsonLdCount >= 1, `${relativePath}: missing JSON-LD`);
  validateJsonLd(filePath, html);
  if (shouldRequireAdsenseTags) {
    ensure(
      html.includes('<meta name="google-adsense-account" content="ca-pub-6982051533473293">'),
      `${relativePath}: missing AdSense account meta`,
    );
    ensure(
      html.includes('https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6982051533473293'),
      `${relativePath}: missing AdSense script`,
    );
  }
  if (options.requireAnalytics === true) {
    ensure(
      html.includes('src="/assets/analytics-loader.js"') &&
        html.includes('data-measurement-id="G-MFEQF99G0H"'),
      `${relativePath}: missing static-page Google Analytics measurement`,
    );
  }

  if (options.requireSocial !== false) {
    ensure(ogTitle.length > 0, `${relativePath}: missing og:title`);
    ensure(ogDescription.length > 0, `${relativePath}: missing og:description`);
    ensure(ogUrl.length > 0, `${relativePath}: missing og:url`);
    ensure(twitterCard.length > 0, `${relativePath}: missing twitter:card`);
  }

  const canonicalTarget = resolveCanonicalToDistPath(canonical);
  if (canonicalTarget) {
    ensure(fs.existsSync(canonicalTarget), `${relativePath}: canonical target not found -> ${canonical}`);
  }
};

const validateLegacyRedirectHtml = (filePath, html) => {
  const relativePath = path.relative(ROOT, filePath);
  const distRelativePath = path.relative(DIST_DIR, filePath).split(path.sep).join('/');
  const robots = getMetaContent(html, 'name', 'robots');
  const canonical = getLinkHref(html, 'canonical');
  const refreshContent = getMetaHttpEquivContent(html, 'refresh');
  const redirectKind = getMetaContent(html, 'name', 'x-redirect-kind');

  const isCrawlableMigration =
    /^(?:en\/)?(?:moth|butterfly|beetle|longhornbeetle|barkbeetle|leafbeetle|aphid)\/.+\/index\.html$/u.test(distRelativePath) ||
    /^(?:en\/)?guides\//u.test(distRelativePath) ||
    redirectKind === 'taxonomy-merge';
  if (isCrawlableMigration) {
    ensure(!robots.includes('noindex'), `${relativePath}: permanent public redirect must be crawlable`);
  } else {
    ensure(robots.includes('noindex'), `${relativePath}: legacy alias redirect must be noindex`);
  }
  ensure(canonical.length > 0, `${relativePath}: missing canonical link`);
  ensure(
    canonical.startsWith(SITE_ORIGIN),
    `${relativePath}: canonical must use ${SITE_ORIGIN}`,
  );
  ensure(refreshContent.length > 0, `${relativePath}: missing meta refresh`);

  const refreshMatch = refreshContent.match(/url\s*=\s*(.+)$/i);
  ensure(Boolean(refreshMatch), `${relativePath}: invalid meta refresh content`);
  if (refreshMatch) {
    const refreshTarget = refreshMatch[1].trim().replace(/^['"]|['"]$/g, '');
    ensure(
      refreshTarget === canonical,
      `${relativePath}: meta refresh target mismatch -> ${refreshTarget}`,
    );
  }

  const canonicalTarget = resolveCanonicalToDistPath(canonical);
  if (canonicalTarget) {
    ensure(fs.existsSync(canonicalTarget), `${relativePath}: canonical target not found -> ${canonical}`);
  }
};

const validatePlantRouteHtml = (filePath, html) => {
  if (html.includes('window.__PLANT_ROUTE_SHELL__')) {
    validateHtml(filePath, html);
    return;
  }
  validateLegacyRedirectHtml(filePath, html);
};

const validateInsectRouteHtml = (filePath, html) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(
    html.includes('window.__INSECT_ROUTE_SHELL__'),
    `${relativePath}: insect detail route must use the SPA shell`,
  );
  ensure(
    html.includes('<div id="root"></div>'),
    `${relativePath}: insect detail route is missing the React root`,
  );
  ensure(
    !getMetaHttpEquivContent(html, 'refresh') && !html.includes('window.location.replace'),
    `${relativePath}: insect detail route must not redirect to a different design`,
  );
  validateHtml(filePath, html);
};

const validateSeoRouteMap = (filePath) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(fs.existsSync(filePath), `${relativePath}: route map not found`);
  if (!fs.existsSync(filePath)) return;

  let payload = null;
  try {
    payload = JSON.parse(readFile(filePath));
  } catch (error) {
    ensure(false, `${relativePath}: invalid JSON (${error.message})`);
    return;
  }

  ensure(payload && typeof payload === 'object' && !Array.isArray(payload), `${relativePath}: route map must be an object`);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;

  const entries = Object.entries(payload);
  ensure(entries.length > 0, `${relativePath}: route map is empty`);
  for (const [key, href] of entries) {
    ensure(typeof href === 'string' && href.startsWith('/en/meta/'), `${relativePath}: invalid href for ${key}`);
    const distPath = resolveSitePathToDistPath(href);
    ensure(Boolean(distPath), `${relativePath}: unresolved href for ${key}`);
    if (distPath) {
      ensure(fs.existsSync(distPath), `${relativePath}: target not found for ${key} -> ${href}`);
      if (fs.existsSync(distPath)) {
        const robots = getMetaContent(readFile(distPath), 'name', 'robots');
        ensure(
          !robots.includes('noindex'),
          `${relativePath}: route map points to noindex target for ${key} -> ${href}`,
        );
      }
    }
  }
};

const validateRobotsTxt = (filePath) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(fs.existsSync(filePath), `${relativePath}: robots.txt not found`);
  if (!fs.existsSync(filePath)) return;

  const body = readFile(filePath);
  // robots.txt の Sitemap 行は「正規インデックス + 補助シード」の2本のみ。
  // 同内容の重複エイリアスを並べると Search Console の統計が分裂する。
  const requiredSitemaps = [
    'sitemap.xml',
    'search-console-discovery-seed.xml',
  ];

  for (const sitemap of requiredSitemaps) {
    ensure(
      body.includes(`Sitemap: ${SITE_ORIGIN}/${sitemap}`),
      `${relativePath}: missing ${sitemap} directive`,
    );
  }
};

const validateSitemapIndex = (filePath, requiredEntries = [`${SITE_ORIGIN}/sitemap-main.xml`]) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(fs.existsSync(filePath), `${relativePath}: sitemap index not found`);
  if (!fs.existsSync(filePath)) return;

  const body = readFile(filePath);
  ensure(
    /<sitemapindex\b/i.test(body),
    `${relativePath}: sitemap must be a sitemap index`,
  );
  ensure(
    !/<urlset\b/i.test(body),
    `${relativePath}: sitemap index should not be a full URL set`,
  );
  for (const requiredEntry of requiredEntries) {
    ensure(
      body.includes(requiredEntry),
      `${relativePath}: missing sitemap index entry -> ${requiredEntry}`,
    );
  }
};

const extractSitemapLocs = (body) => [
  ...body.matchAll(/<loc>([^<]+)<\/loc>/g),
].map((match) => match[1]);

const validateSitemapUrlSet = (filePath, options = {}) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(fs.existsSync(filePath), `${relativePath}: sitemap URL set not found`);
  if (!fs.existsSync(filePath)) return;

  const body = readFile(filePath);
  ensure(/<urlset\b/i.test(body), `${relativePath}: sitemap must be a URL set`);
  ensure(!/<sitemapindex\b/i.test(body), `${relativePath}: URL set should not be a sitemap index`);
  ensure(/<url>\s*<loc>/i.test(body), `${relativePath}: URL set should contain at least one URL`);

  const locs = extractSitemapLocs(body);
  if (options.minUrls) {
    ensure(
      locs.length >= options.minUrls,
      `${relativePath}: expected at least ${options.minUrls} URLs, found ${locs.length}`,
    );
  }

  for (const requiredPrefix of options.requiredPrefixes || []) {
    ensure(
      locs.some((loc) => loc.startsWith(requiredPrefix)),
      `${relativePath}: missing URL prefix -> ${requiredPrefix}`,
    );
  }
};

const validateSpa404 = (filePath) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(fs.existsSync(filePath), `${relativePath}: 404.html not found`);
  if (!fs.existsSync(filePath)) return;

  const html = readFile(filePath);
  const robots = getMetaContent(html, 'name', 'robots');
  ensure(robots.includes('noindex'), `${relativePath}: 404 fallback must be noindex`);
};

ensure(fs.existsSync(DIST_DIR), 'dist directory not found. Run npm run build:app first.');

const rootIndexPath = path.join(DIST_DIR, 'index.html');
ensure(fs.existsSync(rootIndexPath), 'dist/index.html not found');

if (fs.existsSync(rootIndexPath)) {
  validateHtml(rootIndexPath, readFile(rootIndexPath));
}

const englishRootIndexPath = path.join(DIST_DIR, 'en', 'index.html');
if (fs.existsSync(englishRootIndexPath)) {
  validateHtml(englishRootIndexPath, readFile(englishRootIndexPath));
}

const supportHtmlFiles = [
  path.join(DIST_DIR, 'sitemap.html'),
];
for (const filePath of supportHtmlFiles) {
  if (fs.existsSync(filePath)) {
    validateHtml(filePath, readFile(filePath));
  } else {
    ensure(false, `${path.relative(ROOT, filePath)} not found`);
  }
}

// 食草ガイドは廃止したため、ガイドページ在庫の検証は行わない。

const metaDir = path.join(DIST_DIR, 'meta');
const metaFiles = collectHtmlFiles(metaDir).filter(
  (filePath) => !filePath.endsWith('support-test.html'),
);
ensure(metaFiles.length > 0, 'dist/meta HTML files not found');

// 同名植物ページ統合などで生成される別名→正規ページのリダイレクトスタブは
// noindex+meta refreshの薄いHTMLであり、フルページのメタ要件（description/OGP/JSON-LD）
// は課さず、リダイレクトページとしての要件のみ検証する
const isRedirectStub = (html) =>
  getMetaHttpEquivContent(html, 'refresh').length > 0 &&
  (
    getMetaContent(html, 'name', 'robots').includes('noindex') ||
    getMetaContent(html, 'name', 'x-redirect-kind') === 'taxonomy-merge'
  );

// hreflang 相互整合チェック用に、全メタページの状態と indexable ページの
// canonical/alternate を収集する。noindex の参照先も検出対象に含める。
const hreflangPageStates = new Map();
const hreflangRecords = new Map();

const recordHreflangEntry = (filePath, html) => {
  const robots = getMetaContent(html, 'name', 'robots');
  const canonical = getLinkHref(html, 'canonical');
  if (!canonical) return;
  const record = {
    relativePath: path.relative(ROOT, filePath),
    alternates: getAlternateLinks(html),
    robots,
  };
  hreflangPageStates.set(canonical, record);
  if (!robots.includes('noindex')) {
    hreflangRecords.set(canonical, record);
  }
};

const validateInternalMetaLinks = (filePath, html) => {
  const relativePath = path.relative(ROOT, filePath);
  for (const tag of getTags(html, 'a')) {
    const href = String(parseAttributes(tag).href || '').trim();
    if (!href || href.startsWith('#')) continue;

    let targetUrl = null;
    try {
      targetUrl = new URL(href, SITE_ORIGIN);
    } catch {
      continue;
    }
    if (targetUrl.origin !== SITE_ORIGIN) continue;
    if (!/^\/(?:en\/)?meta\//.test(targetUrl.pathname)) continue;

    const targetPath = resolveSitePathToDistPath(targetUrl.href);
    ensure(
      Boolean(targetPath && fs.existsSync(targetPath)),
      `${relativePath}: internal meta link target not found -> ${href}`,
    );
    if (!targetPath || !fs.existsSync(targetPath)) continue;

    const targetHtml = readFile(targetPath);
    ensure(
      !isRedirectStub(targetHtml),
      `${relativePath}: internal meta link points to redirect stub -> ${href}`,
    );
  }
};

const validateMetaFile = (filePath) => {
  const html = readFile(filePath);
  if (isRedirectStub(html)) {
    validateLegacyRedirectHtml(filePath, html);
  } else {
    validateHtml(filePath, html, { requireAnalytics: true });
    recordHreflangEntry(filePath, html);
    validateInternalMetaLinks(filePath, html);
  }
};

for (const filePath of metaFiles) {
  validateMetaFile(filePath);
}

const englishMetaDir = path.join(DIST_DIR, 'en', 'meta');
const englishMetaFiles = collectHtmlFiles(englishMetaDir).filter(
  (filePath) => !filePath.endsWith('support-test.html'),
);
if (fs.existsSync(englishMetaDir)) {
  ensure(englishMetaFiles.length > 0, 'dist/en/meta HTML files not found');
  for (const filePath of englishMetaFiles) {
    validateMetaFile(filePath);
  }
}

// hreflang 相互整合: 別言語ページを hreflang で指す場合、相手側からも
// hreflang で指し返されていないと Google はアノテーション自体を無視する。
// 生成順序の問題（英語スラグマップが空のまま日本語ページが確定するなど）で
// 片側のリンクだけが落ちる回帰をここで検出する。
let hreflangPairChecks = 0;
for (const [canonical, record] of hreflangRecords) {
  for (const alt of record.alternates) {
    if (alt.hreflang === 'x-default') continue;
    if (alt.href === canonical) continue;
    const targetState = hreflangPageStates.get(alt.href);
    if (targetState) {
      const isJapaneseToEnglishPair =
        record.relativePath.startsWith('dist/meta/') &&
        targetState.relativePath.startsWith('dist/en/meta/');
      if (isJapaneseToEnglishPair) {
        ensure(
          !targetState.robots.includes('noindex'),
          `${record.relativePath}: hreflang points to noindex page -> ${targetState.relativePath}`,
        );
      }
      if (targetState.robots.includes('noindex')) continue;
    }
    const target = hreflangRecords.get(alt.href);
    // メタページ在庫外（ホーム等）はここでは対象外
    if (!target) continue;
    hreflangPairChecks++;
    ensure(
      target.alternates.some((back) => back.href === canonical),
      `${record.relativePath}: hreflang return link missing on ${target.relativePath} -> ${canonical}`,
    );
  }
}
if (englishMetaFiles.length > 0) {
  ensure(
    hreflangPairChecks > 0,
    'hreflang: no reciprocal ja<->en pairs found to verify (English slug map may have been empty during ja generation)',
  );
}

const legacyRouteDirs = [
  'moth',
  'butterfly',
  'beetle',
  'longhornbeetle',
  'barkbeetle',
  'leafbeetle',
  'aphid',
  'plant',
  'en/moth',
  'en/butterfly',
  'en/beetle',
  'en/longhornbeetle',
  'en/barkbeetle',
  'en/leafbeetle',
  'en/aphid',
  'en/plant',
];

// 一覧ハブ（/moth/・/plant/・/en/moth/・/en/plant/）は種・植物単位の
// ルートシェルとは別物の検索入口ページ。個別ルート用バリデータには
// かけず、通常ページとしてメタ要件（title/canonical/OGP/JSON-LD）を検証する。
const hubShellRelativePaths = new Set([
  path.join(DIST_DIR, 'moth', 'index.html'),
  path.join(DIST_DIR, 'plant', 'index.html'),
  path.join(DIST_DIR, 'en', 'moth', 'index.html'),
  path.join(DIST_DIR, 'en', 'plant', 'index.html'),
]);
for (const hubPath of hubShellRelativePaths) {
  ensure(fs.existsSync(hubPath), `${path.relative(ROOT, hubPath)} hub shell not found`);
  if (fs.existsSync(hubPath)) {
    validateHtml(hubPath, readFile(hubPath));
  }
}

let legacyRedirectFilesCount = 0;
for (const relativeDir of legacyRouteDirs) {
  const dirPath = path.join(DIST_DIR, relativeDir);
  ensure(fs.existsSync(dirPath), `dist/${relativeDir} redirect directory not found`);
  if (!fs.existsSync(dirPath)) continue;
  const redirectFiles = collectHtmlFiles(dirPath).filter(
    (filePath) => path.basename(filePath) === 'index.html' && !hubShellRelativePaths.has(filePath),
  );
  ensure(redirectFiles.length > 0, `dist/${relativeDir} redirect pages not found`);
  legacyRedirectFilesCount += redirectFiles.length;
  for (const filePath of redirectFiles) {
    const html = readFile(filePath);
    if (relativeDir === 'plant' || relativeDir === 'en/plant') {
      validatePlantRouteHtml(filePath, html);
    } else if (getMetaContent(html, 'name', 'x-redirect-kind') === 'taxonomy-merge') {
      validateLegacyRedirectHtml(filePath, html);
    } else {
      validateInsectRouteHtml(filePath, html);
    }
  }
}

validateSeoRouteMap(path.join(DIST_DIR, 'seo-route-map.insects.json'));
validateSeoRouteMap(path.join(DIST_DIR, 'seo-route-map.plants.json'));
validateRobotsTxt(path.join(DIST_DIR, 'robots.txt'));
validateSitemapIndex(path.join(DIST_DIR, 'sitemap.xml'));
validateSitemapIndex(path.join(DIST_DIR, 'sitemap-index.xml'));
validateSitemapIndex(path.join(DIST_DIR, 'sitemap_index.xml'));
validateSitemapIndex(path.join(DIST_DIR, 'search-console-submit.xml'), [
  `${SITE_ORIGIN}/search-console-discovery-seed.xml`,
  `${SITE_ORIGIN}/sitemap-main.xml`,
  `${SITE_ORIGIN}/sitemap-plant.xml`,
  `${SITE_ORIGIN}/sitemap-en-plant.xml`,
]);
validateSitemapUrlSet(path.join(DIST_DIR, 'search-console-discovery-seed.xml'), {
  // 同名植物ページの正規ページ統合でシードURL数が約1450件に減少したため、
  // 「シードが十分に埋まっている」ことの確認として閾値を1200件に調整
  minUrls: 1200,
  requiredPrefixes: [
    `${SITE_ORIGIN}/moth/`,
    `${SITE_ORIGIN}/plant/`,
    `${SITE_ORIGIN}/en/moth/`,
    `${SITE_ORIGIN}/en/plant/`,
  ],
});
validateSitemapUrlSet(path.join(DIST_DIR, 'sitemap-plant.xml'), {
  // 植物の正規ページ（基底名URL）は約1,400件。sitemap側のエイリアス除外
  // ロジックが正規ページを落とす回帰（過去に約100件まで激減）を検出する下限。
  minUrls: 1000,
  requiredPrefixes: [`${SITE_ORIGIN}/plant/`],
});
validateSpa404(path.join(DIST_DIR, '404.html'));

if (failures.length > 0) {
  console.error(`[audit-seo] failed with ${failures.length} issue(s)`);
  failures.slice(0, 100).forEach((message) => console.error(`- ${message}`));
  if (failures.length > 100) {
    console.error(`- ...and ${failures.length - 100} more`);
  }
  process.exit(1);
}

const checkedCount =
  1 +
  (fs.existsSync(englishRootIndexPath) ? 1 : 0) +
  supportHtmlFiles.filter((filePath) => fs.existsSync(filePath)).length +
  metaFiles.length +
  englishMetaFiles.length +
  legacyRedirectFilesCount;
console.log(`[audit-seo] ok: checked ${checkedCount} HTML files`);
