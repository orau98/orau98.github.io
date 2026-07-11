import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { collectGeneralNoteIssues } from '../scripts/lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');

const readRows = (relativePath) => Papa.parse(
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  { header: true, skipEmptyLines: true },
).data;

test('all public general notes are free of OCR gaps, column bleed, and subjective prose', () => {
  const failures = readRows('normalized_data/general_notes.csv').flatMap((row) => {
    const issues = collectGeneralNoteIssues(row)
      .filter((issue) => issue !== 'missing_source_page');
    return issues.length > 0 ? [{ row, issues }] : [];
  });
  assert.deepEqual(
    failures.map(({ row, issues }) => (
      `${row.record_id} (${row.reference}): ${issues.join(';')}`
    )),
    [],
  );
});
