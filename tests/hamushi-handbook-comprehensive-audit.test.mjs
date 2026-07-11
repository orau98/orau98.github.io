import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { parseCsv, serializeField, toObjects } from '../scripts/lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/hamushi-handbook-comprehensive-audit-2026-07-12.json',
);
const APPLY_PATH = path.join(ROOT, 'scripts/apply-hamushi-handbook-comprehensive-audit.mjs');
const SOURCE6_AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-leaf-beetle-ecology-notes-6-integrity-actions-2026-07-12.json',
);
const CANONICAL_MERGE_PATH = path.join(
  ROOT,
  'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
);
const AUDIT_SHA256 = '54a9150178ce632cf8e3422ca6009c17f23168e0eb4eb82cc0d3c84a78e7d5e8';
const SOURCE = 'ハムシハンドブック';
const audit = JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));
const source6Audit = JSON.parse(fs.readFileSync(SOURCE6_AUDIT_PATH, 'utf8'));
const canonicalMergeAudit = JSON.parse(fs.readFileSync(CANONICAL_MERGE_PATH, 'utf8'));

const TABLES = {
  hostplants: { fileName: 'hostplants.csv', actions: audit.host_actions },
  general_notes: { fileName: 'general_notes.csv', actions: audit.note_actions },
};

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
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
  const dataRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hamushi-handbook-full-'));
  const normalizedDir = path.join(dataRoot, 'normalized_data');
  fs.mkdirSync(normalizedDir);
  for (const { fileName } of Object.values(TABLES)) {
    fs.copyFileSync(
      path.join(ROOT, 'normalized_data', fileName),
      path.join(normalizedDir, fileName),
    );
  }
  const reverseTableActions = (filePath, actions) => {
    const { parsed, rows: originalRows } = readRows(filePath);
    let rows = originalRows.map((row) => ({ ...row }));
    let byId = new Map(rows.map((row) => [row.record_id, row]));
    for (const action of actions) {
      const id = action.before?.record_id ?? action.after?.record_id;
      if (!action.before) {
        rows = rows.filter((row) => row.record_id !== id);
        byId = new Map(rows.map((row) => [row.record_id, row]));
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

  // The final repository applies source6 and then the canonical-taxonomy
  // merge after the handbook audit. Rewind those downstream migrations in
  // reverse order so this fixture exercises the handbook at its documented
  // point in the ordered migration chain.
  reverseTableActions(
    path.join(normalizedDir, 'hostplants.csv'),
    canonicalMergeAudit.host_actions,
  );
  reverseTableActions(
    path.join(normalizedDir, 'general_notes.csv'),
    canonicalMergeAudit.note_actions,
  );
  reverseTableActions(
    path.join(normalizedDir, 'hostplants.csv'),
    source6Audit.host_actions,
  );
  reverseTableActions(
    path.join(normalizedDir, 'general_notes.csv'),
    source6Audit.note_actions,
  );

  for (const { fileName, actions } of Object.values(TABLES)) {
    reverseTableActions(path.join(normalizedDir, fileName), actions);
  }
  return dataRoot;
}

function runApply(dataRoot, ...arguments_) {
  return spawnSync(process.execPath, [APPLY_PATH, ...arguments_], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, HAMUSHI_HANDBOOK_DATA_ROOT: dataRoot },
  });
}

function dataHashes(dataRoot) {
  return Object.fromEntries(Object.entries(TABLES).map(([tableName, { fileName }]) => [
    tableName,
    sha256(fs.readFileSync(path.join(dataRoot, 'normalized_data', fileName))),
  ]));
}

const expectedSourceCountAfterAudit = (beforeCount, actions) => beforeCount + actions.reduce(
  (delta, action) => delta
    + (action.after?.reference === SOURCE ? 1 : 0)
    - (action.before?.reference === SOURCE ? 1 : 0),
  0,
);

test('the ledger covers every current handbook row and all 203 transcribed accounts', () => {
  assert.equal(sha256(fs.readFileSync(AUDIT_PATH)), AUDIT_SHA256);
  assert.equal(audit.source.reference, SOURCE);
  assert.equal(audit.source.year, 2014);
  assert.equal(audit.source.original_files.length, 44);
  assert.equal(audit.source_accounts.length, 203);
  assert.equal(audit.current_host_row_ledger.length, 406);
  assert.equal(audit.current_note_row_ledger.length, 270);
  assert.equal(new Set(audit.current_host_row_ledger.map((row) => row.record_id)).size, 406);
  assert.equal(new Set(audit.current_note_row_ledger.map((row) => row.record_id)).size, 270);
  assert.equal(audit.counts.low_page_matches, 0);
  assert.equal(audit.host_actions.length, 156);
  assert.equal(audit.note_actions.length, 280);
  assert.equal(audit.note_actions.filter((row) => row.action === 'delete_synthetic_source_spill').length, 65);
  assert.ok([...audit.host_actions, ...audit.note_actions].every((row) => (
    row.verification_status === 'original_image_verified'
    && row.source.printed_page >= 12
    && row.source.printed_page <= 99
    && /^[a-f0-9]{64}$/u.test(row.source.original_file_sha256)
  )));
});

