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
  ensure(
    body.includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`),
    `${relativePath}: missing sitemap.xml directive`,
  );
  ensure(
    body.includes(`Sitemap: ${SITE_ORIGIN}/sitemap-index.xml`),
    `${relativePath}: missing sitemap-index.xml directive`,
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

const supportHtmlFiles = [path.join(DIST_DIR, 'sitemap.html')];
for (const filePath of supportHtmlFiles) {
  if (fs.existsSync(filePath)) {
    validateHtml(filePath, readFile(filePath));
  } else {
    ensure(false, `${path.relative(ROOT, filePath)} not found`);
  }
}

const topicsDir = path.join(DIST_DIR, 'topics');
const topicFiles = collectHtmlFiles(topicsDir);
ensure(fs.existsSync(topicsDir), 'dist/topics directory not found');
ensure(topicFiles.length > 0, 'dist/topics HTML files not found');
for (const filePath of topicFiles) {
  validateHtml(filePath, readFile(filePath));
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
    validateLegacyRedirectHtml(filePath, readFile(filePath));
  }
}

validateSeoRouteMap(path.join(DIST_DIR, 'seo-route-map.insects.json'));
validateSeoRouteMap(path.join(DIST_DIR, 'seo-route-map.plants.json'));
validateRobotsTxt(path.join(DIST_DIR, 'robots.txt'));
ensure(fs.existsSync(path.join(DIST_DIR, 'sitemap-index.xml')), 'dist/sitemap-index.xml not found');
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
  topicFiles.length +
  metaFiles.length +
  englishMetaFiles.length +
  legacyRedirectFilesCount;
console.log(`[audit-seo] ok: checked ${checkedCount} HTML files`);
