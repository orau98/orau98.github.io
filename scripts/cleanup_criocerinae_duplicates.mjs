import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const FILES = [
  path.join(process.cwd(), 'public', 'insects.csv'),
  path.join(process.cwd(), 'normalized_data', 'insects.csv'),
];

// 重複として削除するID（既存CRエントリがあるもの）
const REMOVE_IDS = new Set([
  'species-CR037', // Lilioceris balyi -> CR004 exists
  'species-CR038', // Lilioceris formosana -> CR005 exists
  'species-CR039', // Lilioceris merdigera -> CR006 exists
  'species-CR040', // Lilioceris parvicollis -> CR007 exists
  'species-CR042', // Lilioceris scapularis -> CR009 exists
  'species-CR043', // Oulema atrosuturalis -> CR030 exists
  'species-CR044', // Oulema erichsoni -> CR032 exists
  'species-CR045', // Oulema dilutipes -> CR031 exists
  'species-CR047', // Oulema oryzae -> CR034 exists
  'species-CR048', // Oulema tristis -> CR035 exists
]);

const parse = (p) => Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
const write = (p, rows) => {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
};

for (const file of FILES) {
  const rows = parse(file);
  const before = rows.length;
  const filtered = rows.filter(r => !r || !REMOVE_IDS.has((r.insect_id || '').trim()));
  write(file, filtered);
  console.log(`${path.relative(process.cwd(), file)}: removed ${before - filtered.length} rows`);
}

