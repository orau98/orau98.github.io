import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const REQUIRED_FILES = [
  'index.html',
  '.nojekyll',
  'quiz/index.html',
  'en/index.html',
  'en/quiz/index.html',
  'en/meta/moth/index.html',
  'en/meta/plant/index.html',
  'robots.txt',
  'ads.txt',
  'sitemap.txt',
  'sitemap.xml',
  'sitemap-index.xml',
  'sitemap_index.xml',
  'search-console-submit.xml',
  'search-console-submit.txt',
  'search-console-sitemap.xml',
  'search-console-sitemap.txt',
  'sitemap-core.xml',
  'sitemap-all.txt',
  'google-sitemap.xml',
  'google-sitemap.txt',
  'gsc-sitemap.xml',
  'gsc-sitemap.txt',
  'opensearch.xml',
  'sitemap.html',
  'guides/index.html',
  'guides/host-plant-search.html',
  'en/guides/index.html',
  'en/guides/host-plant-search.html',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const readDistText = (relativePath) =>
  fs.readFileSync(path.join(DIST_DIR, relativePath), 'utf8');

assert(fs.existsSync(DIST_DIR), 'dist directory not found');

for (const relativePath of REQUIRED_FILES) {
  const fullPath = path.join(DIST_DIR, relativePath);
  assert(fs.existsSync(fullPath), `missing dist artifact: ${relativePath}`);
}

const assetsDir = path.join(DIST_DIR, 'assets');
assert(fs.existsSync(assetsDir), 'missing dist/assets directory');

const assetFiles = fs.readdirSync(assetsDir);
assert(assetFiles.some((name) => /^index-.*\.js$/.test(name)), 'missing built JS asset in dist/assets');
assert(assetFiles.some((name) => /^index-.*\.css$/.test(name)), 'missing built CSS asset in dist/assets');

const okinagusaRoutePath = path.join('plant', 'オキナグサ', 'index.html');
assert(
  fs.existsSync(path.join(DIST_DIR, okinagusaRoutePath)),
  'missing decoded オキナグサ plant route',
);
const okinagusaRouteHtml = readDistText(okinagusaRoutePath);
assert(
  !okinagusaRouteHtml.includes('window.__PLANT_ROUTE_SHELL__'),
  'オキナグサ direct route must not be overwritten by the SPA plant shell',
);
assert(
  /http-equiv=["']refresh["']/i.test(okinagusaRouteHtml) &&
    okinagusaRouteHtml.includes('/meta/plant/'),
  'オキナグサ direct route must redirect to its static meta page',
);

const okinagusaImagePath = '/images/resized/plants/%E3%82%AA%E3%82%AD%E3%83%8A%E3%82%B0%E3%82%B5.1024.jpg';
const okinagusaImageFile = path.join(DIST_DIR, 'images', 'resized', 'plants', 'オキナグサ.1024.jpg');
assert(
  fs.existsSync(okinagusaImageFile) && fs.statSync(okinagusaImageFile).size > 0,
  'missing deployed オキナグサ responsive image file',
);
const okinagusaMetaCandidates = [
  path.join('meta', 'plant', 'オキナグサ.html'),
  path.join('meta', 'plant', 'オキナグサ(キク科).html'),
  path.join('meta', 'plant', 'オキナグサ(キンポウゲ科).html'),
];
assert(
  okinagusaMetaCandidates.some((relativePath) => {
    const fullPath = path.join(DIST_DIR, relativePath);
    return fs.existsSync(fullPath) && readDistText(relativePath).includes(okinagusaImagePath);
  }),
  'オキナグサ static meta page must include the responsive plant image',
);

console.log('[smoke-dist] ok');
