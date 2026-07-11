import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import Papa from 'papaparse';

import { parseCsv, serializeField, toObjects } from '../scripts/lib/csvQuality.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-leaf-beetle-ecology-notes-6-integrity-actions-2026-07-12.json',
);
const ACCOUNTS_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-leaf-beetle-ecology-notes-6-all-accounts-2026-07-12.csv',
);
const APPLY_PATH = path.join(ROOT, 'scripts/apply-japanese-leaf-beetle-ecology-notes-6-audit.mjs');
const CANONICAL_MERGE_PATH = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const AUDIT_SHA256 = 'fd2175310233b1a37c560b282321a868c08ea976065a345fa2d139c17c2ce991';
const SOURCE = '日本産ハムシ科生態覚書 (6)';
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const canonicalMergeAudit = JSON.parse(fs.readFileSync(CANONICAL_MERGE_PATH, 'utf8'));
const TABLES = {
  hosts: { fileName: 'hostplants.csv', idColumn: 'record_id', actions: audit.host_actions },
  notes: { fileName: 'general_notes.csv', idColumn: 'record_id', actions: audit.note_actions },
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const referenceParts = (value) => String(value || '').split(/\s*;\s*/u).filter(Boolean);
const hasReference = (value, reference) => referenceParts(value).includes(reference);
const readRows = (filePath) => {
  const parsed = parseCsv(fs.readFileSync(filePath, 'utf8'));
  return { parsed, rows: toObjects(parsed) };
};
const writeRows = (filePath, columns, rows, bom = true) => fs.writeFileSync(
  filePath,
  `${bom ? '\ufeff' : ''}${columns.join(',')}\r\n${rows.map((row) => (
    columns.map((column) => serializeField(row[column] ?? '')).join(',')
  )).join('\r\n')}\r\n`,
  'utf8',
);

function makePendingFixture() {
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hamushi6-audit-'));
  const normalizedDir = path.join(dataRoot, 'normalized_data');
  fs.mkdirSync(normalizedDir);
  for (const fileName of ['insects.csv', ...Object.values(TABLES).map((table) => table.fileName)]) {
    fs.copyFileSync(path.join(ROOT, 'normalized_data', fileName), path.join(normalizedDir, fileName));
  }
  const reverseTableActions = (filePath, idColumn, actions) => {
    const { parsed, rows: originalRows } = readRows(filePath);
    let rows = originalRows.map((row) => ({ ...row }));
    let byId = new Map(rows.map((row) => [row[idColumn], row]));
    for (const action of actions) {
      const id = action.before?.[idColumn] ?? action.after?.[idColumn];
      if (!action.before) {
        rows = rows.filter((row) => row[idColumn] !== id);
        byId = new Map(rows.map((row) => [row[idColumn], row]));
        continue;
      }
      let row = byId.get(id);
      if (!row) {
        row = { ...action.before };
        rows.push(row);
        byId.set(id, row);
      } else {
        Object.assign(row, action.before);
      }
    }
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
  };

  // The final repository intentionally applies the canonical-taxonomy merge
  // after source6. Rewind that downstream audit first so this fixture tests
  // source6 at its documented point in the ordered migration chain.
  reverseTableActions(
    path.join(normalizedDir, 'insects.csv'),
    'insect_id',
    canonicalMergeAudit.insect_actions,
  );
  reverseTableActions(
    path.join(normalizedDir, 'hostplants.csv'),
    'record_id',
    canonicalMergeAudit.host_actions,
  );
  reverseTableActions(
    path.join(normalizedDir, 'general_notes.csv'),
    'record_id',
    canonicalMergeAudit.note_actions,
  );

  for (const { fileName, idColumn, actions } of Object.values(TABLES)) {
    const filePath = path.join(normalizedDir, fileName);
    reverseTableActions(filePath, idColumn, actions);
  }
  return dataRoot;
}

function runApply(dataRoot, ...arguments_) {
  return spawnSync(process.execPath, [APPLY_PATH, ...arguments_], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, HAMUSHI6_DATA_ROOT: dataRoot },
  });
}

function dataHashes(dataRoot) {
  return Object.fromEntries(Object.entries(TABLES).map(([tableName, { fileName }]) => [
    tableName,
    sha256(fs.readFileSync(path.join(dataRoot, 'normalized_data', fileName))),
  ]));
}

test('the original-PDF ledger covers every source6 account and seals only objective facts', () => {
  assert.equal(sha256(fs.readFileSync(AUDIT_PATH)), AUDIT_SHA256);
  assert.equal(audit.source.pdf_sha256, 'b16c29ef9ad7f9e017a0d1349c7907c013b7a6e5f53d8beae2d175230262f544');
  assert.equal(audit.counts.source_accounts, 112);
  assert.equal(audit.counts.mapped_source_accounts, 112);
  assert.equal(audit.counts.held_source_accounts, 0);
  assert.equal(audit.counts.approved_host_memberships_after, 206);
  assert.equal(audit.counts.approved_emergence_note_memberships_after, 103);
  assert.equal(audit.counts.approved_ecology_note_memberships_after, 95);
  assert.equal(audit.counts.approved_note_memberships_after, 198);
  assert.equal(audit.host_actions.length, 123);
  assert.equal(audit.note_actions.length, 202);
  assert.ok([...audit.host_actions, ...audit.note_actions]
    .every((action) => action.verification_status === 'original_pdf_page_verified'));
  const accounts = Papa.parse(
    fs.readFileSync(ACCOUNTS_PATH, 'utf8').replace(/^\uFEFF/u, ''),
    { header: true, skipEmptyLines: true },
  ).data;
  assert.equal(accounts.length, 112);
  assert.ok(accounts.every((account) => account.verification_status === 'original_pdf_page_verified'));
  assert.ok(accounts.every((account) => account.current_insect_ids));
  const approvedNotes = audit.note_actions.map((action) => action.after).filter(Boolean);
  assert.equal(
    approvedNotes.some((row) => /と思われ|可能性|情報はない|不明である/u.test(row.content)),
    false,
  );
});

