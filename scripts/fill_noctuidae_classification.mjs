import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];

const parseCsv = async (filePath) => {
  const text = await fs.readFile(filePath, 'utf8');
  const { data } = Papa.parse(text, { header: true, skipEmptyLines: false });
  return Array.isArray(data) ? data : [];
};

const toCsv = (rows) => Papa.unparse(rows, { header: true });

const trim = (v) => (v == null ? '' : String(v).trim());

const main = async () => {
  // Build a genus -> classification map from both files combined
  const allRows = [];
  for (const f of FILES) allRows.push(...(await parseCsv(f)));

  const byGenus = new Map();
  for (const r of allRows) {
    if (!r) continue;
    const fam = trim(r['family']);
    const genus = trim(r['genus']);
    const subf = trim(r['subfamily']);
    const subfJa = trim(r['subfamily_jp']);
    const tribe = trim(r['tribe']);
    const tribeJa = trim(r['tribe_jp']);
    if (!fam || !genus) continue;
    // prefer rows that have tribe filled; fall back to subfamily-only if needed
    const key = `${fam}::${genus}`;
    const cur = byGenus.get(key);
    const candidate = { fam, genus, subf, subfJa, tribe, tribeJa };
    const hasTribe = !!tribe;
    const curHasTribe = cur ? !!cur.tribe : false;
    if (!cur || (hasTribe && !curHasTribe)) byGenus.set(key, candidate);
  }

  let totalChanges = 0;
  for (const file of FILES) {
    const rows = await parseCsv(file);
    let changes = 0;
    for (const r of rows) {
      if (!r) continue;
      const fam = trim(r['family']);
      const genus = trim(r['genus']);
      if (!fam || !genus) continue;
      const key = `${fam}::${genus}`;
      const m = byGenus.get(key);
      if (!m) continue;
      const subf = trim(r['subfamily']);
      const subfJa = trim(r['subfamily_jp']);
      const tribe = trim(r['tribe']);
      const tribeJa = trim(r['tribe_jp']);
      let changed = false;
      // Fill subfamily when missing and mapping has it
      if (!subf && m.subf) { r['subfamily'] = m.subf; changed = true; }
      if (!subfJa && m.subfJa) { r['subfamily_jp'] = m.subfJa; changed = true; }
      // Fill tribe when missing and mapping has it
      if (!tribe && m.tribe) { r['tribe'] = m.tribe; changed = true; }
      if (!tribeJa && m.tribeJa) { r['tribe_jp'] = m.tribeJa; changed = true; }
      if (changed) changes++;
    }
    if (changes > 0) {
      await fs.writeFile(file, toCsv(rows), 'utf8');
      console.log(`Filled classification for ${changes} rows in ${path.relative(ROOT, file)}`);
      totalChanges += changes;
    } else {
      console.log(`No classification gaps filled in ${path.relative(ROOT, file)}`);
    }
  }
  console.log(`Total classification fills: ${totalChanges}`);
};

main().catch((e) => { console.error('fill_noctuidae_classification failed:', e); process.exit(1); });

