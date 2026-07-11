import crypto from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { collectGeneralNoteIssues } from '../scripts/lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-hamakiga2-general-note-audit.mjs');
const REPAIR_SCRIPT = path.join(ROOT, 'scripts', 'repair-literature-record-integrity.mjs');
const AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-2-general-note-audit-2026-07-12.json',
);
const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
const audit = JSON.parse(rawAudit);
const SOURCE = '日本のハマキガ2';
const COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const INFERENCE_PATTERN = /可能性|かもしれな|思われ|おそらく|恐らく|推定|考えられ|疑われ|推測|らしい/;
const EDITORIAL_PATTERN = /に詳しい|を参照/;

const runApply = (notesPath, options = {}) => spawnSync(
  process.execPath,
  [APPLY_SCRIPT, ...(options.args || [])],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      HAMAKIGA2_NOTE_AUDIT_NOTES_PATH: notesPath,
      ...(options.env || {}),
    },
  },
);

const runRecordIdRepair = (notesPath, directory) => {
  const hostsPath = path.join(directory, 'hostplants.csv');
  const insectsPath = path.join(directory, 'insects.csv');
  fs.writeFileSync(hostsPath, 'record_id,insect_id\r\n');
  fs.writeFileSync(insectsPath, 'insect_id,notes\r\n');
  return spawnSync(process.execPath, [REPAIR_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      LITERATURE_RECORD_NOTES_PATH: notesPath,
      LITERATURE_RECORD_HOSTPLANTS_PATH: hostsPath,
      LITERATURE_RECORD_INSECTS_PATH: insectsPath,
    },
  });
};

const makeFixtureRows = () => {
  const rows = audit.rows.map(row => ({
    record_id: row.record_id,
    insect_id: row.insect_id,
    note_type: row.note_type,
    content: row.old_content,
    reference: SOURCE,
    page: row.old_page,
    year: '',
  }));
  rows.push(
    {
      record_id: 'note-hamakiga2-6166-emergence-409121779623',
      insect_id: 'species-6166',
      note_type: '出現時期',
      content: '3月-7月',
      reference: SOURCE,
      page: '',
      year: '',
    },
    {
      record_id: 'note-hamakiga2-2089-emergence-a5ee0321cf7f',
      insect_id: 'species-2089',
      note_type: '出現時期',
      content: '6月-8月',
      reference: SOURCE,
      page: '',
      year: '',
    },
    {
      record_id: 'note-hamakiga2-2089-ecology-747fb0db4ce0',
      insect_id: 'species-2089',
      note_type: '生態情報',
      content: 'ハルニレ自生地で採集されている',
      reference: SOURCE,
      page: '',
      year: '',
    },
  );
  for (let index = 0; index < 72; index += 1) {
    rows.push({
      record_id: 'filler-emergence-' + index,
      insect_id: 'filler-species-emergence-' + index,
      note_type: '出現時期',
      content: (index + 1) + '月',
      reference: SOURCE,
      page: '',
      year: '',
    });
  }
  for (let index = 0; index < 26; index += 1) {
    rows.push({
      record_id: 'filler-ecology-' + index,
      insect_id: 'filler-species-ecology-' + index,
      note_type: '生態情報',
      content: '客観的な生態記述' + (index + 1) + '。',
      reference: SOURCE,
      page: '',
      year: '',
    });
  }
  rows.push({
    record_id: 'note-unrelated',
    insect_id: 'species-unrelated',
    note_type: '生態情報',
    content: '無関係な確定本文。',
    reference: '別文献',
    page: '10',
    year: '',
  });
  return rows;
};

const writeNotes = (filePath, rows) => fs.writeFileSync(
  filePath,
  '\ufeff' + Papa.unparse(rows, { columns: COLUMNS, newline: '\r\n' }) + '\r\n',
);

const parseNotes = filePath => Papa.parse(
  fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
  { header: true, skipEmptyLines: true },
).data;

