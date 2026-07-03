import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const RESPONSIVE_IMAGES_SKIPPED = process.env.SKIP_RESPONSIVE_IMAGES === '1';
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
  'search-console-discovery-seed.xml',
  'search-console-discovery-seed.txt',
  'sitemap-core.xml',
  'sitemap-all.txt',
  'opensearch.xml',
  'sitemap.html',
];

// Runtime data contract: every file the SPA fetches at runtime.
// If one of these is missing the deployed site silently degrades
// (404 responses are masked by fetch fallbacks), so fail the build here.
// Keep in sync with scripts/sync-public-insects-csv.mjs and src data loaders.
const RUNTIME_DATA_FILES = [
  'insects.csv',
  'hostplants.csv',
  'general_notes.csv',
  'image_filenames.txt',
  'image_extensions.json',
  'plant_image_filenames.txt',
  'instagram_posts.json',
  'instagram_posts.txt',
  'instagram_latest.txt',
  'assets/data-lite/manifest.json',
  'assets/data-lite/moths.json',
  'assets/data-lite/butterflies.json',
  'assets/data-lite/beetles.json',
  'assets/data-lite/longhornbeetles.json',
  'assets/data-lite/leafbeetles.json',
  'assets/data-lite/aphids.json',
  'assets/data-lite/hostplants.json',
  'assets/data-lite/plant-details.json',
  'assets/data-lite/flower-visit-plants.json',
  'assets/data-lite/image-index.json',
  'assets/data-lite/ylist-lite.json',
  'assets/data-lite/index.json',
  'assets/data-lite/full-dataset.json',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const readDistText = (relativePath) =>
  fs.readFileSync(path.join(DIST_DIR, relativePath), 'utf8');

const readDistJson = (relativePath) => {
  try {
    return JSON.parse(readDistText(relativePath));
  } catch (error) {
    throw new Error(`invalid JSON in dist artifact ${relativePath}: ${error?.message || error}`);
  }
};

assert(fs.existsSync(DIST_DIR), 'dist directory not found');

for (const relativePath of REQUIRED_FILES) {
  const fullPath = path.join(DIST_DIR, relativePath);
  assert(fs.existsSync(fullPath), `missing dist artifact: ${relativePath}`);
}

for (const relativePath of RUNTIME_DATA_FILES) {
  const fullPath = path.join(DIST_DIR, relativePath);
  assert(
    fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0,
    `missing or empty runtime data file: ${relativePath}`,
  );
}

// Structural sanity checks on the runtime data contract.
const manifest = readDistJson('assets/data-lite/manifest.json');
assert(manifest && typeof manifest === 'object', 'manifest.json must be an object');
assert(Boolean(manifest.version), 'manifest.json must declare a version');
assert(
  manifest.counts && typeof manifest.counts === 'object',
  'manifest.json must declare dataset counts',
);

const ylistLite = readDistJson('assets/data-lite/ylist-lite.json');
assert(
  Object.keys(ylistLite?.plants || {}).length > 0,
  'ylist-lite.json must contain plant entries (plant alias/family resolution breaks otherwise)',
);
assert(
  Object.keys(ylistLite?.aliasToCanonical || {}).length > 0,
  'ylist-lite.json must contain alias mappings',
);

const mothsLite = readDistJson('assets/data-lite/moths.json');
assert(Array.isArray(mothsLite) && mothsLite.length > 0, 'moths.json must be a non-empty array');

const csvHeaderChecks = [
  { file: 'insects.csv', columns: ['insect_id'] },
  { file: 'hostplants.csv', columns: ['insect_id', 'plant_name'] },
  { file: 'general_notes.csv', columns: ['insect_id', 'note_type'] },
];
for (const { file, columns } of csvHeaderChecks) {
  const headerLine = (readDistText(file).split(/\r?\n/, 1)[0] || '').replace(/^﻿/, '');
  for (const column of columns) {
    assert(
      headerLine.includes(column),
      `${file} header must contain "${column}" (got: ${headerLine.slice(0, 120)})`,
    );
  }
}

const assetsDir = path.join(DIST_DIR, 'assets');
assert(fs.existsSync(assetsDir), 'missing dist/assets directory');

const assetFiles = fs.readdirSync(assetsDir);
assert(assetFiles.some((name) => /^index-.*\.js$/.test(name)), 'missing built JS asset in dist/assets');
assert(assetFiles.some((name) => /^index-.*\.css$/.test(name)), 'missing built CSS asset in dist/assets');

const okinagusaRoutePath = path.join('plant', 'オキナグサ', 'index.html');
assert(
  fs.existsSync(path.join(DIST_DIR, okinagusaRoutePath)),
  'missing オキナグサ plant app route',
);
const okinagusaRouteHtml = readDistText(okinagusaRoutePath);
assert(
  okinagusaRouteHtml.includes('window.__PLANT_ROUTE_SHELL__') &&
    okinagusaRouteHtml.includes('/assets/index-') &&
    okinagusaRouteHtml.includes('<div id="root"></div>'),
  'オキナグサ direct route must serve the Japanese SPA plant shell',
);
assert(
  !/http-equiv=["']refresh["']/i.test(okinagusaRouteHtml),
  'オキナグサ direct route must not redirect away from the app plant detail',
);

const okinagusaEnglishRoutePath = path.join('en', 'plant', 'オキナグサ', 'index.html');
assert(
  fs.existsSync(path.join(DIST_DIR, okinagusaEnglishRoutePath)),
  'missing English オキナグサ plant app route',
);
const okinagusaEnglishRouteHtml = readDistText(okinagusaEnglishRoutePath);
assert(
  okinagusaEnglishRouteHtml.includes('window.__PLANT_ROUTE_SHELL__') &&
    okinagusaEnglishRouteHtml.includes('<html lang="en"') &&
    okinagusaEnglishRouteHtml.includes('/assets/index-') &&
    okinagusaEnglishRouteHtml.includes('<div id="root"></div>'),
  'English オキナグサ direct route must serve the English SPA plant shell',
);
assert(
  !/http-equiv=["']refresh["']/i.test(okinagusaEnglishRouteHtml),
  'English オキナグサ direct route must not redirect away from the app plant detail',
);

const okinagusaImagePath = '/images/resized/plants/%E3%82%AA%E3%82%AD%E3%83%8A%E3%82%B0%E3%82%B5.1024.jpg';
const okinagusaImageFile = path.join(DIST_DIR, 'images', 'resized', 'plants', 'オキナグサ.1024.jpg');
if (!RESPONSIVE_IMAGES_SKIPPED) {
  assert(
    fs.existsSync(okinagusaImageFile) && fs.statSync(okinagusaImageFile).size > 0,
    'missing deployed オキナグサ responsive image file',
  );
}
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
