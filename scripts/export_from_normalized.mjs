import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const NORMAL = path.join(ROOT, 'normalized_data', 'insects.csv');
const TARGET = path.join(ROOT, 'public', 'insects.csv');

const run = async () => {
  const text = await fs.readFile(NORMAL, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data;
  const csv = Papa.unparse(rows, { header: true });
  await fs.writeFile(TARGET, csv, 'utf8');
  console.log('Exported public/insects.csv from normalized_data/insects.csv');
};

run().catch((e) => { console.error(e); process.exit(1); });

