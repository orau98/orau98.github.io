// Ensure generated runtime data exists before `npm run dev`.
// These artifacts are gitignored (rebuilt by CI on every deploy), so a fresh
// clone needs them generated once locally for the dev server to have data.
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const manifestPath = path.join(ROOT, 'public', 'assets', 'data-lite', 'manifest.json');
const hostplantsPath = path.join(ROOT, 'public', 'hostplants.csv');

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
