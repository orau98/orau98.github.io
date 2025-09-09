import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Add up to N missing species from tmp_listmj.json into insects CSVs using safe heuristics
// Usage: node scripts/add_missing_from_listmj.mjs [N]

const N = parseInt(process.argv[2] || '10', 10);
const listPath = path.join(process.cwd(), 'tmp_listmj.json');
const pubCsv = path.join(process.cwd(), 'public', 'insects.csv');
const normCsv = path.join(process.cwd(), 'normalized_data', 'insects.csv');

function toInt(s) { const n = parseInt(s, 10); return Number.isFinite(n) ? String(n) : ''; }
function latinFamilyOrNull(s='') { const t=String(s).trim(); return /idae$/.test(t) ? t : null; }
function japaneseFamilyOrNull(s='') { const t=String(s).trim(); return /科$/.test(t) ? t : null; }
function splitBinom(binom) { const [g, s] = (binom || '').trim().split(/\s+/); return { genus: g || '', species: s || '' }; }

function loadCSV(p) { const text=fs.readFileSync(p,'utf8'); return Papa.parse(text,{header:true,skipEmptyLines:false}).data; }
function saveCSV(p, rows) { const csv=Papa.unparse(rows,{header:true}); fs.writeFileSync(p,csv,'utf8'); }

if(!fs.existsSync(listPath)) { console.error('Missing:', listPath); process.exit(2); }
const list = JSON.parse(fs.readFileSync(listPath,'utf8'));
const pub = loadCSV(pubCsv); const norm = loadCSV(normCsv);

// Build existing sets and next ID
const existingBinom = new Set(); const existingJa = new Set();
let maxId = 0;
for (const r of pub) {
  const sci = (r.scientific_name || '').replace(/\s*\(.*$/, '').trim();
  if (sci) existingBinom.add(sci);
  if (r.japanese_name) existingJa.add(r.japanese_name.trim());
  const m = String(r.insect_id||'').match(/^species-(\d+)$/); if (m) maxId = Math.max(maxId, parseInt(m[1],10));
}

const added=[];
for (const c of list.records) {
  if (added.length >= N) break;
  const binom = (c.binomial || '').trim();
  const ja = (c.japanese || '').trim();
  if (!binom || !ja) continue;
  if (existingBinom.has(binom) || existingJa.has(ja)) continue;

  // Choose family and family_jp safely
  let family = latinFamilyOrNull(c.family) || latinFamilyOrNull(c.family_jp);
  let family_jp = japaneseFamilyOrNull(c.family_jp) || japaneseFamilyOrNull(c.family) || '';
  if (!family) continue; // require Latin family ending with -idae
  if (!family_jp) continue; // require Japanese family ending with 科

  const { genus, species } = splitBinom(binom);
  if (!genus || !species) continue;

  const authorRaw = (c.author || '').trim();
  const yearRaw = toInt(c.year || '');
  const scientific_name = authorRaw || yearRaw ? `${genus} ${species} ${[authorRaw, yearRaw].filter(Boolean).join(', ')}` : `${genus} ${species}`;

  const row = {
    insect_id: `species-${++maxId}`,
    family,
    family_jp,
    subfamily: '',
    subfamily_jp: '',
    tribe: '',
    tribe_jp: '',
    genus,
    subgenus: '',
    species,
    subspecies: '',
    author: authorRaw,
    year: yearRaw,
    japanese_name: ja,
    old_japanese_name: '',
    alternative_name: '',
    other_names: '',
    scientific_name,
    synonyms: '',
    changes_since_standard: '',
    notes: ''
  };
  pub.push(row); norm.push({ ...row });
  existingBinom.add(binom); existingJa.add(ja);
  added.push(row);
}

saveCSV(pubCsv, pub); saveCSV(normCsv, norm);
console.log(JSON.stringify({ added: added.length, ids: added.map(r=>r.insect_id), families: [...new Set(added.map(r=>r.family))] }, null, 2));

