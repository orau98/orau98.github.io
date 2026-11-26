import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Papa from 'papaparse';
import { parseInsectDetailSeason } from '../src/utils/insectDetailNotes.js';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const canonical = read('../normalized_data/general_notes.csv');
const notes = new Map(Papa.parse(canonical, { header: true, skipEmptyLines: true }).data
  .map((row) => [row.record_id, row]));
const audit = JSON.parse(read('../data/source_audits/general-note-ocr-recheck-2026-11-26.json'));

test('原典再確認を行った一般注記と公開用CSVが監査台帳に一致する', () => {
  assert.equal(read('../public/general_notes.csv'), canonical);
  for (const entry of audit.rows) {
    const row = notes.get(entry.record_id);
    if (entry.decision === 'exclude') {
      assert.equal(row, undefined, entry.record_id);
      continue;
    }
    assert.equal(row?.insect_id, entry.insect_id, entry.record_id);
    assert.equal(row?.note_type, entry.note_type, entry.record_id);
    assert.equal(row?.reference, entry.reference, entry.record_id);
    assert.equal(row?.content, entry.approved_content, entry.record_id);
    assert.equal(row?.page, entry.printed_page.replace('–', '-'), entry.record_id);
  }
});

test('ウスモンフユシャクの地域別の発生期を冬の3か月に限って描く', () => {
  const guide = notes.get('note-200640');
  const winterMoths = notes.get('note-000595');
  assert.match(guide.content, /12月下旬〜1月下旬.+11月中旬〜12月上旬/);
  assert.equal(guide.page, '203');
  const { months } = parseInsectDetailSeason([guide.content, winterMoths.content]);
  assert.deepEqual(months.toSorted((a, b) => a - b), [1, 11, 12]);
});
