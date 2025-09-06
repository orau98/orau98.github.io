import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Map Japanese subfamily names -> Latin subfamily names (for butterflies)
const JP_TO_LATIN = {
  // Papilionidae
  'アゲハチョウ亜科': 'Papilioninae',
  'ウスバアゲハ亜科': 'Parnassiinae',

  // Pieridae
  'モンシロチョウ亜科': 'Pierinae',
  'モンキチョウ亜科': 'Coliadinae',
  'トンボシロチョウ亜科': 'Dismorphiinae',

  // Lycaenidae
  'シジミチョウ亜科': 'Lycaeninae', // Dataset aggregates multiple groups under this label
  'ウラギンシジミ亜科': 'Curetinae',
  'アシナガシジミ亜科': 'Miletinae',
  // (ヒメシジミ亜科 -> Polyommatinae, ミドリシジミ亜科 -> Theclinae, ベニシジミ亜科 -> Lycaeninae)

  // Nymphalidae
  'テングチョウ亜科': 'Libytheinae',
  'タテハチョウ亜科': 'Nymphalinae',
  'コムラサキ亜科': 'Apaturinae',
  'イチモンジチョウ亜科': 'Limenitidinae',
  'ジャノメチョウ亜科': 'Satyrinae',
  'マダラチョウ亜科': 'Danainae',
  'フタオチョウ亜科': 'Charaxinae',
  'ドクチョウ亜科': 'Heliconiinae',
};

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CSV_PATH = path.join(ROOT, 'public', 'insects.csv');

if (!fs.existsSync(CSV_PATH)) {
  console.error(`Not found: ${CSV_PATH}`);
  process.exit(1);
}

const raw = fs.readFileSync(CSV_PATH, 'utf-8');
const parsed = Papa.parse(raw, { header: true, skipEmptyLines: false });

if (parsed.errors?.length) {
  console.warn('Parse warnings:', parsed.errors.slice(0, 5));
}

const rows = parsed.data;

let total = 0;
let butterflyRows = 0;
let changed = 0;
let missingMap = new Map();

for (const r of rows) {
  // Skip empty lines
  if (!r || Object.keys(r).length === 1 && Object.values(r)[0] === '') continue;
  total++;
  const familyJp = (r.family_jp || r.family || '').trim();
  // Heuristic: butterfly families end with "チョウ科"
  const isButterfly = /チョウ科$/.test(familyJp);
  if (!isButterfly) continue;
  butterflyRows++;

  const jp = (r.subfamily_jp || '').trim();
  if (!jp) continue;
  const latin = JP_TO_LATIN[jp];
  if (latin) {
    if ((r.subfamily || '').trim() !== latin) {
      r.subfamily = latin; // write Latin subfamily
      changed++;
    }
    // ensure Japanese column keeps JP label
    r.subfamily_jp = jp;
  } else {
    // track missing mapping values
    const count = missingMap.get(jp) || 0;
    missingMap.set(jp, count + 1);
  }
}

// Write backup
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
const backupPath = `${CSV_PATH}.bak.butterfly_subfamily_fix_${stamp}`;
fs.writeFileSync(backupPath, raw);

// Stringify back
const out = Papa.unparse(rows, { header: true, newline: '\n' });
fs.writeFileSync(CSV_PATH, out + '\n');

console.log(`Scanned: ${total} rows`);
console.log(`Butterfly rows: ${butterflyRows}`);
console.log(`Updated subfamily -> Latin: ${changed}`);

if (missingMap.size) {
  console.log('Unmapped Japanese subfamily labels:');
  for (const [k, v] of missingMap.entries()) {
    console.log(`  - ${k}: ${v} rows`);
  }
}

