import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const filePath = path.join(process.cwd(), 'public', 'insects.csv');
if (!fs.existsSync(filePath)) {
  console.error('public/insects.csv not found');
  process.exit(1);
}

const original = fs.readFileSync(filePath, 'utf-8');
const text = original.charCodeAt(0) === 0xFEFF ? original.slice(1) : original;

const parsed = Papa.parse(text, { header: true, skipEmptyLines: 'greedy' });
const fields = parsed.meta && parsed.meta.fields ? parsed.meta.fields : Object.keys(parsed.data[0] || {});

let changed = 0;
const cleaned = parsed.data.map((row) => {
  if (!row) return row;
  const name = (row['japanese_name'] || '').trim();

  const cleanList = (value) => {
    if (!value) return [];
    const items = String(value)
      .split(/[、,，]/)
      .map(s => s.trim())
      .filter(Boolean);
    const unique = Array.from(new Set(items));
    return unique.filter(n => n !== name);
  };

  let oldJ = (row['old_japanese_name'] || '').trim();
  let alt = (row['alternative_name'] || '').trim();
  let others = (row['other_names'] || '').trim();

  const oldNew = oldJ && oldJ === name ? '' : oldJ;
  const altNew = cleanList(alt).join('、');
  const othersNew = cleanList(others).join('、');

  if (oldNew !== oldJ || altNew !== alt || othersNew !== others) {
    changed++;
    row['old_japanese_name'] = oldNew;
    row['alternative_name'] = altNew;
    row['other_names'] = othersNew;
  }
  return row;
});

if (changed > 0) {
  const backup = filePath + '.bak.altclean';
  fs.writeFileSync(backup, original, 'utf-8');
  const out = Papa.unparse(cleaned, { columns: fields, newline: '\n' });
  fs.writeFileSync(filePath, out, 'utf-8');
  console.log(`Cleaned ${changed} rows. Backup written to ${backup}.`);
} else {
  console.log('No rows needed cleaning.');
}

