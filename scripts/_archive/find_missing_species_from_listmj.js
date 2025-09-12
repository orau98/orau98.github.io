// Compare ListMJ3-210603DL.xlsx (pre-parsed JSON) against public/insects.csv
// Outputs missing species candidates with key fields.

import fs from 'fs';
import path from 'path';

const listmjJsonPath = process.argv[2] || path.join(process.cwd(), 'tmp_listmj.json');
const insectsCsvPath = process.argv[3] || path.join(process.cwd(), 'public', 'insects.csv');

const j = JSON.parse(fs.readFileSync(listmjJsonPath, 'utf-8'));

const normalize = (s) => (s || '').toString().trim();
const hasJapanese = (s) => /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(s || '');
const isLatinWord = (s) => /^[A-Za-z][A-Za-z-]*$/.test(s || '');
const isLatinGenus = (s) => /^[A-Z][a-z-]+$/.test(s || '');
const isLatinSpecies = (s) => /^[a-z][a-z-]+$/.test(s || '');

// Build set of existing binomials and Japanese names from insects.csv
const csv = fs.readFileSync(insectsCsvPath, 'utf-8').split(/\r?\n/);
const header = csv.shift()?.split(',') || [];
const idx = Object.fromEntries(header.map((h, i) => [h, i]));
const existingSci = new Set();
const existingJa = new Set();
for (const line of csv) {
  if (!line) continue;
  const cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g); // CSV-safe split
  const sci = (cols[idx['scientific_name']] || '').replace(/^"|"$/g, '');
  const ja = (cols[idx['japanese_name']] || '').replace(/^"|"$/g, '');
  const binom = sci.replace(/\s*\(.*$/, '').trim();
  if (binom) existingSci.add(binom);
  if (ja) existingJa.add(ja);
}

// Detect header-like duplicate rows (where values equal their keys)
const looksLikeKeyEcho = (rowObj) => {
  let matches = 0, total = 0;
  for (const [k, v] of Object.entries(rowObj)) {
    if (!v) continue;
    total++;
    if (normalize(k) === normalize(v)) matches++;
  }
  return total > 0 && matches / Math.max(1, total) > 0.6;
};

// Given a record, heuristically extract genus/species/author/year and Japanese name
function extractTaxaFromRecord(r) {
  const fam = normalize(r['科名']);
  const famJa = normalize(r['科和名']);

  // Flatten all cell values left-to-right
  const values = Object.values(r)
    .map(normalize)
    .filter(Boolean);

  // Find first adjacent Latin pair as Genus + species
  let genus = '';
  let species = '';
  let author = '';
  let year = '';
  for (let i = 0; i < values.length - 1; i++) {
    const a = values[i];
    const b = values[i + 1];
    if (isLatinGenus(a) && isLatinSpecies(b)) {
      genus = a;
      species = b;
      // Try to capture author and year from following tokens
      const c = values[i + 2] || '';
      const d = values[i + 3] || '';
      // Author can be in parentheses or capitalized surname(s)
      if (/^\(.*\)$/.test(c) || /^[A-Z][A-Za-z .,&-]+$/.test(c)) {
        author = c.replace(/^\(|\)$/g, '');
        if (/^\d{3,4}$/.test(d)) year = d;
      } else if (/^\d{3,4}$/.test(c)) {
        year = c;
      }
      break;
    }
  }

  // Japanese name: prefer longer Japanese token excluding obvious status words
  let japanese = '';
  for (const v of values) {
    if (hasJapanese(v) && !/(出版後|除外|名前変更|新称|和名|種名)/.test(v)) {
      if (v.length > japanese.length) japanese = v;
    }
  }

  return { fam, famJa, genus, species, author, year, japanese };
}

// Extract candidates from JSON
const candidates = [];
for (const r of j.records) {
  if (!r) continue;
  if (looksLikeKeyEcho(r)) continue; // skip header echo rows

  const { fam, famJa, genus, species, author, year, japanese } = extractTaxaFromRecord(r);
  if (!isLatinGenus(genus) || !isLatinSpecies(species)) continue;
  const binom = `${genus} ${species}`;

  if (!existingSci.has(binom) && (japanese ? !existingJa.has(japanese) : true)) {
    candidates.push({
      binomial: binom,
      author,
      year,
      japanese,
      family: fam,
      family_jp: famJa
    });
  }
}

// Output summary and first N items
const N = parseInt(process.argv[4] || '50', 10);
console.log(JSON.stringify({ total_candidates: candidates.length, sample: candidates.slice(0, N) }, null, 2));
