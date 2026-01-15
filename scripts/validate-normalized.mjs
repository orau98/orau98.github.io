import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');

const candidates = [
  path.join(ROOT, 'normalized_data'),
  path.join(ROOT, 'public')
];

const findExisting = (filename) => {
  for (const dir of candidates) {
    const full = path.join(dir, filename);
    if (fs.existsSync(full)) return full;
  }
  return null;
};

const insectsPath = findExisting('insects.csv');
const hostplantsPath = findExisting('hostplants.csv');
const notesPath = findExisting('general_notes.csv');

if (!insectsPath) {
  console.warn('[validate-normalized] insects.csv not found; skipping validation.');
  process.exit(0);
}

const parseCsv = (text) => Papa.parse(text, { header: true, skipEmptyLines: true }).data || [];

const insectsText = fs.readFileSync(insectsPath, 'utf-8');
const insects = parseCsv(insectsText);
const insectIds = new Set(
  insects.map((row) => (row.insect_id || '').trim()).filter(Boolean)
);

const missingIds = [];
const recordMissing = (source, row) => {
  const id = (row.insect_id || '').trim();
  if (!id || insectIds.has(id)) return;
  missingIds.push({ source, insect_id: id });
};

if (hostplantsPath) {
  const hostText = fs.readFileSync(hostplantsPath, 'utf-8');
  const hostRows = parseCsv(hostText);
  hostRows.forEach((row) => recordMissing('hostplants', row));
} else {
  console.warn('[validate-normalized] hostplants.csv not found; skipping hostplant reference checks.');
}

if (notesPath) {
  const notesText = fs.readFileSync(notesPath, 'utf-8');
  const noteRows = parseCsv(notesText);
  noteRows.forEach((row) => recordMissing('general_notes', row));
} else {
  console.warn('[validate-normalized] general_notes.csv not found; skipping notes reference checks.');
}

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

const reportPath = path.join(REPORTS_DIR, 'missing_ids.csv');
const header = 'source,insect_id\n';
const body = missingIds.map((row) => `${row.source},${row.insect_id}`).join('\n');
fs.writeFileSync(reportPath, header + (body ? body + '\n' : ''), 'utf-8');

const strict = process.env.STRICT_VALIDATE_NORMALIZED === '1';
if (missingIds.length > 0) {
  console.warn(`[validate-normalized] missing insect_id references: ${missingIds.length}`);
  if (strict) {
    process.exit(1);
  }
}

console.log('[validate-normalized] OK');
