import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import Papa from 'papaparse';

const ROOT = path.resolve(import.meta.dirname, '..');
const LEDGER = path.join(ROOT, 'data/source_audits/japanese-longhorn-beetles-2007-comprehensive-integrity-2026-07-12.json');
const SCRIPT = path.join(ROOT, 'scripts/apply-kamikiri-comprehensive-integrity-audit.mjs');
const PDF_SHA256 = '52299895c14c1fd1c74279dca00f6fd9ba64d36d69e3bf3dd9c3a29a92802e77';
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const HOST_COLUMNS = ['record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes'];
const INSECT_COLUMNS = [
  'insect_id', 'family', 'family_jp', 'subfamily', 'subfamily_jp', 'tribe', 'tribe_jp',
  'genus', 'subgenus', 'species', 'subspecies', 'author', 'year', 'japanese_name',
  'old_japanese_name', 'alternative_name', 'other_names', 'scientific_name', 'synonyms',
  'changes_since_standard', 'notes',
];

const audit = () => JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
const hash = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const readCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  assert.equal(parsed.errors.length, 0, `${filePath}: ${JSON.stringify(parsed.errors)}`);
  return parsed.data;
};
const writeCsv = (filePath, rows, columns) => {
  fs.writeFileSync(filePath, `\ufeff${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`);
};

function makeFixture({ pending = true } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kamikiri-comprehensive-'));
  for (const collection of ['normalized_data', 'public']) {
    fs.mkdirSync(path.join(root, collection), { recursive: true });
    for (const fileName of ['insects.csv', 'general_notes.csv', 'hostplants.csv']) {
      fs.copyFileSync(path.join(ROOT, collection, fileName), path.join(root, collection, fileName));
    }
  }
  if (pending) restorePendingState(root);
  return root;
}

function restorePendingState(root) {
  const ledger = audit();
  for (const [kind, fileName, columns] of [
    ['note', 'general_notes.csv', NOTE_COLUMNS],
    ['host', 'hostplants.csv', HOST_COLUMNS],
  ]) {
    const filePath = path.join(root, 'normalized_data', fileName);
    let rows = readCsv(filePath);
    const actions = ledger.actions.filter((action) => action.op.endsWith(`_${kind}`));
    for (const action of actions) {
      const recordId = action.before?.record_id || action.after?.record_id;
      const index = rows.findIndex((row) => row.record_id === recordId);
      if (action.op.startsWith('add_')) {
        if (index >= 0) rows.splice(index, 1);
      } else if (action.op.startsWith('update_')) {
        if (index >= 0) rows[index] = action.before;
        else rows.push(action.before);
      } else if (index < 0) {
        rows.push(action.before);
      } else {
        rows[index] = action.before;
      }
    }
    writeCsv(filePath, rows, columns);
  }
  const insectsPath = path.join(root, 'normalized_data', 'insects.csv');
  const insects = readCsv(insectsPath);
  for (const action of ledger.metadata_cleanup_actions) {
    const index = insects.findIndex((row) => row.insect_id === action.insect_id);
    assert.notEqual(index, -1);
    insects[index] = action.before;
  }
  writeCsv(insectsPath, insects, INSECT_COLUMNS);
}

function runApply(dataRoot, args = [], env = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, KAMIKIRI_COMPREHENSIVE_DATA_ROOT: dataRoot, ...env },
    encoding: 'utf8',
  });
}

test('ledger covers all 958 notes and all 38 independently derived sibling groups', () => {
  const ledger = audit();
  assert.equal(ledger.source.source_pdf_sha256, PDF_SHA256);
  assert.equal(ledger.note_coverage.length, 958);
  assert.equal(new Set(ledger.note_coverage.map((row) => row.record_id)).size, 958);
  assert.deepEqual(ledger.population_definition.baseline_note_type_counts, { '出現時期': 780, '生態情報': 178 });
  assert.equal(ledger.sibling_group_scope_ledger.length, 38);
  assert.equal(new Set(ledger.sibling_group_scope_ledger.map((row) => row.group_key)).size, 38);
  assert.equal(ledger.actions.length, 426);
  assert.equal(ledger.metadata_cleanup_actions.length, 36);
  assert.equal(ledger.summary.total_action_count, 462);
  assert.deepEqual(ledger.summary.action_counts, {
    add_host: 262,
    add_note: 113,
    delete_host: 4,
    delete_note: 3,
    update_note: 44,
  });
  assert.equal(ledger.summary.no_action_group_count, 4);
  for (const row of ledger.note_coverage.filter((entry) => entry.candidate_flags.length)) {
    assert.ok(row.linked_action_ids.length > 0, `${row.record_id}: flagged row lacks action`);
  }
});

