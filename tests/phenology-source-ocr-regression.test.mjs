import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Papa from 'papaparse';
import { buildInsectDetailNotes, parseInsectDetailSeason } from '../src/utils/insectDetailNotes.js';
import { projectInsectNotes } from '../src/utils/insectNoteRevisions.js';

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

test('成虫期の原典再照合をCSVに反映し、冊子頁を出典として示す', () => {
  const ledger = Papa.parse(read('../data/source_audits/adult-phenology-recheck-2026-11-27.csv'), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(ledger.errors, []);
  for (const entry of ledger.data) {
    const note = notes.get(entry.record_id);
    if (entry.decision === 'remove') {
      assert.equal(note, undefined, entry.record_id);
      continue;
    }
    assert.equal(note?.insect_id, entry.insect_id, entry.record_id);
    assert.equal(note?.content, entry.after, entry.record_id);
    assert.equal(note?.reference, entry.source, entry.record_id);
    assert.equal(note?.page, entry.printed_page, entry.record_id);
    assert.equal(note?.note_type, entry.new_type, entry.record_id);
  }
});

test('アオセダカシャチホコの2期と北海道の時期を表示する', () => {
  const note = notes.get('note-1004240');
  const { seasonRecords } = buildInsectDetailNotes({
    type: 'moth',
    generalNotes: [{ ...note, type: note.note_type }],
  });
  assert.match(seasonRecords[0].content, /5月頃と8月頃.+北海道では6〜7月/);
  assert.deepEqual(seasonRecords[0].sources, ['日本産蛾類標準図鑑2 p. 136']);
  const { months } = parseInsectDetailSeason(seasonRecords.map(({ content }) => content));
  assert.deepEqual(months.toSorted((a, b) => a - b), [5, 6, 7, 8]);
});

test('発生時期・生態の重複修正は元の行が一致するときだけ公開用データに適用する', () => {
  const audit = Papa.parse(read('../data/source_audits/general-note-redundancy-recheck-2026-11-27.csv'), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(audit.errors, []);
  for (const entry of audit.data) {
    const source = notes.get(entry.record_id);
    assert.equal(source?.insect_id, entry.insect_id, entry.record_id);
    const projected = projectInsectNotes([source]);
    if (entry.decision === 'exclude') {
      assert.deepEqual(projected, [], entry.record_id);
    } else {
      assert.deepEqual(projected, [{
        ...source,
        note_type: entry.note_type,
        content: entry.content,
        reference: entry.reference,
        page: entry.printed_page,
      }], entry.record_id);
    }
  }
});

test('アトジロキリガは図鑑2の成虫期と年1回の出現を一つにまとめ、冬夜蛾の出典を保持する', () => {
  const rows = [...notes.values()].filter((note) => note.insect_id === 'species-6138');
  const generalNotes = projectInsectNotes(rows).map((note) => ({ ...note, type: note.note_type }));
  const { seasonRecords } = buildInsectDetailNotes({ type: 'moth', generalNotes });
  assert.deepEqual(seasonRecords, [
    { content: '成虫は4〜6月にかけて年1回出現する。', sources: ['日本産蛾類標準図鑑2 p. 372'] },
    { content: '4〜5月', sources: ['日本の冬夜蛾 p. 102'] },
  ]);
  const { months } = parseInsectDetailSeason(seasonRecords.map(({ content }) => content));
  assert.deepEqual(months, [4, 5, 6]);
});

test('出典にない世代間の月や、飼育・偶産の月を足さない', () => {
  assert.deepEqual(parseInsectDetailSeason([notes.get('note-1004296').content]).months, [6, 8, 9]);
  assert.deepEqual(parseInsectDetailSeason([notes.get('note-1004268').content]).months, [5, 6, 8, 9]);
  assert.deepEqual(parseInsectDetailSeason([notes.get('note-1004373').content]).months, []);
  assert.equal(notes.get('note-1004357').note_type, '生態情報');
  assert.deepEqual(parseInsectDetailSeason([notes.get('note-1004357').content]).months, []);
});
