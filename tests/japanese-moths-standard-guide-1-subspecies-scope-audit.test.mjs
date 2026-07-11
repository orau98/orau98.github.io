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
const SCRIPT = path.join(ROOT, 'scripts', 'apply-japanese-moths-standard-guide-1-subspecies-scope-audit.mjs');
const AUDIT_PATH = path.join(ROOT, 'data', 'source_audits', 'japanese-moths-standard-guide-1-subspecies-scope-2026-07-12.json');
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];

const updateAction = audit.actions.find((action) => action.action === 'update_note');
const hostActions = audit.actions.filter((action) => action.action === 'add_host');
const writeCsv = (filePath, rows, columns) => fs.writeFileSync(
  filePath,
  `\ufeff${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`,
);
const makeNotes = () => [{
  record_id: updateAction.record_id,
  insect_id: updateAction.insect_id,
  note_type: updateAction.note_type,
  content: updateAction.expected_content,
  reference: updateAction.reference,
  page: updateAction.expected_page,
  year: '',
}];
const makeHosts = () => hostActions.map((action) => ({
  record_id: action.source_record_id,
  insect_id: 'species-20461',
  plant_name: action.plant_name,
  plant_family: action.plant_family,
  observation_type: action.observation_type,
  plant_part: action.plant_part,
  life_stage: action.life_stage,
  reference: action.reference,
  notes: action.notes,
}));
const makeFixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'jmsg1-subscope-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const hostsPath = path.join(directory, 'hostplants.csv');
  writeCsv(notesPath, makeNotes(), NOTE_COLUMNS);
  writeCsv(hostsPath, makeHosts(), HOST_COLUMNS);
  return { directory, notesPath, hostsPath };
};
const run = ({ notesPath, hostsPath }, { args = [], env = {} } = {}) => spawnSync(
  process.execPath,
  [SCRIPT, ...args],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      JMSG1_SUBSCOPE_NOTES_PATH: notesPath,
      JMSG1_SUBSCOPE_HOSTS_PATH: hostsPath,
      ...env,
    },
  },
);
const readRows = (filePath) => Papa.parse(
  fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
  { header: true, skipEmptyLines: true },
).data;

test('ledger records two geography-explicit subspecies scopes and six exact actions', () => {
  assert.equal(audit.source_pdf.sha256, '35e3a46b1c91a6f16a6aff7522be708ed8a94ccfc8dc39d23c3d3e9171cfd0d9');
  assert.equal(audit.taxon_reviews.length, 2);
  assert.deepEqual(audit.taxon_reviews.map((review) => review.source_scope), [
    'subspecies_explicit_via_geography',
    'subspecies_explicit_via_geography',
  ]);
  assert.deepEqual(audit.taxon_reviews.map((review) => review.apply_targets[0].insect_id), [
    'species-21572',
    'species-21573',
  ]);
  assert.ok(audit.taxon_reviews.every((review) => review.excluded_targets.length > 0));
  assert.deepEqual(audit.scope.expected_actions, { update_note: 1, add_note: 2, add_host: 3 });
  assert.equal(audit.actions.length, 6);
  for (const action of audit.actions.filter((candidate) => candidate.action.endsWith('note'))) {
    assert.deepEqual(collectGeneralNoteIssues({
      note_type: action.note_type,
      content: action.approved_content,
      page: action.approved_page,
    }), [], action.action_id);
  }
});

