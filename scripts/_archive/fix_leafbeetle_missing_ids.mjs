import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILES = [
  path.join(process.cwd(), 'public', 'insects.csv'),
  path.join(process.cwd(), 'normalized_data', 'insects.csv'),
];

const parse = (p) => Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
const write = (p, rows) => {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
};

function maxCrId(rows) {
  let mx = 0;
  for (const r of rows) {
    const m = String(r.insect_id || '').match(/^species-CR(\d{3})$/);
    if (m) mx = Math.max(mx, parseInt(m[1], 10));
  }
  return mx;
}

function hasDuplicate(rows, r0) {
  const g = (r0.genus || '').trim();
  const s = (r0.species || '').trim();
  const j = (r0.japanese_name || '').trim();
  if (!g || !s) return false;
  return rows.some(r => {
    if (!r) return false;
    const id = (r.insect_id || '').trim();
    if (!id || id === 'species-') return false;
    if (r === r0) return false;
    const g2 = (r.genus || '').trim();
    const s2 = (r.species || '').trim();
    const j2 = (r.japanese_name || '').trim();
    return (g2 === g && s2 === s) || (j && j2 && j2 === j);
  });
}

for (const file of FILES) {
  const rows = parse(file);
  const before = rows.length;
  let cr = maxCrId(rows);
  let removed = 0;
  let assigned = 0;

  // Pass 1: remove pure duplicates with blank ID
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (!r) continue;
    if ((r.insect_id || '').trim() === 'species-') {
      if (hasDuplicate(rows, r)) {
        rows.splice(i, 1);
        removed++;
      }
    }
  }

  // Pass 2: assign new CR IDs to remaining blank-ID Criocerinae entries
  for (const r of rows) {
    if (!r) continue;
    if ((r.insect_id || '').trim() !== 'species-') continue;
    const fam = (r.family || '').trim();
    const famJP = (r.family_jp || '').trim();
    const subfam = (r.subfamily || '').trim();
    const subfamJP = (r.subfamily_jp || '').trim();
    if (fam === 'Chrysomelidae' || famJP === 'ハムシ科') {
      if (subfam === 'Criocerinae' || subfamJP === 'クビボソハムシ亜科') {
        cr += 1;
        r.insect_id = `species-CR${String(cr).padStart(3, '0')}`;
        assigned++;
      }
    }
  }

  write(file, rows);
  console.log(`${path.relative(process.cwd(), file)}: removed=${removed}, assigned=${assigned}, total=${rows.length} (was ${before})`);
}

