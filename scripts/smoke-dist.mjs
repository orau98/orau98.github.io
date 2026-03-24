import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const DIST_DIR = path.join(ROOT, 'dist');
const REQUIRED_FILES = [
  'index.html',
  'en/index.html',
  'en/meta/moth/index.html',
  'en/meta/plant/index.html',
  'robots.txt',
  'ads.txt',
  'sitemap.txt',
  'sitemap.xml',
  'sitemap-core.xml',
  'opensearch.xml',
  'sitemap.html',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

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

console.log('[smoke-dist] ok');
