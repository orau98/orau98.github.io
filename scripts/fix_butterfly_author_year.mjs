import fs from 'fs/promises';
import fss from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];

const BUTTERFLY_FAMILIES_LATIN = new Set([
  'Papilionidae', 'Pieridae', 'Lycaenidae', 'Nymphalidae', 'Hesperiidae', 'Riodinidae'
]);

const isButterflyRow = (r) => {
  const fam = (r.family || '').trim();
  const famJp = (r.family_jp || '').trim();
  return famJp.endsWith('チョウ科') || BUTTERFLY_FAMILIES_LATIN.has(fam);
};

const parse = async (filePath) => {
  const text = await fs.readFile(filePath, 'utf8');
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: false });
  return data;
};

const dump = (rows) => Papa.unparse(rows, { header: true, newline: '\n' }) + '\n';

const listBackups = () => {
  const pub = path.join(ROOT, 'public');
  const files = fss.readdirSync(pub).filter(n => n.startsWith('insects.csv.bak.binran_author_'));
  files.sort(); // lexicographically latest last
  return files.map(n => path.join(pub, n));
};

const buildBackupMap = async () => {
  const backups = listBackups();
  const m = new Map();
  for (let i = backups.length - 1; i >= 0; i--) { // newest first
    const rows = await parse(backups[i]);
    for (const r of rows) {
      const id = (r?.insect_id || '').trim(); if (!id) continue;
      if (!m.has(id)) m.set(id, r);
    }
  }
  return m;
};

const loadAuthorityCsv = async () => {
  const p = path.join(ROOT, 'public', 'archive', 'legacy-data', 'butterfly_authority.csv');
  const map = new Map();
  if (!fss.existsSync(p)) return map;
  const text = await fs.readFile(p, 'utf8');
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
  for (const r of data) {
    if (!r) continue;
    const genus = (r.genus || r['属名'] || '').trim();
    const species = (r.species || r['種小名'] || '').trim();
    const author = (r.author || r['著者'] || '').trim();
    const year = (r.year || r['公表年'] || '').toString().trim();
    if (!genus || !species) continue;
    map.set(`${genus}\t${species}`, { author, year });
  }
  return map;
};

// Extract author/year from scientific_name
const extractFromSci = (sciRaw = '') => {
  const sci = String(sciRaw).trim();
  if (!sci) return { author: '', year: '' };
  // Pattern 1: parentheses style: Genus species (Author, YEAR)
  let m = sci.match(/\(([^()]+?),\s*(\[\d{4}\]|\d{4}(?:\s+\d{4})?)\)/);
  if (m) {
    return { author: `(${m[1].trim()})`, year: m[2].trim() };
  }
  // Pattern 2: trailing style: Genus species Author, YEAR
  m = sci.match(/\s([A-Z][^,()]+?),\s*(\[\d{4}\]|\d{4}(?:\s+\d{4})?)$/);
  if (m) {
    return { author: m[1].trim(), year: m[2].trim() };
  }
  return { author: '', year: '' };
};

const main = async () => {
  const backupMap = await buildBackupMap();
  const authorityMap = await loadAuthorityCsv();
  let totalChanged = 0;

  for (const csvPath of FILES) {
    const raw = await fs.readFile(csvPath, 'utf8');
    const { data } = Papa.parse(raw, { header: true, skipEmptyLines: false });
    const rows = data;
    let changed = 0, scanned = 0, fixed = 0;

    for (const r of rows) {
      if (!r || (Object.keys(r).length === 1 && Object.values(r)[0] === '')) continue;
      if (!isButterflyRow(r)) continue;
      scanned++;
      const id = (r.insect_id || '').trim();
      let author = (r.author || '').trim();
      let year = (r.year || '').trim();
      const sci = (r.scientific_name || '').trim();

      let need = !author || !year;
      if (!need) continue;

      // 1) Try authority CSV mapping
      const key = `${(r.genus||'').trim()}\t${(r.species||'').trim()}`;
      const fromAuth = authorityMap.get(key);
      if (fromAuth) {
        if (!author && fromAuth.author) author = fromAuth.author;
        if (!year && fromAuth.year) year = fromAuth.year;
      }

      // 2) Try to parse from scientific_name
      if (!author || !year) {
        const ex = extractFromSci(sci);
        if (ex.author && !author) author = ex.author;
        if (ex.year && !year) year = ex.year;
      }

      // 3) Fallback to backup row
      if ((!author || !year) && backupMap.has(id)) {
        const b = backupMap.get(id);
        if (!author) author = (b.author || '').trim();
        if (!year) year = (b.year || '').trim();
        // As last resort, parse backup scientific_name
        if ((!author || !year) && (b.scientific_name || '').trim()) {
          const ex2 = extractFromSci(b.scientific_name);
          if (ex2.author && !author) author = ex2.author;
          if (ex2.year && !year) year = ex2.year;
        }
      }

      // Apply if any progress
      if ((r.author || '').trim() !== author || (r.year || '').trim() !== year) {
        r.author = author;
        r.year = year;
        changed++;
        if (author && year) fixed++;
      }
    }

    if (changed > 0) {
      const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
      await fs.writeFile(`${csvPath}.bak.butterfly_author_year_${stamp}`, raw, 'utf8');
      await fs.writeFile(csvPath, dump(rows), 'utf8');
    }
    console.log(`[butterfly-author-year] ${path.relative(ROOT, csvPath)}: scanned=${scanned} changed=${changed} fixedBoth=${fixed}`);
    totalChanged += changed;
  }

  console.log(`[butterfly-author-year] total changes: ${totalChanged}`);
};

main().catch((e) => { console.error('fix_butterfly_author_year failed:', e); process.exit(1); });
