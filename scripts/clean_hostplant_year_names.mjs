import fs from 'fs';
import Papa from 'papaparse';

const TARGETS = ['normalized_data/hostplants.csv', 'public/hostplants.csv'];

function looksLikeYearOnly(s) {
  if (!s) return false;
  const t = String(s).trim();
  return /^[\[(（]?\s*\d{3,4}\s*[\])）)]*\s*$/.test(t);
}

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skip missing file: ${filePath}`);
    return 0;
  }
  const csv = fs.readFileSync(filePath, 'utf-8');
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: false });
  const rows = parsed.data;
  let changed = 0;
  for (const row of rows) {
    if (!row) continue;
    if (looksLikeYearOnly(row.plant_name)) {
      row.plant_name = '';
      changed++;
    }
  }
  const output = Papa.unparse(rows, { columns: parsed.meta?.fields || undefined });
  fs.writeFileSync(filePath, output);
  console.log(`clean_hostplant_year_names: updated ${changed} rows in ${filePath}`);
  return changed;
}

function main() {
  let total = 0;
  for (const f of TARGETS) total += cleanFile(f);
  if (total === 0) console.log('clean_hostplant_year_names: no changes needed');
}

main();
