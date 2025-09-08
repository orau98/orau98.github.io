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

  // Lycaenidae（代表的な対応）
  'ベニシジミ亜科': 'Lycaeninae',
  'ヒメシジミ亜科': 'Polyommatinae',
  'ミドリシジミ亜科': 'Theclinae',
  'ウラギンシジミ亜科': 'Curetinae',
  'アシナガシジミ亜科': 'Miletinae',
  'シジミチョウ亜科': 'Lycaeninae', // 便宜上

  // Nymphalidae
  'テングチョウ亜科': 'Libytheinae',
  'タテハチョウ亜科': 'Nymphalinae',
  'コムラサキ亜科': 'Apaturinae',
  'イチモンジチョウ亜科': 'Limenitidinae',
  'ジャノメチョウ亜科': 'Satyrinae',
  'マダラチョウ亜科': 'Danainae',
  'フタオチョウ亜科': 'Charaxinae',
  'ドクチョウ亜科': 'Heliconiinae',

  // Hesperiidae（代表的な対応）
  'セセリチョウ亜科': 'Hesperiinae',
  'ホソバセセリ亜科': 'Pyrginae',
  'コウモリセセリ亜科': 'Coeliadinae',
};

const LATIN_TO_JP = Object.fromEntries(
  Object.entries(JP_TO_LATIN).map(([jp, la]) => [la, jp])
);

const BUTTERFLY_FAMILIES_LATIN = new Set([
  'Papilionidae', 'Pieridae', 'Lycaenidae', 'Nymphalidae', 'Hesperiidae', 'Riodinidae'
]);

// Family mappings (JP <-> Latin) for butterflies
const JP_FAMILY_TO_LATIN = {
  'アゲハチョウ科': 'Papilionidae',
  'シロチョウ科': 'Pieridae',
  'シジミチョウ科': 'Lycaenidae',
  'タテハチョウ科': 'Nymphalidae',
  'セセリチョウ科': 'Hesperiidae',
};
const LATIN_FAMILY_TO_JP = Object.fromEntries(Object.entries(JP_FAMILY_TO_LATIN).map(([jp, la]) => [la, jp]));

const hasJapanese = (s = '') => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(s);
const hasLatin = (s = '') => /[A-Za-z]/.test(s);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];

// Genus → subfamily fallback (for Hesperiidae skippers common in Japan)
const GENUS_TO_SUBFAMILY = new Map([
  // Coeliadinae（コウモリセセリ亜科）
  ['Badamia','Coeliadinae'],
  ['Hasora','Coeliadinae'],
  ['Ismene','Coeliadinae'],
  ['Bibasis','Coeliadinae'],
  ['Choaspes','Coeliadinae'],
  ['Burara','Coeliadinae'],

  // Pyrginae（ホソバセセリ亜科）
  ['Daimio','Pyrginae'],
  ['Pyrgus','Pyrginae'],
  ['Erynnis','Pyrginae'],
  ['Tagiades','Pyrginae'],
  ['Notocrypta','Pyrginae'],
  ['Udaspes','Pyrginae'],
  ['Celaenorrhinus','Pyrginae'],

  // Hesperiinae（セセリチョウ亜科）
  ['Leptalina','Hesperiinae'],
  ['Carterocephalus','Hesperiinae'],
  ['Aeromachus','Hesperiinae'],
  ['Thoressa','Hesperiinae'],
  ['Hesperia','Hesperiinae'],
  ['Ochlodes','Hesperiinae'],
  ['Potanthus','Hesperiinae'],
  ['Telicota','Hesperiinae'],
  ['Erionota','Hesperiinae'],
  ['Borbo','Hesperiinae'],
  ['Pelopidas','Hesperiinae'],
  ['Polytremis','Hesperiinae'],
  ['Parnara','Hesperiinae'],
  ['Isoteinon','Hesperiinae'],
]);

let totalChanged = 0;
let totalIssues = 0;
const missingMap = new Map();