test('the final checkout remains valid after the documented downstream canonical merge', () => {
  const result = runApply(ROOT, '--check');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.state, 'applied_downstream');
  assert.equal(summary.would_change, false);
  assert.match(summary.downstream_audit, /leaf-beetle-canonical-taxonomy-merge/u);
});

test('325 exact actions apply across host and note tables and become byte-idempotent', () => {
  const dataRoot = makePendingFixture();
  try {
    const first = runApply(dataRoot);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const summary = JSON.parse(first.stdout);
    assert.equal(summary.changed, 325);
    assert.deepEqual(summary.action_counts, { hosts: 123, notes: 202 });

    const hostRows = readRows(path.join(dataRoot, 'normalized_data/hostplants.csv')).rows;
    const noteRows = readRows(path.join(dataRoot, 'normalized_data/general_notes.csv')).rows;
    const sourceHosts = hostRows.filter((row) => hasReference(row.reference, SOURCE));
    const sourceNotes = noteRows.filter((row) => hasReference(row.reference, SOURCE));
    assert.equal(sourceHosts.length, 206);
    assert.equal(sourceNotes.length, 198);
    assert.equal(sourceNotes.filter((row) => row.note_type === '出現時期').length, 103);
    assert.equal(sourceNotes.filter((row) => row.note_type === '生態情報').length, 95);
    assert.ok(sourceHosts.some((row) => (
      row.insect_id === 'species-H002' && row.plant_name === 'タデ' && row.observation_type === '国外'
    )));
    assert.ok(sourceHosts.some((row) => row.insect_id === 'species-H015' && row.plant_name === 'ワレモコウ'));
    assert.ok(sourceHosts.some((row) => row.insect_id === 'species-H084' && row.plant_name === 'ツワブキ'));
    assert.equal(sourceHosts.some((row) => ['species-H676', 'species-H092', 'species-H646'].includes(row.insect_id)), false);
    assert.equal(sourceHosts.some((row) => row.insect_id === 'species-H094' && row.plant_name === 'スギナ'), false);
    const h084Ecology = sourceNotes.find((row) => row.insect_id === 'species-H084' && row.note_type === '生態情報');
    assert.match(h084Ecology.content, /葉面に産卵/);
    assert.equal(h084Ecology.page, '44');
    assert.equal(h084Ecology.year, '2012');
    assert.ok(sourceNotes.some((row) => (
      row.insect_id === 'species-H019' && row.note_type === '出現時期' && row.content === '7月に採集記録'
    )));

    const afterFirst = dataHashes(dataRoot);
    const check = runApply(dataRoot, '--check');
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.equal(JSON.parse(check.stdout).state, 'applied');
    const second = runApply(dataRoot);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(second.stdout).changed, 0);
    assert.deepEqual(dataHashes(dataRoot), afterFirst);
    assert.doesNotMatch(fs.readFileSync(APPLY_PATH, 'utf8'), /public\//u);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('check mode validates the prospective result without writing pending data', () => {
  const dataRoot = makePendingFixture();
  try {
    const before = dataHashes(dataRoot);
    const result = runApply(dataRoot, '--check');
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const summary = JSON.parse(result.stdout);
    assert.equal(summary.state, 'pending');
    assert.equal(summary.would_change, true);
    assert.equal(summary.changed, 0);
    assert.deepEqual(dataHashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('partial application is rejected before either table is written', () => {
  const dataRoot = makePendingFixture();
  try {
    const action = audit.host_actions[0];
    const filePath = path.join(dataRoot, 'normalized_data/hostplants.csv');
    const { parsed, rows } = readRows(filePath);
    Object.assign(rows.find((row) => row.record_id === action.after.record_id), action.after);
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
    const before = dataHashes(dataRoot);
    const result = runApply(dataRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Partial audit state is not allowed/u);
    assert.deepEqual(dataHashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('unexpected before-state drift is rejected without cross-table writes', () => {
  const dataRoot = makePendingFixture();
  try {
    const action = audit.note_actions.find((item) => item.before && item.after);
    const filePath = path.join(dataRoot, 'normalized_data/general_notes.csv');
    const { parsed, rows } = readRows(filePath);
    rows.find((row) => row.record_id === action.before.record_id).content += '予期しない変更';
    writeRows(filePath, parsed.header, rows, Boolean(parsed.bom));
    const before = dataHashes(dataRoot);
    const result = runApply(dataRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /drifted/u);
    assert.deepEqual(dataHashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
