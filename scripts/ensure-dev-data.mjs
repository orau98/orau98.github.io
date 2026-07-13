// Ensure generated runtime data exists before `npm run dev`.
// These artifacts are gitignored (rebuilt by CI on every deploy), so a fresh
// clone needs them generated once locally for the dev server to have data.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { SOURCE_IMAGE_EXTENSIONS } from './lib/imageAssetConstants.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const manifestPath = path.join(ROOT, 'public', 'assets', 'data-lite', 'manifest.json');
const hostplantsPath = path.join(ROOT, 'public', 'hostplants.csv');
const insectImagesDir = path.join(ROOT, 'public', 'images', 'insects');
const resizedInsectImagesDir = path.join(ROOT, 'public', 'images', 'resized', 'insects');

const run = (script) => {
  console.log(`[ensure-dev-data] running ${script} ...`);
  execFileSync('node', [path.join(__dirname, script)], { cwd: ROOT, stdio: 'inherit' });
};

if (!fs.existsSync(hostplantsPath)) {
  run('sync-public-insects-csv.mjs');
}
if (!fs.existsSync(manifestPath)) {
  run('build-data-lite.mjs');
} else {
  console.log('[ensure-dev-data] data-lite present; skipping rebuild.');
}

const sourceImageExtensions = new Set(SOURCE_IMAGE_EXTENSIONS);
const hasMissingInsectWebp = fs.existsSync(insectImagesDir) && fs.readdirSync(insectImagesDir)
  .filter((filename) => sourceImageExtensions.has(path.extname(filename).toLowerCase()))
  .some((filename) => {
    const base = path.basename(filename, path.extname(filename));
    return !fs.existsSync(path.join(resizedInsectImagesDir, `${base}.320.webp`));
  });

if (hasMissingInsectWebp) {
  run('build-responsive-images.mjs');
} else {
  console.log('[ensure-dev-data] responsive insect WebP files present; skipping rebuild.');
}