for (const CSV_PATH of FILES) {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Not found: ${CSV_PATH}`);
    continue;
  }
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const parsed = Papa.parse(raw, { header: true, skipEmptyLines: false });
  const rows = parsed.data;

  let changed = 0, butterflyRows = 0, total = 0;

  for (const r of rows) {
    if (!r || (Object.keys(r).length === 1 && Object.values(r)[0] === '')) continue;
    total++;
    let fam = (r.family || '').trim();
    let famJp = (r.family_jp || '').trim();
    const isButterfly = famJp.endsWith('チョウ科') || BUTTERFLY_FAMILIES_LATIN.has(fam) || JP_FAMILY_TO_LATIN[fam];
    if (!isButterfly) continue;
    butterflyRows++;

    // Normalize family/family_jp first
    const famIsJp = hasJapanese(fam);
    const famJpIsLatin = hasLatin(famJp) && !hasJapanese(famJp);
    if (famIsJp) {
      // Move JP to family_jp and fill Latin family if known
      const la = JP_FAMILY_TO_LATIN[fam] || fam;
      famJp = famJp || fam; // keep JP in family_jp
      fam = LATIN_FAMILY_TO_JP[la] ? la : fam; // set Latin if mapped
    } else if (famJpIsLatin && (!fam || hasJapanese(fam))) {
      // family_jp has Latin, swap to family and set proper JP
      const la = famJp;
      fam = la;
      famJp = LATIN_FAMILY_TO_JP[la] || famJp;
    } else {
      // If family is Latin but family_jp empty/Latin → fill JP
      if (BUTTERFLY_FAMILIES_LATIN.has(fam)) {
        const jp = LATIN_FAMILY_TO_JP[fam];
        if (jp) famJp = jp;
      }
    }

    // Apply normalized family fields if changed
    if (fam !== (r.family || '').trim() || famJp !== (r.family_jp || '').trim()) {
      r.family = fam;
      r.family_jp = famJp;
      changed++;
    }

    let sub = (r.subfamily || '').trim();
    let subJp = (r.subfamily_jp || '').trim();

    // Case 1: subfamily holds Japanese (wrong place)
    if (hasJapanese(sub)) {
      // If subfamily_jp is Latin and ends with -inae, swap
      if (hasLatin(subJp) && /inae$/i.test(subJp)) {
        [sub, subJp] = [subJp, sub];
      } else {
        // Move JP to subfamily_jp and fill Latin from mapping if possible
        const la = JP_TO_LATIN[sub] || '';
        if (la) {
          subJp = sub; sub = la;
        } else {
          // keep JP in subfamily_jp, clear subfamily (unknown Latin)
          subJp = sub; sub = '';
          missingMap.set(subJp, (missingMap.get(subJp) || 0) + 1);
        }
      }
    }

    // Case 2: subfamily_jp accidentally Latin
    if (hasLatin(subJp) && !hasJapanese(subJp)) {
      // Prefer mapping from subfamily Latin to JP
      const jp = LATIN_TO_JP[sub] || '';
      if (jp) subJp = jp; else subJp = '';
    }

    // Case 3: both empty → fallback by genus mapping
    if (!sub && !subJp) {
      const genus = (r.genus || '').trim();
      const la = GENUS_TO_SUBFAMILY.get(genus);
      if (la) {
        sub = la;
        subJp = LATIN_TO_JP[la] || subJp;
      }
    }

    // Normalize back
    if (sub !== r.subfamily || subJp !== r.subfamily_jp) {
      r.subfamily = sub;
      r.subfamily_jp = subJp;
      changed++;
    }
  }

  // Backup and write
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const backupPath = `${CSV_PATH}.bak.butterfly_subfamily_fix_${stamp}`;
  fs.writeFileSync(backupPath, raw);
  const out = Papa.unparse(rows, { header: true, newline: '\n' });
  fs.writeFileSync(CSV_PATH, out + '\n');

  console.log(`[butterfly-subfamily-fix] ${path.relative(ROOT, CSV_PATH)}: scanned=${total} butterfly=${butterflyRows} changed=${changed}`);
  totalChanged += changed;
}

if (missingMap.size) {
  console.log('[butterfly-subfamily-fix] Unmapped JP subfamily labels (need mapping):');
  for (const [k, v] of missingMap.entries()) console.log(`  - ${k}: ${v} rows`);
  totalIssues += missingMap.size;
}

console.log(`[butterfly-subfamily-fix] Total changes: ${totalChanged}`);
