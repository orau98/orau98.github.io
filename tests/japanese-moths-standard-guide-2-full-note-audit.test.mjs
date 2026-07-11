import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { collectGeneralNoteIssues } from '../scripts/lib/generalNoteQuality.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = path.join(ROOT, 'scripts/apply-japanese-moths-standard-guide-2-full-note-audit.mjs');
const AUDIT_PATH = path.join(ROOT, 'data/source_audits/japanese-moths-standard-guide-2-full-note-integrity-2026-07-12.json');
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];

const fixtureRows = () => [
  {
    record_id: 'note-unrelated', insect_id: 'species-unrelated', note_type: '生態情報',
    content: '無関係な確定本文。', reference: '別文献', page: '10', year: '',
  },
  ...audit.entries.map((entry) => ({
    record_id: entry.record_id,
    insect_id: entry.insect_id,
    note_type: entry.note_type,
    content: entry.expected_content,
    reference: entry.reference,
    page: entry.expected_page,
    year: '',
  })),
];

const writeFixture = (filePath, rows = fixtureRows()) => fs.writeFileSync(
  filePath,
  `\ufeff${Papa.unparse(rows, { columns: COLUMNS, newline: '\r\n' })}\r\n`,
);

const runApply = (notesPath, { args = [], env = {} } = {}) => spawnSync(
  process.execPath,
  [APPLY, ...args],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, JMSG2_FULL_NOTES_PATH: notesPath, ...env },
  },
);

test('production ledger covers all 184 ecology and 53 emergence candidates with exact guards', () => {
  assert.equal(audit.entries.length, 237);
  assert.equal(audit.scope.reviewed_ecology_candidates, 184);
  assert.equal(audit.scope.reviewed_emergence_candidates, 53);
  assert.equal(audit.entries.filter((entry) => entry.action === 'replace_note_content').length, 233);
  assert.equal(audit.entries.filter((entry) => entry.action === 'hold_no_change').length, 4);
  assert.equal(new Set(audit.entries.map((entry) => entry.audit_id)).size, 237);
  assert.equal(new Set(audit.entries.map((entry) => entry.record_id)).size, 237);
  for (const entry of audit.entries) {
    assert.equal(entry.reference, audit.reference, entry.audit_id);
    assert.ok(['生態情報', '出現時期'].includes(entry.note_type), entry.audit_id);
    assert.equal(entry.source_scope.source_level, 'species_account', entry.audit_id);
    assert.equal(entry.source_scope.subspecies_explicit_in_source, false, entry.audit_id);
    assert.deepEqual(entry.source_scope.excluded_targets, [], entry.audit_id);
    assert.equal(entry.source_scope.applied_targets[0].insect_id, entry.insect_id, entry.audit_id);
    if (entry.action === 'replace_note_content') {
      assert.notEqual(entry.expected_content, entry.approved_content, entry.audit_id);
      assert.ok(entry.approved_page, entry.audit_id);
      assert.deepEqual(collectGeneralNoteIssues({
        note_type: entry.note_type,
        content: entry.approved_content,
        page: entry.approved_page,
      }), [], entry.audit_id);
    } else {
      assert.equal(entry.expected_content, entry.approved_content, entry.audit_id);
      assert.equal(entry.expected_page, entry.approved_page, entry.audit_id);
    }
  }
  const inherited = audit.entries.find((entry) => entry.record_id === 'note-1004207');
  assert.equal(inherited.source_scope.applied_targets[0].taxon_scope, 'subspecies:oriens');
  assert.match(inherited.source_scope.rationale, /亜種名を明記しない種レベル/);
});

test('apply replaces 233 notes, verifies four holds, and is byte-idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg2-full-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeFixture(notesPath);
  const first = runApply(notesPath);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"pending_replacements": 233/);
  assert.match(first.stdout, /"verified_holds": 4/);
  const firstBytes = fs.readFileSync(notesPath);
  const parsed = Papa.parse(firstBytes.toString('utf8').replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  assert.deepEqual(parsed.errors, []);
  const byId = new Map(parsed.data.map((row) => [row.record_id, row]));
  assert.equal(byId.get('note-unrelated').content, '無関係な確定本文。');
  for (const entry of audit.entries) {
    assert.equal(byId.get(entry.record_id)?.content, entry.approved_content, entry.audit_id);
    assert.equal(byId.get(entry.record_id)?.page, entry.approved_page, entry.audit_id);
  }
  const second = runApply(notesPath);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(notesPath), firstBytes);
});

test('--check validates without writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg2-full-check-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  writeFixture(notesPath);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"would_change": true/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('late failure aborts before any write', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg2-full-late-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = fixtureRows();
  const target = audit.entries.at(-1);
  rows.find((row) => row.record_id === target.record_id).content = '別の確定本文。';
  writeFixture(notesPath, rows);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected replacement state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('partial content/page state is refused without writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg2-full-partial-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = fixtureRows();
  const target = audit.entries.find((entry) => entry.action === 'replace_note_content');
  rows.find((row) => row.record_id === target.record_id).content = target.approved_content;
  writeFixture(notesPath, rows);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unexpected replacement state/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('exact target identity mismatch is refused without writing', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg2-full-identity-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const rows = fixtureRows();
  const target = audit.entries.find((entry) => entry.action === 'replace_note_content');
  rows.find((row) => row.record_id === target.record_id).insect_id = 'species-wrong';
  writeFixture(notesPath, rows);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Target identity mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('source PDF hash mismatch fails closed', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg2-full-pdf-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const pdfPath = path.join(directory, '日本産蛾類標準図鑑2.pdf');
  writeFixture(notesPath);
  fs.writeFileSync(pdfPath, 'not the audited PDF');
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, { env: { JMSG2_FULL_PDF_PATH: pdfPath } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});

test('tampered ledger cannot be forced through production mode', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg2-full-ledger-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const auditPath = path.join(directory, 'audit.json');
  writeFixture(notesPath);
  const tampered = structuredClone(audit);
  tampered.entries[0].decision += ' tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const before = fs.readFileSync(notesPath);
  const result = runApply(notesPath, {
    env: { JMSG2_FULL_AUDIT_PATH: auditPath, JMSG2_FULL_ENFORCE_PRODUCTION: '1' },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(notesPath), before);
});
