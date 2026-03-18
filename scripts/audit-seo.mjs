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

const getJsonLdCount = (html) =>
  (html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/gi) || []).length;

const resolveCanonicalToDistPath = (href) => {
  if (!href) return null;
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
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
  metaFiles.length +
  englishMetaFiles.length;
console.log(`[audit-seo] ok: checked ${checkedCount} HTML files`);
