import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const APPLY = path.join(ROOT, 'scripts', 'apply-hamakiga1-editorial-cleanup.mjs');
const PDF_SHA256 = '78f75fd532ace774cff181d573c96c04052e1c65dd77a352ec520d7cd33de646';
const COLUMNS = [
  'audit_id', 'record_id', 'insect_id', 'japanese_name', 'reference', 'note_type',
  'old_content', 'approved_content', 'pdf_file', 'pdf_sha256', 'pdf_page',
  'printed_page', 'evidence', 'decision', 'reviewed_on',
];

const writeLedger = (filePath, rows) => fs.writeFileSync(filePath, `${Papa.unparse(rows.map((row, index) => ({
  audit_id: `fixture-${index + 1}`,
  japanese_name: `試験種${index + 1}`,
  reference: '日本のハマキガ1',
  note_type: '生態情報',
  pdf_file: 'source.pdf',
  pdf_sha256: PDF_SHA256,
  pdf_page: String(index + 1),
  printed_page: String(index + 10),
  evidence: 'fixture evidence',
  decision: 'remove_editorial_further_reading_retain_ecology',
  reviewed_on: '2026-07-12',
  ...row,
})), { columns: COLUMNS, newline: '\n' })}\n`);

const runApply = (notesPath, auditPath, extra = []) => spawnSync(
  process.execPath,
  [APPLY, ...extra],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      HAMAKIGA1_EDITORIAL_NOTES_PATH: notesPath,
      HAMAKIGA1_EDITORIAL_AUDIT_PATH: auditPath,
    },
  },
);

test('editorial cleanup removes only the terminal further-reading sentence and is idempotent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga1-editorial-'));
  const notesPath = path.join(dir, 'notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(notesPath, [
    'record_id,insect_id,note_type,content,reference,page,year',
    'note-a,species-a,生態情報,幼虫は葉を綴る．幼生期については，駒井ら(2011)に詳しい,日本のハマキガ1,,',
    'note-b,species-b,生態情報,幼虫は茎に潜る．幼生期の形態は駒井ら(2011)に詳しい,日本のハマキガ1,,',
    '',
  ].join('\r\n'));
  writeLedger(auditPath, [
    {
      record_id: 'note-a', insect_id: 'species-a',
      old_content: '幼虫は葉を綴る．幼生期については，駒井ら(2011)に詳しい',
      approved_content: '幼虫は葉を綴る',
    },
    {
      record_id: 'note-b', insect_id: 'species-b',
      old_content: '幼虫は茎に潜る．幼生期の形態は駒井ら(2011)に詳しい',
      approved_content: '幼虫は茎に潜る',
    },
  ]);

  const first = runApply(notesPath, auditPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const afterFirst = fs.readFileSync(notesPath);
  const rows = Papa.parse(afterFirst.toString('utf8'), { header: true, skipEmptyLines: true }).data;
  assert.deepEqual(rows.map(row => [row.content, row.page]), [
    ['幼虫は葉を綴る', '10'],
    ['幼虫は茎に潜る', '11'],
  ]);

  const second = runApply(notesPath, auditPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(notesPath), afterFirst);
});

test('check mode reports pending changes without writing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga1-editorial-check-'));
  const notesPath = path.join(dir, 'notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\nnote-a,species-a,生態情報,幼虫は葉を綴る．幼生期については，駒井ら(2011)に詳しい,日本のハマキガ1,,\r\n',
  );
  writeLedger(auditPath, [{
    record_id: 'note-a', insect_id: 'species-a',
    old_content: '幼虫は葉を綴る．幼生期については，駒井ら(2011)に詳しい',
    approved_content: '幼虫は葉を綴る',
  }]);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, auditPath, ['--check']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"pending": 1/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('unexpected content fails before any write', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga1-editorial-fail-'));
  const notesPath = path.join(dir, 'notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\nnote-a,species-a,生態情報,別の確定本文,日本のハマキガ1,,\r\n',
  );
  writeLedger(auditPath, [{
    record_id: 'note-a', insect_id: 'species-a',
    old_content: '幼虫は葉を綴る．幼生期については，駒井ら(2011)に詳しい',
    approved_content: '幼虫は葉を綴る',
  }]);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, auditPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Expected one target/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('production enforcement rejects a substituted same-count ledger', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga1-editorial-sha-'));
  const notesPath = path.join(dir, 'notes.csv');
  const auditPath = path.join(dir, 'audit.csv');
  fs.writeFileSync(notesPath, 'record_id,insect_id,note_type,content,reference,page,year\r\n');
  const production = fs.readFileSync(path.join(
    ROOT,
    'data/source_audits/japanese-tortricid-moths-1-editorial-cleanup-2026-07-12.csv',
  ), 'utf8');
  fs.writeFileSync(auditPath, production.replace('note-1000784', 'note-substitute'));
  const result = spawnSync(process.execPath, [APPLY], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      HAMAKIGA1_EDITORIAL_NOTES_PATH: notesPath,
      HAMAKIGA1_EDITORIAL_AUDIT_PATH: auditPath,
      HAMAKIGA1_EDITORIAL_ENFORCE_PRODUCTION: '1',
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
});

test('production ledger exactly covers every remaining Hamakiga 1 editorial sentence', () => {
  const ledger = Papa.parse(fs.readFileSync(path.join(
    ROOT,
    'data/source_audits/japanese-tortricid-moths-1-editorial-cleanup-2026-07-12.csv',
  ), 'utf8'), { header: true, skipEmptyLines: true }).data;
  const notes = Papa.parse(fs.readFileSync(path.join(
    ROOT,
    'normalized_data/general_notes.csv',
  ), 'utf8'), { header: true, skipEmptyLines: true }).data;
  const target = notes.filter(row => row.reference === '日本のハマキガ1'
    && /幼生期(?:について)?(?:の形態)?は?，?駒井ら\(2011\)に詳しい/.test(row.content));
  assert.equal(ledger.length, 33);
  const ledgerRecordIds = new Set(ledger.map(row => row.record_id));
  assert.deepEqual(target.filter(row => !ledgerRecordIds.has(row.record_id)), []);
  for (const audit of ledger) {
    const states = notes.filter(row => row.insect_id === audit.insect_id
      && row.note_type === audit.note_type
      && row.reference === audit.reference
      && (
        (row.content === audit.old_content && row.page === '')
        || (row.content === audit.approved_content && row.page === audit.printed_page)
      ));
    assert.equal(states.length, 1, audit.audit_id);
  }
});