test('production ledger fixes 10 inference candidates and keeps species-level source scope', () => {
  assert.equal(
    crypto.createHash('sha256').update(rawAudit).digest('hex'),
    'ce01b372ee86ed75bc125979f85c680d413bcd0bcf13cdaba890a4d4b85b9009',
  );
  assert.equal(audit.source_pdf.sha256, 'c08313ec4623e47ea158bf63a93109568b007413cfb8030a7f094ca48fc35ef1');
  assert.equal(audit.source_pdf.page_count, 89);
  assert.equal(audit.source_pdf.role, 'original_full_pdf_image_review');
  assert.equal(audit.candidate_locator_pdf.role, 'text_layer_candidate_location_only_not_acceptance_evidence');
  assert.equal(audit.rows.length, 26);
  assert.deepEqual(audit.expected_profile, { update_note: 21, delete_note: 5 });
  assert.equal(audit.rows.filter(row => row.review_class === 'explicit_inference').length, 10);
  assert.equal(audit.rows.filter(row => row.review_class === 'qualitative_candidate').length, 13);
  assert.equal(audit.rows.filter(row => row.review_class === 'integrity_companion').length, 3);
  assert.equal(new Set(audit.rows.map(row => row.audit_id)).size, 26);
  assert.equal(new Set(audit.rows.map(row => row.record_id)).size, 26);
  for (const row of audit.rows) {
    assert.equal(row.source_taxon_scope, 'species', row.audit_id);
    assert.ok(row.pdf_pages.length > 0, row.audit_id);
    assert.ok(row.printed_pages.length > 0, row.audit_id);
    assert.ok(row.evidence, row.audit_id);
    assert.ok(row.decision, row.audit_id);
    if (row.action === 'update_note') {
      assert.equal(row.approved_page, String(row.printed_pages.at(-1)), row.audit_id);
      assert.equal(INFERENCE_PATTERN.test(row.approved_content), false, row.audit_id);
      assert.equal(EDITORIAL_PATTERN.test(row.approved_content), false, row.audit_id);
      assert.deepEqual(collectGeneralNoteIssues({
        note_type: row.note_type,
        content: row.approved_content,
        page: row.approved_page,
      }), [], row.audit_id);
    } else {
      assert.equal(row.approved_content, '', row.audit_id);
      assert.equal(row.approved_page, '', row.audit_id);
    }
  }
  const sp2093 = audit.rows.filter(row => row.insect_id === 'species-2093');
  assert.equal(sp2093.length, 2);
  assert.ok(sp2093.every(row => row.action === 'delete_note'));
  assert.ok(sp2093.every(row => row.source_account === 68));
  const sp6166 = audit.rows.find(row => row.insect_id === 'species-6166');
  assert.equal(sp6166.action, 'delete_note');
  assert.equal(sp6166.source_account, 68);
  assert.equal(audit.rows.find(row => row.record_id === 'note-hamakiga2-1882-ecology-d00aa2b032e5').source_account, 27);
});

