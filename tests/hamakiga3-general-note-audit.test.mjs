import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import Papa from 'papaparse';

import { collectGeneralNoteIssues } from '../scripts/lib/generalNoteQuality.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'apply-hamakiga3-general-note-audit.mjs');
const AUDIT = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-3-general-note-all-rows-2026-07-12.json',
);
const PDF_SHA256 = 'c10c4be6f8b7d4988a83361eafb3216131752bfd50d10ab32d4f6deca5cc240f';

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  assert.equal(parsed.errors.length, 0, JSON.stringify(parsed.errors));
  return parsed.data;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hamakiga3-audit-test-'));
  fs.copyFileSync(
    path.join(ROOT, 'normalized_data', 'general_notes.csv'),
    path.join(root, 'general_notes.csv'),
  );
  fs.copyFileSync(
    path.join(ROOT, 'normalized_data', 'insects.csv'),
    path.join(root, 'insects.csv'),
  );
  return root;
}

function runApply(root, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: {
      ...process.env,
      HAMAKIGA3_NOTES_PATH: path.join(root, 'general_notes.csv'),
      HAMAKIGA3_INSECTS_PATH: path.join(root, 'insects.csv'),
      ...extraEnv,
    },
    encoding: 'utf8',
  });
}

function replaceOnce(filePath, oldValue, newValue) {
  const source = fs.readFileSync(filePath, 'utf8');
  assert.equal(source.includes(oldValue), true, `fixture lacks ${oldValue}`);
  fs.writeFileSync(filePath, source.replace(oldValue, newValue), 'utf8');
}

function restoreUnmodifiedSourceState(filePath, ledger) {
  const rows = readCsv(filePath);
  const byId = new Map(rows.map((row) => [row.record_id, row]));
  for (const audit of ledger.rows) {
    let row = byId.get(audit.record_id);
    if (!row) {
      assert.equal(audit.action, 'delete_note');
      row = {
        record_id: audit.record_id,
        insect_id: audit.insect_id,
        note_type: audit.note_type,
        content: audit.source_content,
        reference: audit.reference,
        page: '',
        year: '',
      };
      rows.push(row);
      byId.set(row.record_id, row);
    } else {
      row.content = audit.source_content;
      row.page = '';
    }
  }
  fs.writeFileSync(filePath, Papa.unparse(rows, { newline: '\r\n' }), 'utf8');
}

test('ledger covers all 289 notes and all 180 source accounts', () => {
  const ledger = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  assert.equal(ledger.audit_metadata.source_pdf_sha256, PDF_SHA256);
  assert.equal(ledger.audit_metadata.current_rows_reviewed, 289);
  assert.equal(ledger.audit_metadata.source_accounts_reviewed, 180);
  assert.equal(ledger.audit_metadata.holds, 0);
  assert.equal(ledger.rows.length, 289);
  assert.equal(new Set(ledger.rows.map((row) => row.record_id)).size, 289);
  assert.equal(new Set(ledger.rows.map((row) => row.source_account)).size, 180);
  assert.deepEqual(
    ledger.rows.reduce((counts, row) => {
      counts[row.action] = (counts[row.action] || 0) + 1;
      return counts;
    }, {}),
    { verify_and_set_page: 273, replace_content: 14, delete_note: 2 },
  );
  assert.equal(
    ledger.rows.every(
      (row) => row.pdf_page && row.printed_page && row.source_heading && row.source_content,
    ),
    true,
  );
});

test('fully audited production state is byte-idempotent and source-clean', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"initial_content_state": "applied"/);
  assert.match(first.stdout, /"initial_page_state": "applied"/);
  const notesPath = path.join(fixture, 'general_notes.csv');
  const firstHash = sha256(notesPath);
  const second = runApply(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(sha256(notesPath), firstHash);
  const check = runApply(fixture, ['--check']);
  assert.equal(check.status, 0, check.stderr || check.stdout);

  const rows = readCsv(notesPath).filter((row) => row.reference === '日本のハマキガ3');
  assert.equal(rows.length, 287);
  assert.equal(rows.every((row) => row.page), true);
  assert.equal(rows.some((row) => row.record_id === 'note-H3-0077'), false);
  assert.equal(rows.some((row) => row.record_id === 'note-H3-0204'), false);
  assert.match(
    rows.find((row) => row.record_id === 'note-H3-0267').content,
    /Hyalopterus pruni による変形葉/,
  );
  assert.equal(
    rows.flatMap((row) => collectGeneralNoteIssues(row)).length,
    0,
  );
});

test('unmodified source state is also an approved reproducible starting point', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const notesPath = path.join(fixture, 'general_notes.csv');
  const ledger = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  restoreUnmodifiedSourceState(notesPath, ledger);
  const result = runApply(fixture);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"initial_content_state": "source"/);
  assert.equal(runApply(fixture, ['--check']).status, 0);
});

test('an unsupported partial content state fails without writing', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const notesPath = path.join(fixture, 'general_notes.csv');
  const ledger = JSON.parse(fs.readFileSync(AUDIT, 'utf8'));
  const row = ledger.rows.find((entry) => entry.record_id === 'note-H3-0002');
  replaceOnce(notesPath, row.approved_content, row.source_content);
  const before = sha256(notesPath);
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unsupported partial state/);
  assert.equal(sha256(notesPath), before);
});

test('partially applied page provenance fails without writing', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const notesPath = path.join(fixture, 'general_notes.csv');
  const rows = readCsv(notesPath);
  const target = rows.find((row) => row.record_id === 'note-H3-0001');
  target.page = '';
  fs.writeFileSync(notesPath, Papa.unparse(rows, { newline: '\r\n' }), 'utf8');
  const before = sha256(notesPath);
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /page provenance is partially applied/);
  assert.equal(sha256(notesPath), before);
});

test('taxon sibling drift fails before the notes file is written', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const insectsPath = path.join(fixture, 'insects.csv');
  const insects = readCsv(insectsPath);
  const sourceTaxon = insects.find((row) => row.insect_id === 'species-1896');
  insects.push({ ...sourceTaxon, insect_id: 'species-h3-sibling', subspecies: 'test' });
  fs.writeFileSync(insectsPath, Papa.unparse(insects, { newline: '\r\n' }), 'utf8');
  const notesPath = path.join(fixture, 'general_notes.csv');
  const before = sha256(notesPath);
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /subspecies sibling set changed/);
  assert.equal(sha256(notesPath), before);
});

test('optional original PDF verification rejects a hash mismatch', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const fakePdf = path.join(fixture, 'wrong.pdf');
  fs.writeFileSync(fakePdf, 'not the reviewed PDF', 'utf8');
  const result = runApply(fixture, [], { HAMAKIGA3_SOURCE_PDF: fakePdf });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
});
