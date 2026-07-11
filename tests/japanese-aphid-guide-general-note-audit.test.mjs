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
const SCRIPT = path.join(ROOT, 'scripts/apply-japanese-aphid-guide-general-note-audit.mjs');
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-aphid-guide-general-note-integrity-2026-07-12.json',
);
const COVERAGE_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-aphid-guide-all-accounts-2026-07-12.csv',
);
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const SOURCE = '日本原色アブラムシ図鑑';
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];
const INSECT_COLUMNS = Object.keys(audit.insect_actions[0].expected);

const parseCsv = filePath => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  assert.equal(parsed.errors.length, 0, `${filePath}: ${parsed.errors[0]?.message || ''}`);
  return parsed.data;
};
const writeCsv = (filePath, rows, columns, bom = false) => fs.writeFileSync(
  filePath,
  `${bom ? '\ufeff' : ''}${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`,
);
const hashes = fixture => Object.fromEntries([
  ['notes', fixture.notesPath], ['hosts', fixture.hostsPath], ['insects', fixture.insectsPath],
].map(([key, filePath]) => [key, crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')]));

function createFixture({ corruptExpectedNote = false } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aphid-guide-all-'));
  const notesPath = path.join(directory, 'general_notes.csv');
  const hostsPath = path.join(directory, 'hostplants.csv');
  const insectsPath = path.join(directory, 'insects.csv');
  const notes = audit.existing_source_notes.map(row => ({ ...row }));
  if (corruptExpectedNote) notes[0].content = `${notes[0].content}予期しない変更`;
  notes.push({
    record_id: 'note-unrelated',
    insect_id: 'species-unrelated',
    note_type: '生態情報',
    content: '別文献の確定情報。',
    reference: '別文献',
    page: '1',
    year: '',
  });
  writeCsv(notesPath, notes, NOTE_COLUMNS, true);

  const hosts = audit.host_actions
    .filter(action => action.expected)
    .map(action => ({ ...action.expected }));
  hosts.push({
    record_id: 'host-unrelated',
    insect_id: 'species-unrelated',
    plant_name: '別植物',
    plant_family: '別科',
    observation_type: '文献',
    plant_part: '葉',
    life_stage: '',
    reference: '別文献',
    notes: '保持対象',
  });
  writeCsv(hostsPath, hosts, HOST_COLUMNS);

  const targetIds = new Set(audit.approved_source_notes.map(row => row.insect_id));
  const patchExpected = audit.insect_actions[0].expected;
  const insects = [...targetIds].map(insectId => Object.fromEntries(
    INSECT_COLUMNS.map(column => [
      column,
      insectId === patchExpected.insect_id
        ? patchExpected[column] || ''
        : column === 'insect_id'
          ? insectId
          : column === 'family'
            ? 'Aphididae'
            : '',
    ]),
  ));
  insects.push(Object.fromEntries(INSECT_COLUMNS.map(column => [
    column,
    column === 'insect_id' ? 'species-unrelated' : column === 'family' ? 'Otheridae' : '',
  ])));
  writeCsv(insectsPath, insects, INSECT_COLUMNS, true);
  return { directory, notesPath, hostsPath, insectsPath };
}

const runFixture = (fixture, args = []) => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  env: {
    ...process.env,
    APHID_GUIDE_NOTES_PATH: fixture.notesPath,
    APHID_GUIDE_HOSTS_PATH: fixture.hostsPath,
    APHID_GUIDE_INSECTS_PATH: fixture.insectsPath,
  },
});

test('versioned coverage accounts for every original account and locks safe target scope', () => {
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync(COVERAGE_PATH)).digest('hex'),
    '201bd3c808f7dfc41ab1af6dca5a8efbd9132dd259a5979510af80cfc5afb9d4',
  );
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync(AUDIT_PATH)).digest('hex'),
    '5e53e9ea4bfac5bcc7353eef47b0526505fd508ef9c5775f45b0dd0bb1046b6d',
  );
  const coverage = parseCsv(COVERAGE_PATH);
  assert.equal(coverage.length, 240);
  assert.deepEqual(coverage.map(row => Number(row.account_number)), Array.from({ length: 240 }, (_, index) => index + 1));
  assert.ok(coverage.every(row => row.evidence_note.includes('目視確認')));
  assert.equal(coverage.filter(row => !row.application_targets).length, 8);
  assert.equal(coverage.filter(row => row.application_targets).length, 232);

  const byAccount = new Map(coverage.map(row => [Number(row.account_number), row]));
  assert.equal(byAccount.get(120).decision, 'hold_unresolved_current_taxon');
  assert.equal(byAccount.get(120).excluded_targets, 'species-21125');
  assert.equal(byAccount.get(113).application_targets, 'species-21350|species-21351');
  assert.equal(byAccount.get(161).application_targets, 'species-21225|species-21226');
  assert.equal(byAccount.get(163).application_targets, 'species-21229|species-21230');
  assert.equal(byAccount.get(165).application_targets, 'species-21238');
  assert.equal(byAccount.get(202).application_targets, 'species-21213');
  assert.equal(byAccount.get(226).source_scope, 'subspecies_level_explicit');
  assert.equal(byAccount.get(226).application_targets, '');
  assert.equal(byAccount.get(240).application_targets, '');
});

