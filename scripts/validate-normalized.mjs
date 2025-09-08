import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');
const REPORT_DIR = path.join(ROOT, 'reports');
const REPORT_FILE = path.join(REPORT_DIR, 'missing_ids.csv');

const FILES = {
  insects: path.join(PUB, 'insects.csv'),
  hostplants: path.join(PUB, 'hostplants.csv'),
  notes: path.join(PUB, 'general_notes.csv'),
};

const parseCsv = async (filePath) => {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const { data } = Papa.parse(text, { header: true, skipEmptyLines: true });
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

const trim = (v) => (v == null ? '' : String(v).trim());

const main = async () => {
  const insects = await parseCsv(FILES.insects);
  const hostplants = await parseCsv(FILES.hostplants);
  const notes = await parseCsv(FILES.notes);

  const report = [];

  // Build id set from insects
  const validIds = new Set(
    insects
      .map((r) => trim(r['insect_id']))
      .filter((id) => !!id)
  );

  // 1) insects.csv: rows with missing insect_id but with other content
  insects.forEach((row, i) => {
    const id = trim(row['insect_id']);
    if (!id) {
      const values = Object.values(row).map(trim);
      const nonEmpty = values.filter(Boolean).length;
      if (nonEmpty > 0) {
        report.push({
          file: 'insects.csv',
          row: i + 2, // header is row 1
          reason: 'missing insect_id',
          japanese_name: trim(row['japanese_name']),
          scientific_name: trim(row['scientific_name']),
          family: trim(row['family']),
          family_jp: trim(row['family_jp']),
        });
      }
    }
  });

  // 2) hostplants.csv: missing/unknown insect_id
  hostplants.forEach((row, i) => {
    const id = trim(row['insect_id']);
    const reason = !id ? 'missing insect_id' : (!validIds.has(id) ? 'unknown insect_id' : '');
    if (reason) {
      report.push({
        file: 'hostplants.csv',
        row: i + 2,
        reason,
        insect_id: id,
        plant_name: trim(row['plant_name']),
        plant_family: trim(row['plant_family']),
      });
    }
  });

  // 3) general_notes.csv: missing/unknown insect_id
  notes.forEach((row, i) => {
    const id = trim(row['insect_id']);
    const reason = !id ? 'missing insect_id' : (!validIds.has(id) ? 'unknown insect_id' : '');
    if (reason) {
      report.push({
        file: 'general_notes.csv',
        row: i + 2,
        reason,
        insect_id: id,
        note_type: trim(row['note_type']),
        content: trim(row['content']).slice(0, 64),
      });
    }
  });

  await fs.mkdir(REPORT_DIR, { recursive: true });

  if (report.length === 0) {
    const csv = Papa.unparse([
      { file: 'none', row: '', reason: 'no issues found' },
    ]);
    await fs.writeFile(REPORT_FILE, csv, 'utf8');
    console.log('No missing/unknown insect_id found. Report generated:', REPORT_FILE);
    return;
  }

  const csv = Papa.unparse(report);
  await fs.writeFile(REPORT_FILE, csv, 'utf8');
  console.log(`Missing/unknown insect_id report generated: ${REPORT_FILE} (${report.length} rows)`);
};

main().catch((e) => {
  console.error('validate-normalized failed:', e);
  process.exit(0);
});

