import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// Runtime data contract: these CSVs are fetched by the app at runtime
// (insects.csv on the dev full pipeline, hostplants.csv by the MothDetail
// host-plant fallback) and must be served from public/ in lockstep with
// normalized_data/. Keep this list in sync with scripts/smoke-dist.mjs.
const SYNC_TARGETS = [
  { name: 'insects.csv', required: true },
  { name: 'hostplants.csv', required: true },
  { name: 'general_notes.csv', required: true },
];

let missingRequired = false;

for (const { name, required } of SYNC_TARGETS) {
  const normalizedPath = path.join(ROOT, 'normalized_data', name);
  const publicPath = path.join(ROOT, 'public', name);

  if (!fs.existsSync(normalizedPath)) {
    const level = required ? 'error' : 'warn';
    console[level](`[sync-public-insects-csv] normalized_data/${name} not found; skipping.`);
    if (required) missingRequired = true;
    continue;
  }

  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.copyFileSync(normalizedPath, publicPath);
  console.log(`[sync-public-insects-csv] synced ${path.relative(ROOT, publicPath)} from normalized_data/${name}`);
}

if (missingRequired) {
  process.exit(1);
}