test('approved ecology profile is complete, page-backed, clean, and collision-free', () => {
  assert.equal(audit.source_pdf.sha256, 'd50ba1738d8088d464399da7ffc18b6d5f3418c7954fe58fc9e5b8c95691a61c');
  assert.equal(audit.source_pdf.page_count, 122);
  assert.equal(audit.source_pdf.role, 'original_full_pdf_image_review');
  assert.equal(audit.candidate_ocr.role, 'candidate_location_only_not_acceptance_evidence');
  assert.deepEqual(audit.expected_profile, {
    existing_source_note_count: 148,
    approved_source_note_count: 235,
    host_action_count: 48,
    insect_action_count: 1,
  });
  assert.equal(new Set(audit.approved_source_notes.map(row => row.record_id)).size, 235);
  const perTargetAccount = new Set();
  for (const row of audit.approved_source_notes) {
    assert.equal(row.reference, SOURCE);
    assert.equal(row.note_type, '生態情報');
    assert.ok(row.page);
    assert.equal(row.year, '');
    assert.deepEqual(collectGeneralNoteIssues(row), [], row.record_id);
    const match = row.record_id.match(/^note-aphid-guide-a(\d{3})-(species-\d+)-ecology$/);
    assert.ok(match, row.record_id);
    const key = `${match[1]}\0${row.insect_id}`;
    assert.equal(perTargetAccount.has(key), false, key);
    perTargetAccount.add(key);
  }
  const account113 = audit.approved_source_notes.filter(row => row.record_id.includes('-a113-'));
  assert.deepEqual(account113.map(row => row.insect_id).sort(), ['species-21350', 'species-21351']);
});

test('apply replaces the complete source profile, repairs scoped hosts and becomes byte-idempotent', () => {
  const fixture = createFixture();
  try {
    const first = runFixture(fixture);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const summary = JSON.parse(first.stdout);
    assert.equal(summary.source_notes_before, 148);
    assert.equal(summary.source_notes_after, 235);
    assert.equal(summary.host_actions, 48);
    assert.equal(summary.insect_actions, 1);
    assert.equal(summary.changed, true);

    const notes = parseCsv(fixture.notesPath);
    const hosts = parseCsv(fixture.hostsPath);
    const insects = parseCsv(fixture.insectsPath);
    assert.equal(notes.filter(row => row.reference === SOURCE).length, 235);
    assert.equal(notes.find(row => row.record_id === 'note-unrelated').content, '別文献の確定情報。');
    assert.equal(hosts.find(row => row.record_id === 'host-unrelated').notes, '保持対象');
    assert.equal(hosts.some(row => row.record_id === 'hostplant-902433'), false);
    assert.equal(hosts.some(row => row.record_id === 'hostplant-902730'), false);
    assert.equal(hosts.find(row => row.record_id === 'hostplant-902258').plant_part, '茎（特に穂茎）');
    assert.equal(hosts.find(row => row.record_id === 'hostplant-902258').notes, 'コロニーは大きい');
    assert.equal(hosts.filter(row => row.insect_id === 'species-21350' && row.reference === SOURCE).length, 4);
    assert.equal(hosts.filter(row => row.insect_id === 'species-21351' && row.reference === SOURCE).length, 4);
    assert.equal(hosts.filter(row => row.insect_id === 'species-21229' && row.reference === SOURCE).length, 5);
    assert.equal(hosts.filter(row => row.insect_id === 'species-21230' && row.reference === SOURCE).length, 5);
    assert.equal(hosts.filter(row => row.insect_id === 'species-23152' && row.reference === SOURCE).length, 3);
    assert.equal(insects.find(row => row.insect_id === 'species-21350').japanese_name, 'タデクギケアブラムシ');
    const firstHashes = hashes(fixture);

    const second = runFixture(fixture);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    const secondSummary = JSON.parse(second.stdout);
    assert.equal(secondSummary.state, 'applied');
    assert.equal(secondSummary.changed, false);
    assert.deepEqual(hashes(fixture), firstHashes);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('apply fails closed on unexpected source-note state without writing any target', () => {
  const fixture = createFixture({ corruptExpectedNote: true });
  try {
    const before = hashes(fixture);
    const result = runFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unexpected or partial source-note profile/);
    assert.deepEqual(hashes(fixture), before);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});

test('--check validates the full prospective result without writing and script is normalized-only', () => {
  const fixture = createFixture();
  try {
    const before = hashes(fixture);
    const result = runFixture(fixture, ['--check']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.would_change, true);
    assert.equal(summary.changed, false);
    assert.deepEqual(hashes(fixture), before);
    assert.doesNotMatch(fs.readFileSync(SCRIPT, 'utf8'), /public\//);
  } finally {
    fs.rmSync(fixture.directory, { recursive: true, force: true });
  }
});
