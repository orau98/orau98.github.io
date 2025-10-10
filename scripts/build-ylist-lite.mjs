import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function readText(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}

function parseCsv(text) {
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  return res.data || [];
}

function build() {
  console.log('[ylist-lite] start');
  const hostCsv = readText(path.join(PUBLIC_DIR, 'hostplants.csv'));
  const ylistCsv = readText(path.join(PUBLIC_DIR, '20210514YList_download.csv'));
  if (!hostCsv || !ylistCsv) {
    console.warn('[ylist-lite] required files missing; skipping');
    return;
  }

  const host = parseCsv(hostCsv);
  const targets = new Set();
  host.forEach(r => { const n = (r.plant_name || '').trim(); if (n && n !== '不明') targets.add(n); });
  console.log('[ylist-lite] target plants:', targets.size);

  const rows = parseCsv(ylistCsv);
  const plants = {}; // name -> info
  const aliasToCanonical = {}; // alias -> name

  // Helper to get first non-empty
  const first = (...args) => args.find(v => v && String(v).trim())?.toString().trim() || '';

  rows.forEach(r => {
    const name = (r['和名'] || '').trim();
    if (!name) return;
    const aliasesRaw = (r['別名'] || '').toString();
    const aliases = aliasesRaw.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    const matchTarget = targets.has(name) || aliases.some(a => targets.has(a));
    if (!matchTarget) return;

    const familyJp = first(r['LAPGII::LAPG科名'], r['LAPG 科名'], r['Cronquist 科名'], r['Engler 科名']);
    const familyEn = first(r['LAPGII::LAPG Family狭義'], r['LAPGII::LAPG Family広義'], r['LAPG Family'], r['Cronquist family'], r['Engler family']);
    const orderJp  = first(r['LAPGII::LAPG 目'], r['LAPGII::LAPG Order']);
    const orderEn  = first(r['LAPGII::LAPG Order']);
    let sci = (r['学名'] || '').toString().trim();
    if (!sci) sci = (r['学名 withAuthor'] || '').toString().trim();

    const info = plants[name] || { familyJp:'', familyEn:'', orderJp:'', orderEn:'', scientificName:'', aliases: [] };
    info.familyJp = info.familyJp || familyJp;
    info.familyEn = info.familyEn || familyEn;
    info.orderJp = info.orderJp || orderJp;
    info.orderEn = info.orderEn || orderEn;
    info.scientificName = info.scientificName || sci;
    info.aliases = Array.from(new Set([...(info.aliases || []), ...aliases]));
    plants[name] = info;

    aliases.forEach(a => { if (a && !aliasToCanonical[a]) aliasToCanonical[a] = name; });
  });

  const outDir = path.join(PUBLIC_DIR, 'assets', 'data-lite');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'ylist-lite.json');
  fs.writeFileSync(outPath, JSON.stringify({ plants, aliasToCanonical }, null, 0), 'utf-8');
  const size = fs.statSync(outPath).size;
  console.log('[ylist-lite] wrote', outPath, `size=${size} bytes`, 'plants=', Object.keys(plants).length);
}

build();

