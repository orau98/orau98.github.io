import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];
const REPORT = path.join(ROOT, 'reports', 'missing_butterfly_author_year.csv');

const hasJapanese = (s = '') => /[\u3040-\u30FF\u4E00-\u9FFF]/.test(s);

const main = async () => {
  const rowsOut = [];
  for (const file of FILES) {
    const text = await fs.readFile(file, 'utf8');
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: false });
    let rowNum = 1; // header is 1
    for (const r of data) {
      rowNum++;
      if (!r || (Object.keys(r).length === 1 && Object.values(r)[0] === '')) continue;
      const famJp = (r.family_jp || r.family || '').trim();
      if (!famJp.endsWith('チョウ科')) continue;
      const a = (r.author || '').trim();
      const y = (r.year || '').trim();
      if (!a || !y) {
        rowsOut.push({
          file: path.relative(ROOT, file),
          row: rowNum,
          insect_id: (r.insect_id || '').trim(),
          family: (r.family || '').trim(),
          family_jp: famJp,
          genus: (r.genus || '').trim(),
          species: (r.species || '').trim(),
          japanese_name: (r.japanese_name || '').trim(),
          author: a,
          year: y,
        });
      }
    }
  }
  await fs.mkdir(path.join(ROOT, 'reports'), { recursive: true });
  const csv = Papa.unparse(rowsOut);
  await fs.writeFile(REPORT, csv, 'utf8');
  console.log(`Wrote report: ${path.relative(ROOT, REPORT)} (${rowsOut.length} rows)`);
};

main().catch((e) => { console.error(e); process.exit(1); });