test('scope ledger records exclusions instead of indiscriminate sibling copying', () => {
  const byKey = new Map(audit().sibling_group_scope_ledger.map((row) => [row.group_key, row]));
  assert.equal(byKey.get('Brachyclytus|monticallisus').disposition, 'hold_outside_source_range');
  assert.equal(byKey.get('Necydalis|moriyai').action_count, 0);
  assert.equal(byKey.get('Pseudopidonia|shikokensis').disposition, 'no_action_source_silent');
  assert.equal(byKey.get('Acalolepta|sublusca').disposition, 'japanese_subspecies_only');
  assert.match(byKey.get('Anoplophora|oshimana').rationale, /イスノキ/);
});

test('Eutetrapha chrysochloris keeps adult feeding separate from larval host records', () => {
  const actions = audit().actions;
  for (const insectId of ['species-22988', 'species-22989']) {
    const ecology = actions.find((row) =>
      row.op === 'add_note' && row.insect_id === insectId && row.after.note_type === '生態情報' &&
      row.after.content.includes('オヒョウ'),
    );
    assert.ok(ecology, `${insectId}: missing species-level ecology`);
    for (const plantName of ['オヒョウ', 'シナノキ', 'トチノキ']) {
      const adult = actions.find((row) =>
        row.op === 'add_host' && row.insect_id === insectId && row.after.plant_name === plantName &&
        row.after.observation_type === '後食' && row.after.life_stage === '成虫',
      );
      assert.ok(adult, `${insectId}/${plantName}: missing adult feeding action`);
      assert.equal(adult.after.plant_part, '葉・若枝');
    }
  }
  assert.ok(actions.some((row) =>
    row.op === 'add_host' && row.insect_id === 'species-22989' &&
    row.after.life_stage === '幼虫' && row.after.plant_name === 'カラマツ',
  ));
});

test('apply is normalized-only, fail-closed, and idempotent', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const publicPaths = ['general_notes.csv', 'hostplants.csv', 'insects.csv'].map((name) => path.join(fixture, 'public', name));
  const publicBefore = publicPaths.map(hash);
  const check = runApply(fixture, ['--check']);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  assert.match(check.stdout, /"state":"ready"/);
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /"state":"applied"/);
  assert.deepEqual(publicPaths.map(hash), publicBefore);
  const normalizedPaths = ['general_notes.csv', 'hostplants.csv', 'insects.csv'].map((name) => path.join(fixture, 'normalized_data', name));
  const afterFirst = normalizedPaths.map(hash);
  const second = runApply(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /"state":"already_applied"/);
  assert.deepEqual(normalizedPaths.map(hash), afterFirst);
  assert.deepEqual(publicPaths.map(hash), publicBefore);
});

test('mixed partial state is rejected without further mutation', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const action = audit().actions.find((row) => row.op === 'add_note');
  const filePath = path.join(fixture, 'normalized_data', 'general_notes.csv');
  const rows = readCsv(filePath).filter((row) => row.record_id !== action.after.record_id);
  writeCsv(filePath, rows, NOTE_COLUMNS);
  const before = hash(filePath);
  const mixed = runApply(fixture);
  assert.notEqual(mixed.status, 0);
  assert.match(mixed.stderr, /Refusing partial state/);
  assert.equal(hash(filePath), before);
});

test('source hash or exact before-value drift fails before writes', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const badLedger = path.join(fixture, 'bad-ledger.json');
  const mutated = audit();
  mutated.source.source_pdf_sha256 = '0'.repeat(64);
  fs.writeFileSync(badLedger, JSON.stringify(mutated));
  const notesPath = path.join(fixture, 'normalized_data', 'general_notes.csv');
  const before = hash(notesPath);
  const bad = runApply(fixture, [], { KAMIKIRI_COMPREHENSIVE_AUDIT_PATH: badLedger });
  assert.notEqual(bad.status, 0);
  assert.match(bad.stderr, /denominator\/provenance guard/);
  assert.equal(hash(notesPath), before);

  const rows = readCsv(notesPath);
  const target = rows.find((row) => row.record_id === 'note-1000931');
  target.content = 'drifted';
  writeCsv(notesPath, rows, NOTE_COLUMNS);
  const driftBefore = hash(notesPath);
  const drift = runApply(fixture);
  assert.notEqual(drift.status, 0);
  assert.match(drift.stderr, /Conflicting state/);
  assert.equal(hash(notesPath), driftBefore);
});
