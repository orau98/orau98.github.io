#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const TARGET_FILES = [
  path.join('public', 'general_notes.csv'),
  path.join('normalized_data', 'general_notes.csv'),
];
const REPORT_PATH = path.join('reports', 'shortened_general_note_ids.json');
function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data.map(row => row || {});
  return { rows, header: parsed.meta.fields };
}

function writeCsv(file, rows) {
  const csv = Papa.unparse(rows, {
    columns: ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'],
  });
  fs.writeFileSync(file, `${csv}\n`, 'utf8');
}

function shortenId(recordId = '') {
  const timestampPattern = /-20\d{10,14}(?=-)/g;
  if (!timestampPattern.test(recordId)) return null;
  let shortened = recordId.replace(timestampPattern, '');
  shortened = shortened.replace(/--+/g, '-');
  shortened = shortened.replace(/-+$/g, match => (match.length ? '-' : '')); // safety
  return shortened;
}

function main() {
  const { rows } = readCsv(TARGET_FILES[0]);
  const existingIds = rows
    .map(row => (row.record_id || '').trim())
    .filter(Boolean);
  const idSet = new Set(existingIds);
  const mapping = new Map();

  for (const row of rows) {
    if (!row) continue;
    const original = (row.record_id || '').trim();
    if (!original) continue;
    const shortened = shortenId(original);
    if (!shortened || shortened === original) continue;

    idSet.delete(original);
    let candidate = shortened;
    let dedupeCounter = 1;
    while (idSet.has(candidate)) {
      candidate = `${shortened}-${String(dedupeCounter++).padStart(2, '0')}`;
    }
    idSet.add(candidate);
    mapping.set(original, candidate);
  }

  if (!mapping.size) {
    console.log('No record_id values matched the timestamp pattern; nothing to do.');
    return;
  }

  for (const file of TARGET_FILES) {
    const { rows: fileRows } = readCsv(file);
    const updated = fileRows.map(row => {
      if (!row) return row;
      const current = (row.record_id || '').trim();
      if (mapping.has(current)) {
        return { ...row, record_id: mapping.get(current) };
      }
      return row;
    });
    writeCsv(file, updated);
    console.log(`${file}: shortened ${mapping.size} record_id values where applicable.`);
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  const report = Array.from(mapping.entries()).map(([from, to]) => ({
    from,
    to,
  }));
  fs.writeFileSync(REPORT_PATH, JSON.stringify({ updated: report.length, changes: report }, null, 2));
  console.log(`Report written to ${REPORT_PATH} (updated ${report.length} ids).`);
}

main();