test('apply updates 21, deletes five, preserves correct headings and is byte-idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-audit-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());

  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const summary = JSON.parse(first.stdout);
  assert.equal(summary.note_updated, 21);
  assert.equal(summary.note_deleted, 5);
  assert.equal(summary.source_rows_after, 122);
  assert.equal(summary.target_inference_after, 0);
  assert.equal(summary.editorial_guidance_after, 0);
  const firstBytes = fs.readFileSync(notesPath);
  assert.equal(firstBytes.subarray(0, 3).toString('hex'), 'efbbbf');
  const rows = parseNotes(notesPath);
  const byId = new Map(rows.map(row => [row.record_id, row]));
  for (const entry of audit.rows) {
    if (entry.action === 'delete_note') {
      assert.equal(byId.has(entry.record_id), false, entry.audit_id);
    } else {
      assert.equal(byId.get(entry.record_id)?.content, entry.approved_content, entry.audit_id);
      assert.equal(byId.get(entry.record_id)?.page, entry.approved_page, entry.audit_id);
    }
  }
  assert.equal(byId.get('note-hamakiga2-6166-emergence-409121779623').content, '3月-7月');
  assert.equal(byId.get('note-hamakiga2-2089-emergence-a5ee0321cf7f').content, '6月-8月');
  assert.equal(byId.get('note-hamakiga2-2089-ecology-747fb0db4ce0').content, 'ハルニレ自生地で採集されている');
  assert.equal(byId.get('note-unrelated').content, '無関係な確定本文。');

  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  const secondSummary = JSON.parse(second.stdout);
  assert.equal(secondSummary.note_updated, 0);
  assert.equal(secondSummary.note_deleted, 0);
  assert.equal(secondSummary.changed, false);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('record-ID recalculation after repair remains byte-idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-repair-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());

  const applied = runApply(notesPath);
  assert.equal(applied.status, 0, applied.stderr || applied.stdout);
  const legacyIds = new Set(audit.rows
    .filter(row => row.action === 'update_note')
    .map(row => row.record_id));

  const repaired = runRecordIdRepair(notesPath, directory);
  assert.equal(repaired.status, 0, repaired.stderr || repaired.stdout);
  assert.match(repaired.stdout, /note_ids=/);
  const repairedRows = parseNotes(notesPath);
  assert.ok(repairedRows.every(row => !legacyIds.has(row.record_id)));
  const repairedBytes = fs.readFileSync(notesPath);

  const reapplied = runApply(notesPath);
  assert.equal(reapplied.status, 0, reapplied.stderr || reapplied.stdout);
  const summary = JSON.parse(reapplied.stdout);
  assert.equal(summary.note_updated, 0);
  assert.equal(summary.note_deleted, 0);
  assert.equal(summary.changed, false);
  assert.deepEqual(fs.readFileSync(notesPath), repairedBytes);
});

test('--check validates the complete hypothetical result without writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-check-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeNotes(notesPath, makeFixtureRows());
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.note_updated, 21);
  assert.equal(summary.note_deleted, 5);
  assert.equal(summary.check_only, true);
  assert.equal(summary.changed, false);
  assert.equal(summary.would_change, true);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('a partially applied audit is rejected without writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-partial-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const target = audit.rows.find(row => row.action === 'update_note');
  const fixtureTarget = rows.find(row => row.record_id === target.record_id);
  fixtureTarget.content = target.approved_content;
  fixtureTarget.page = target.approved_page;
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Partial audit state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('unexpected late-row content aborts before any write', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-late-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const lastTarget = audit.rows.at(-1);
  rows.find(row => row.record_id === lastTarget.record_id).content = '別の確定本文。';
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected update state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('renamed delete target with identical content is not accepted as applied', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-delete-id-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = makeFixtureRows();
  const target = audit.rows.find(row => row.action === 'delete_note');
  rows.find(row => row.record_id === target.record_id).record_id = 'renamed-delete-target';
  writeNotes(notesPath, rows);
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Required note is missing/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('wrong source PDF is rejected before writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-pdf-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const pdfPath = path.join(directory, 'wrong.pdf');
  writeNotes(notesPath, makeFixtureRows());
  fs.writeFileSync(pdfPath, 'not the audited PDF');
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, {
    env: { HAMAKIGA2_NOTE_AUDIT_PDF_PATH: pdfPath },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('same-count tampered ledger is rejected in production mode', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga2-note-ledger-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const auditPath = path.join(directory, 'audit.json');
  writeNotes(notesPath, makeFixtureRows());
  const tampered = structuredClone(audit);
  tampered.rows[0].decision += '_tampered';
  fs.writeFileSync(auditPath, JSON.stringify(tampered, null, 2) + '\n');
  const before = fs.readFileSync(notesPath);

  const result = runApply(notesPath, {
    env: {
      HAMAKIGA2_NOTE_AUDIT_PATH: auditPath,
      HAMAKIGA2_NOTE_AUDIT_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});
