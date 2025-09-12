import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSV_PATH = path.join(ROOT, 'public', 'insects.csv');
const AUTH_PATH = path.join(ROOT, 'public', 'archive', 'legacy-data', 'butterfly_authority.csv');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`Not found: ${CSV_PATH}`);
  process.exit(1);
}

const authorityIndex = new Map();
if (fs.existsSync(AUTH_PATH)) {
  const authRaw = fs.readFileSync(AUTH_PATH, 'utf-8');
  const authParsed = Papa.parse(authRaw, { header: true, skipEmptyLines: true });
  for (const r of authParsed.data) {
    if (!r) continue;
    const genus = (r.genus || r['属名'] || '').trim();
    const species = (r.species || r['種小名'] || '').trim();
    const jp = (r.japanese_name || r['和名'] || '').trim();
    const key = `${genus}\t${species}`;
    if (!genus || !species) continue;
    authorityIndex.set(key, {
      author: (r.author || r['著者'] || '').trim(),
      year: (r.year || r['公表年'] || '').toString().trim(),
      jp
    });
  }
  console.log(`Loaded authority map: ${authorityIndex.size} entries from ${AUTH_PATH}`);
} else {
  console.warn(`Authority CSV not found (optional): ${AUTH_PATH}`);
}

const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const parsed = Papa.parse(raw, { header: true, skipEmptyLines: false });
if (parsed.errors?.length) {
  console.warn('Parse warnings:', parsed.errors.slice(0, 5));
}

const rows = parsed.data;
let total = 0, targets = 0, updated = 0, parsedFromSci = 0;

for (const r of rows) {
  if (!r || Object.keys(r).length === 1 && Object.values(r)[0] === '') continue;
  total++;
  const familyJp = (r.family_jp || r.family || '').trim();
  const isButterfly = /チョウ科$/.test(familyJp);
  if (!isButterfly) continue;
  targets++;

  const hasAuthor = (r.author || '').toString().trim().length > 0;
  const hasYear = (r.year || '').toString().trim().length > 0;
  if (hasAuthor && hasYear) continue;

  const genus = (r.genus || '').trim();
  const species = (r.species || '').trim();
  const sci = (r.scientific_name || '').trim();

  // 1) Try authority CSV map
  const key = `${genus}\t${species}`;
  if (authorityIndex.has(key)) {
    const { author, year } = authorityIndex.get(key);
    if (author && year) {
      r.author = author;
      r.year = year;
      updated++;
      continue;
    }
  }

  // 2) Parse from scientific_name if it contains (Author, YYYY)
  const m = sci.match(/\(([^,)]+),\s*(\d{3,4})\)/);
  if (m) {
    r.author = r.author || m[1].trim();
    r.year = r.year || m[2].trim();
    parsedFromSci++;
    updated++;
  }
}

// Backup and write
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backupPath = `${CSV_PATH}.bak.butterfly_author_year_${stamp}`;
fs.writeFileSync(backupPath, raw);

const out = Papa.unparse(rows, { header: true, newline: '\n' });
fs.writeFileSync(CSV_PATH, out + '\n');

console.log(`Scanned: ${total} rows`);
console.log(`Butterfly rows: ${targets}`);
console.log(`Updated author/year: ${updated} (from authority CSV: ${updated - parsedFromSci}, from scientific_name: ${parsedFromSci})`);