test('species-level sharing is explicit and geographically limited accounts are held', () => {
  const scopeByAccount = new Map(audit.species_scope_decisions.map((row) => [row.source_account_id, row]));
  assert.deepEqual(scopeByAccount.get('HHB-037').targets, [
    'species-H964', 'species-H599', 'species-H600', 'species-H601', 'species-H965',
  ]);
  assert.deepEqual(scopeByAccount.get('HHB-062').targets, [
    'species-H484', 'species-H485', 'species-H486', 'species-H488', 'species-H931',
  ]);
  assert.equal(scopeByAccount.has('HHB-195'), false);
  const plagiosterna = audit.source_scope_holds.find((row) => row.hold_id === 'HHB-HOLD-PLAGIOSTERNA');
  assert.equal(plagiosterna.decision, 'do_not_cross_share');

  const okinawa = audit.note_actions.find((row) => row.after?.insect_id === 'species-H790');
  assert.equal(okinawa.after.content, '沖縄本島：2〜6月（他時期は不明）');
  assert.equal(okinawa.source.printed_page, 96);
});

test('the approved facts include the reported missing foods and corrected emergence values', () => {
  const hostAdditions = audit.host_actions.filter((row) => row.action === 'add_hostplant');
  for (const [insectId, plantName] of [
    ['species-H628', 'マユミ'],
    ['species-H672', 'フジ'],
    ['species-H708', 'センナリホオズキ'],
    ['species-H931', 'ノブドウ'],
    ['species-H347', 'クリ'],
  ]) {
    assert.ok(hostAdditions.some((row) => (
      row.after.insect_id === insectId && row.after.plant_name === plantName
    )), `${insectId}/${plantName}`);
  }
  const noteByRecord = new Map(audit.note_actions.map((row) => [row.before?.record_id, row]));
  assert.equal(noteByRecord.get('note-000507').after.content, '4〜9月');
  assert.equal(noteByRecord.get('note-000499').after.content, '4〜7月');
  assert.equal(noteByRecord.get('note-000412').after.content, '4〜7月');
  assert.equal(noteByRecord.get('note-000478').after.insect_id, 'species-H964');
});

test('436 exact actions apply, remain normalized-only, and are byte-idempotent', () => {
  const dataRoot = makePendingFixture();
  try {
    const check = runApply(dataRoot, '--check');
    assert.equal(check.status, 0, check.stderr || check.stdout);
    assert.equal(JSON.parse(check.stdout).state, 'pending');

    const first = runApply(dataRoot);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const summary = JSON.parse(first.stdout);
    assert.equal(summary.changed, 436);
    assert.deepEqual(summary.action_counts, { hostplants: 156, general_notes: 280 });

    const hostRows = readRows(path.join(dataRoot, 'normalized_data/hostplants.csv')).rows;
    const noteRows = readRows(path.join(dataRoot, 'normalized_data/general_notes.csv')).rows;
    const hosts = new Map(hostRows.map((row) => [row.record_id, row]));
    const notes = new Map(noteRows.map((row) => [row.record_id, row]));
    assert.equal(hosts.get('hostplant-007054').insect_id, 'species-H943');
    assert.equal(hosts.get('hostplant-007146').insect_id, 'species-H964');
    assert.equal(hosts.get('hostplant-006955').plant_name, 'エビヅル');
    assert.equal(hosts.has('hostplant-007195'), false);
    assert.equal(notes.get('note-000478').insect_id, 'species-H964');
    assert.equal(notes.get('note-000507').content, '4〜9月');
    assert.equal(notes.has('note-000260'), false);
    assert.equal(
      hostRows.filter((row) => row.reference === SOURCE).length,
      expectedSourceCountAfterAudit(audit.counts.current_source_host_rows, audit.host_actions),
    );
    assert.equal(
      noteRows.filter((row) => row.reference === SOURCE).length,
      expectedSourceCountAfterAudit(audit.counts.current_source_note_rows, audit.note_actions),
    );

    const afterFirst = dataHashes(dataRoot);
    const second = runApply(dataRoot);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.equal(JSON.parse(second.stdout).changed, 0);
    assert.deepEqual(dataHashes(dataRoot), afterFirst);
    assert.doesNotMatch(fs.readFileSync(APPLY_PATH, 'utf8'), /public\//u);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('the production checkout recognizes four later canonical host merges', () => {
  const result = runApply(ROOT, '--check');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.state, 'applied_downstream');
  assert.equal(summary.changed, 0);
  assert.equal(summary.downstream_rows, 4);
  assert.equal(
    summary.downstream_audit,
    'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json',
  );
});

test('unexpected before-state drift is rejected before either table is written', () => {
  const dataRoot = makePendingFixture();
  try {
    const filePath = path.join(dataRoot, 'normalized_data/general_notes.csv');
    const { parsed, rows } = readRows(filePath);
    rows.find((row) => row.record_id === 'note-000507').content = '予期しない変更';
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