test('apply updates one source note, adds two scoped notes and three hosts, then is byte-idempotent', () => {
  const fixture = makeFixture();
  const first = run(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"pending_note_updates": 1/);
  assert.match(first.stdout, /"pending_note_adds": 2/);
  assert.match(first.stdout, /"pending_host_adds": 3/);
  const firstNotes = fs.readFileSync(fixture.notesPath);
  const firstHosts = fs.readFileSync(fixture.hostsPath);
  const notes = new Map(readRows(fixture.notesPath).map((row) => [row.record_id, row]));
  const hosts = new Map(readRows(fixture.hostsPath).map((row) => [row.record_id, row]));
  for (const action of audit.actions.filter((candidate) => candidate.action.endsWith('note'))) {
    assert.equal(notes.get(action.record_id)?.content, action.approved_content, action.action_id);
    assert.equal(notes.get(action.record_id)?.page, action.approved_page, action.action_id);
  }
  for (const action of hostActions) {
    assert.equal(hosts.get(action.record_id)?.insect_id, 'species-21572', action.action_id);
    assert.equal(hosts.get(action.record_id)?.plant_name, action.plant_name, action.action_id);
  }
  const second = run(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), firstNotes);
  assert.deepEqual(fs.readFileSync(fixture.hostsPath), firstHosts);
});

test('--check performs full validation without writing either CSV', () => {
  const fixture = makeFixture();
  const beforeNotes = fs.readFileSync(fixture.notesPath);
  const beforeHosts = fs.readFileSync(fixture.hostsPath);
  const result = run(fixture, { args: ['--check'] });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /"pending_note_adds": 2/);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), beforeNotes);
  assert.deepEqual(fs.readFileSync(fixture.hostsPath), beforeHosts);
});

test('a late source-host mismatch fails before either file is written', () => {
  const fixture = makeFixture();
  const rows = makeHosts();
  rows.at(-1).plant_name = '別植物';
  writeCsv(fixture.hostsPath, rows, HOST_COLUMNS);
  const beforeNotes = fs.readFileSync(fixture.notesPath);
  const beforeHosts = fs.readFileSync(fixture.hostsPath);
  const result = run(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source host mismatch/);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), beforeNotes);
  assert.deepEqual(fs.readFileSync(fixture.hostsPath), beforeHosts);
});

test('an unexpected existing target row fails closed', () => {
  const fixture = makeFixture();
  const add = audit.actions.find((action) => action.action === 'add_note');
  const rows = makeNotes();
  rows.push({
    record_id: add.record_id, insect_id: add.insect_id, note_type: add.note_type,
    content: '別の本文。', reference: add.reference, page: add.approved_page, year: '',
  });
  writeCsv(fixture.notesPath, rows, NOTE_COLUMNS);
  const beforeNotes = fs.readFileSync(fixture.notesPath);
  const beforeHosts = fs.readFileSync(fixture.hostsPath);
  const result = run(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Existing added note is not exact/);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), beforeNotes);
  assert.deepEqual(fs.readFileSync(fixture.hostsPath), beforeHosts);
});

test('source PDF mismatch fails before writing', () => {
  const fixture = makeFixture();
  const pdfPath = path.join(fixture.directory, 'source.pdf');
  fs.writeFileSync(pdfPath, 'wrong PDF');
  const beforeNotes = fs.readFileSync(fixture.notesPath);
  const beforeHosts = fs.readFileSync(fixture.hostsPath);
  const result = run(fixture, { env: { JMSG1_SUBSCOPE_PDF_PATH: pdfPath } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), beforeNotes);
  assert.deepEqual(fs.readFileSync(fixture.hostsPath), beforeHosts);
});

test('tampered ledger is rejected in production mode', () => {
  const fixture = makeFixture();
  const auditPath = path.join(fixture.directory, 'audit.json');
  const tampered = structuredClone(audit);
  tampered.taxon_reviews[0].source_scope_evidence += ' tampered';
  fs.writeFileSync(auditPath, `${JSON.stringify(tampered, null, 2)}\n`);
  const beforeNotes = fs.readFileSync(fixture.notesPath);
  const beforeHosts = fs.readFileSync(fixture.hostsPath);
  const result = run(fixture, { env: {
    JMSG1_SUBSCOPE_AUDIT_PATH: auditPath,
    JMSG1_SUBSCOPE_ENFORCE_PRODUCTION: '1',
  } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production audit SHA-256 mismatch/);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), beforeNotes);
  assert.deepEqual(fs.readFileSync(fixture.hostsPath), beforeHosts);
});
