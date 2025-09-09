import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const BACKUP = path.join(PUB, 'insects.csv.bak.binran_author_20250907055356');
const NORMAL = path.join(ROOT, 'normalized_data', 'insects.csv');
const TARGET = path.join(PUB, 'insects.csv');

const parse = async (file) => {
  const text = await fs.readFile(file, 'utf8');
  const res = Papa.parse(text, { header: true, skipEmptyLines: true });
  return res.data;
};

const trim = (v) => (v == null ? '' : String(v).trim());

const run = async () => {
  const backupRows = await parse(BACKUP);
  const normRows = await parse(NORMAL);
  const byId = new Map();
  backupRows.forEach((r) => { const id = trim(r['insect_id']); if (id) byId.set(id, r); });
  // ensure species-20437 exists from normalized source
  if (!byId.has('species-20437')) {
    const n = normRows.find((r) => trim(r['insect_id']) === 'species-20437');
    if (n) byId.set('species-20437', n);
  }
  // Recreate CSV rows preserving backup order, then append any new IDs not present
  const header = Object.keys(backupRows[0] || {});
  const out = [];
  out.push(header.join(','));
  const seen = new Set();
  for (const r of backupRows) {
    const id = trim(r['insect_id']);
    if (!id) continue;
    const src = byId.get(id) || r;
    seen.add(id);
    out.push(header.map((h) => (src[h] == null ? '' : String(src[h]))).join(','));
  }
  // Append new entries
  for (const [id, r] of byId.entries()) {
    if (seen.has(id)) continue;
    out.push(header.map((h) => (r[h] == null ? '' : String(r[h]))).join(','));
  }
  await fs.writeFile(TARGET, out.join('\n'), 'utf8');
  console.log('Rebuilt public/insects.csv from backup + normalized additions');
};

run().catch((e) => { console.error(e); process.exit(1); });

