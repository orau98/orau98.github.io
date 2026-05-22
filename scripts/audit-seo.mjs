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

const parseAttributes = (tag) => {
  const attrs = {};
  tag.replace(/([:@\w-]+)\s*=\s*("([^"]*)"|'([^']*)')/g, (_, key, _quoted, dq, sq) => {
    attrs[key.toLowerCase()] = dq ?? sq ?? '';
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
  const decodedSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment));
  return path.join(DIST_DIR, ...decodedSegments);
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
  const robots = getMetaContent(html, 'name', 'robots');
  const canonical = getLinkHref(html, 'canonical');
  const refreshContent = getMetaHttpEquivContent(html, 'refresh');

  ensure(robots.includes('noindex'), `${relativePath}: legacy redirect must be noindex`);
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
    }
  }
};

const validateRobotsTxt = (filePath) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(fs.existsSync(filePath), `${relativePath}: robots.txt not found`);
  if (!fs.existsSync(filePath)) return;

  const body = readFile(filePath);
  const requiredSitemaps = [
    'sitemap.xml',
    'search-console-submit.xml',
  ];

  for (const sitemap of requiredSitemaps) {
    ensure(
      body.includes(`Sitemap: ${SITE_ORIGIN}/${sitemap}`),
      `${relativePath}: missing ${sitemap} directive`,
    );
  }
};

const validateSitemapIndex = (filePath) => {
  const relativePath = path.relative(ROOT, filePath);
  ensure(fs.existsSync(filePath), `${relativePath}: sitemap index not found`);
  if (!fs.existsSync(filePath)) return;

  const body = readFile(filePath);
  ensure(
    /<sitemapindex\b/i.test(body),
    `${relativePath}: root sitemap must be a sitemap index`,
  );
  ensure(
    !/<urlset\b/i.test(body),
    `${relativePath}: root sitemap should not be a full URL set`,
  );
  ensure(
    body.includes(`${SITE_ORIGIN}/sitemap-main.xml`),
    `${relativePath}: missing sitemap-main.xml entry`,
  );
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
  path.join(DIST_DIR, 'guides', 'index.html'),
  path.join(DIST_DIR, 'guides', 'host-plant-search.html'),
  path.join(DIST_DIR, 'en', 'guides', 'index.html'),
  path.join(DIST_DIR, 'en', 'guides', 'host-plant-search.html'),
];
for (const filePath of supportHtmlFiles) {
  if (fs.existsSync(filePath)) {
    validateHtml(filePath, readFile(filePath));
  } else {
    ensure(false, `${path.relative(ROOT, filePath)} not found`);
  }
}

const metaDir = path.join(DIST_DIR, 'meta');
const metaFiles = collectHtmlFiles(metaDir).filter(
  (filePath) => !filePath.endsWith('support-test.html'),
);
ensure(metaFiles.length > 0, 'dist/meta HTML files not found');

for (const filePath of metaFiles) {
  validateHtml(filePath, readFile(filePath));
}

const englishMetaDir = path.join(DIST_DIR, 'en', 'meta');
const englishMetaFiles = collectHtmlFiles(englishMetaDir).filter(
  (filePath) => !filePath.endsWith('support-test.html'),
);
if (fs.existsSync(englishMetaDir)) {
  ensure(englishMetaFiles.length > 0, 'dist/en/meta HTML files not found');
  for (const filePath of englishMetaFiles) {
    validateHtml(filePath, readFile(filePath));
  }
}

const legacyRouteDirs = [
  'moth',
  'butterfly',
  'beetle',
  'longhornbeetle',
  'leafbeetle',
  'aphid',
  'plant',
  'en/moth',
  'en/butterfly',
  'en/beetle',
  'en/longhornbeetle',
  'en/leafbeetle',
  'en/aphid',
  'en/plant',
];

let legacyRedirectFilesCount = 0;
for (const relativeDir of legacyRouteDirs) {
  const dirPath = path.join(DIST_DIR, relativeDir);
  ensure(fs.existsSync(dirPath), `dist/${relativeDir} redirect directory not found`);
  if (!fs.existsSync(dirPath)) continue;
  const redirectFiles = collectHtmlFiles(dirPath).filter(
    (filePath) => path.basename(filePath) === 'index.html',
  );
  ensure(redirectFiles.length > 0, `dist/${relativeDir} redirect pages not found`);
  legacyRedirectFilesCount += redirectFiles.length;
  for (const filePath of redirectFiles) {
    const html = readFile(filePath);
    if (relativeDir === 'plant') {
      validatePlantRouteHtml(filePath, html);
    } else {
      validateLegacyRedirectHtml(filePath, html);
    }
  }
}

validateSeoRouteMap(path.join(DIST_DIR, 'seo-route-map.insects.json'));
validateSeoRouteMap(path.join(DIST_DIR, 'seo-route-map.plants.json'));
validateRobotsTxt(path.join(DIST_DIR, 'robots.txt'));
validateSitemapIndex(path.join(DIST_DIR, 'sitemap.xml'));
validateSitemapIndex(path.join(DIST_DIR, 'sitemap-index.xml'));
validateSitemapIndex(path.join(DIST_DIR, 'sitemap_index.xml'));
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
