import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { getPublicHostPlantNote } from '../src/utils/publicHostPlantNotes.js';

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

function syncCsv({ name, normalizedPath, publicPath }) {
  if (name !== 'hostplants.csv') {
    fs.copyFileSync(normalizedPath, publicPath);
    console.log(`[sync-public-insects-csv] synced ${path.relative(ROOT, publicPath)} from normalized_data/${name}`);
    return;
  }

  const text = fs.readFileSync(normalizedPath, 'utf-8');
  const parsed = Papa.parse(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`[sync-public-insects-csv] failed to parse normalized_data/${name}: ${parsed.errors[0].message}`);
  }

  let sanitizedCount = 0;
  const rows = parsed.data.map((row) => {
    const current = row.notes || '';
    const sanitized = getPublicHostPlantNote(current);
    if (sanitized !== current) sanitizedCount += 1;
    return { ...row, notes: sanitized };
  });
  const csv = Papa.unparse(rows, { columns: parsed.meta.fields }) + '\n';
  fs.writeFileSync(publicPath, csv, 'utf-8');
  console.log(`[sync-public-insects-csv] synced ${path.relative(ROOT, publicPath)} from normalized_data/${name} (${sanitizedCount} internal notes removed)`);
}

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
  syncCsv({ name, normalizedPath, publicPath });
}

if (missingRequired) {
  process.exit(1);
}
