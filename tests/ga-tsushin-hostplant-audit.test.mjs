import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'apply-ga-tsushin-hostplant-audit.mjs');
const AUDIT = path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-candidates-2026-07-12.csv');
const DEDUP_AUDIT = path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-dedup-2026-07-12.csv');
const CLEANUP_AUDIT = path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-note-cleanup-2026-07-12.csv');
const ADDITIONAL_DEDUP_AUDIT = path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-additional-dedup-2026-07-12.csv');
const COLLECTIONS = ['normalized_data', 'public'];
const TARGET_PATHS = COLLECTIONS.map((collection) => `${collection}/hostplants.csv`);
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];

const parseCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  assert.equal(parsed.errors.length, 0, `${filePath}: ${parsed.errors[0]?.message || ''}`);
  return parsed.data;
};

const readAudits = () => parseCsv(AUDIT).map((row) => ({
  ...row,
  expected: JSON.parse(row.expected_json),
  approved: JSON.parse(row.approved_json),
}));

const readDedups = () => parseCsv(DEDUP_AUDIT).map((row) => ({
  ...row,
  canonicalExpected: JSON.parse(row.canonical_expected_json),
  canonicalApproved: JSON.parse(row.canonical_approved_json),
  duplicateExpected: JSON.parse(row.duplicate_expected_json),
}));

const readCleanups = () => parseCsv(CLEANUP_AUDIT).map((row) => ({
  ...row,
  expected: JSON.parse(row.expected_json),
  approved: JSON.parse(row.approved_json),
}));

const readAdditionalDedups = () => parseCsv(ADDITIONAL_DEDUP_AUDIT).map((row) => ({
  ...row,
  expected: JSON.parse(row.expected_json),
  approved: JSON.parse(row.approved_json),
}));

const hashes = (root) => Object.fromEntries(TARGET_PATHS.map((relativePath) => [
  relativePath,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex'),
]));

function createFixture({ unexpectedForeignScope = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ga-tsushin-hosts-'));
  const audits = readAudits();
  const dedups = readDedups();
  const additionalDedups = readAdditionalDedups();
  const startingRows = audits
    .filter((audit) => ['patch', 'delete'].includes(audit.apply_action))
    .map((audit) => ({ ...audit.expected }));
  const startingIds = new Set(startingRows.map((row) => row.record_id));
  for (const dedup of dedups) {
    if (!startingIds.has(dedup.canonical_record_id)) {
      startingRows.push({ ...dedup.canonicalExpected });
      startingIds.add(dedup.canonical_record_id);
    }
    startingRows.push({ ...dedup.duplicateExpected });
  }
  for (const action of additionalDedups) {
    if (!startingIds.has(action.record_id)) {
      startingRows.push({ ...action.expected });
      startingIds.add(action.record_id);
    }
  }
  startingRows.push({
    record_id: 'host-unchanged',
    insect_id: 'species-test',
    plant_name: '対照植物',
    plant_family: '対照科',
    observation_type: '文献',
    plant_part: '',
    life_stage: '幼虫',
    reference: '対照文献',
    notes: '変更しない',
  });
  if (unexpectedForeignScope) {
    startingRows.find((row) => row.record_id === 'hostplant-901287').observation_type = '不明';
  }
  const csv = Papa.unparse(startingRows, { columns: HOST_COLUMNS, newline: '\r\n' });
  for (const [index, collection] of COLLECTIONS.entries()) {
    fs.mkdirSync(path.join(root, collection));
    fs.writeFileSync(
      path.join(root, collection, 'hostplants.csv'),
      `${index === 0 ? '\ufeff' : ''}${csv}${index === 0 ? '\r\n' : ''}`,
    );
  }
  return root;
}

const runFixture = (root, args = []) => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: ROOT,
  env: {
    ...process.env,
    GA_TSUSHIN_DATA_ROOT: root,
    GA_TSUSHIN_AUDIT_PATH: AUDIT,
    GA_TSUSHIN_DEDUP_AUDIT_PATH: DEDUP_AUDIT,
    GA_TSUSHIN_CLEANUP_AUDIT_PATH: CLEANUP_AUDIT,
    GA_TSUSHIN_ADDITIONAL_DEDUP_AUDIT_PATH: ADDITIONAL_DEDUP_AUDIT,
  },
  encoding: 'utf8',
});

test('ga-tsushin host audit applies candidate decisions and merges six duplicate pairs byte-idempotently', () => {
  const root = createFixture();
  try {
    const first = runFixture(root);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.match(first.stdout, /added=1 patched_fields=22 deleted=9/);

    const audits = readAudits();
    const dedups = readDedups();
    const cleanups = readCleanups();
    const additionalDedups = readAdditionalDedups();
    const laterApproved = new Map([
      ...cleanups.map((row) => [row.record_id, row.approved]),
      ...dedups.map((row) => [row.canonical_record_id, row.canonicalApproved]),
      ...additionalDedups
        .filter((row) => row.action === 'patch')
        .map((row) => [row.record_id, row.approved]),
    ]);
    for (const collection of COLLECTIONS) {
      const rows = new Map(parseCsv(path.join(root, collection, 'hostplants.csv')).map((row) => [row.record_id, row]));
      assert.equal(rows.get('host-unchanged').notes, '変更しない');
      for (const audit of audits.filter((row) => row.apply_action !== 'none')) {
        if (audit.apply_action === 'delete') {
          assert.equal(rows.has(audit.target_record_id), false);
          continue;
        }
        const row = rows.get(audit.target_record_id);
        assert.ok(row, `${collection}: missing ${audit.target_record_id}`);
        const approved = laterApproved.get(audit.target_record_id) ?? audit.approved;
        for (const [field, value] of Object.entries(approved)) assert.equal(row[field], value);
      }
      for (const dedup of dedups) {
        assert.equal(rows.has(dedup.duplicate_record_id), false);
        const row = rows.get(dedup.canonical_record_id);
        assert.ok(row, `${collection}: missing canonical ${dedup.canonical_record_id}`);
        for (const [field, value] of Object.entries(dedup.canonicalApproved)) assert.equal(row[field], value);
      }
      for (const cleanup of cleanups) {
        const row = rows.get(cleanup.record_id);
        assert.ok(row, `${collection}: missing cleaned ${cleanup.record_id}`);
        for (const [field, value] of Object.entries(cleanup.approved)) assert.equal(row[field], value);
      }
      for (const action of additionalDedups) {
        if (action.action === 'delete') {
          assert.equal(rows.has(action.record_id), false, `${collection}: retained ${action.record_id}`);
          continue;
        }
        const row = rows.get(action.record_id);
        assert.ok(row, `${collection}: missing additional canonical ${action.record_id}`);
        for (const [field, value] of Object.entries(action.approved)) assert.equal(row[field], value);
      }
    }
    const firstHashes = hashes(root);

    const second = runFixture(root);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /added=0 patched_fields=0 deleted=0/);
    assert.deepEqual(hashes(root), firstHashes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ga-tsushin host audit check mode validates hypothetical changes without writing', () => {
  const root = createFixture();
  try {
    const before = hashes(root);
    const result = runFixture(root, ['--check']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /added=1 patched_fields=22 deleted=9 check-only/);
    assert.deepEqual(hashes(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('ga-tsushin host audit fails closed on unexpected target data without partial writes', () => {
  const root = createFixture({ unexpectedForeignScope: true });
  try {
    const before = hashes(root);
    const result = runFixture(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unexpected normalized_data\.observation_type/);
    assert.deepEqual(hashes(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('versioned ga-tsushin ledger covers all nine candidates and final public datasets match approved actions', () => {
  const audits = readAudits();
  const dedups = readDedups();
  const cleanups = readCleanups();
  const additionalDedups = readAdditionalDedups();
  const laterApproved = new Map([
    ...cleanups.map((row) => [row.record_id, row.approved]),
    ...dedups.map((row) => [row.canonical_record_id, row.canonicalApproved]),
    ...additionalDedups
      .filter((row) => row.action === 'patch')
      .map((row) => [row.record_id, row.approved]),
  ]);
  assert.equal(audits.length, 9);
  assert.deepEqual(
    new Set(audits.map((row) => row.candidate_line)),
    new Set(['881', '887', '888', '889', '890', '891', '895', '896', '898']),
  );
  assert.equal(audits.filter((row) => row.decision_status === 'accept').length, 3);
  assert.equal(audits.filter((row) => row.decision_status.startsWith('reject')).length, 5);
  assert.equal(audits.filter((row) => row.decision_status === 'retain_corrected').length, 1);
  assert.ok(audits.every((row) => /^[a-f0-9]{64}$/.test(row.pdf_sha256)));
  assert.ok(audits.every((row) => row.evidence_status.startsWith('original_pdf_visual_confirmed')));
  assert.equal(dedups.length, 3);
  assert.ok(dedups.every((row) => /^[a-f0-9]{64}$/.test(row.pdf_sha256)));
  assert.equal(cleanups.length, 2);
  assert.ok(cleanups.every((row) => /^[a-f0-9]{64}$/.test(row.pdf_sha256)));
  assert.ok(cleanups.every((row) => !/。|原報掲載名|PDF|未確認|国内記録ではない/.test(row.approved.notes)));
  assert.equal(additionalDedups.length, 8);
  assert.equal(additionalDedups.filter((row) => row.action === 'patch').length, 3);
  assert.equal(additionalDedups.filter((row) => row.action === 'delete').length, 5);
  assert.ok(additionalDedups.every((row) => /^[a-f0-9]{64}$/.test(row.pdf_sha256)));

  for (const collection of COLLECTIONS) {
    const allRows = parseCsv(path.join(ROOT, collection, 'hostplants.csv'));
    const rows = new Map(allRows.map((row) => [row.record_id, row]));
    for (const audit of audits.filter((row) => row.apply_action !== 'none')) {
      if (audit.apply_action === 'delete') {
        assert.equal(rows.has(audit.target_record_id), false, `${collection}: retained rejected pupa-only row`);
        continue;
      }
      const row = rows.get(audit.target_record_id);
      assert.ok(row, `${collection}: missing ${audit.target_record_id}`);
      const approved = laterApproved.get(audit.target_record_id) ?? audit.approved;
      for (const [field, value] of Object.entries(approved)) assert.equal(row[field], value);
    }
    for (const dedup of dedups) {
      assert.equal(rows.has(dedup.duplicate_record_id), false, `${collection}: duplicate row remains`);
      const row = rows.get(dedup.canonical_record_id);
      assert.ok(row, `${collection}: missing canonical ${dedup.canonical_record_id}`);
      for (const [field, value] of Object.entries(dedup.canonicalApproved)) assert.equal(row[field], value);
      assert.equal(
        allRows.filter((item) => item.insect_id === dedup.insect_id && item.plant_name === dedup.plant_name).length,
        1,
        `${collection}: duplicate insect-plant pair remains for ${dedup.insect_id}/${dedup.plant_name}`,
      );
    }
    for (const cleanup of cleanups) {
      const row = rows.get(cleanup.record_id);
      assert.ok(row, `${collection}: missing cleaned ${cleanup.record_id}`);
      for (const [field, value] of Object.entries(cleanup.approved)) assert.equal(row[field], value);
      assert.doesNotMatch(row.notes, /。|原報掲載名|PDF|未確認|国内記録ではない/);
    }
    for (const action of additionalDedups) {
      if (action.action === 'delete') {
        assert.equal(rows.has(action.record_id), false, `${collection}: retained ${action.record_id}`);
        continue;
      }
      const row = rows.get(action.record_id);
      assert.ok(row, `${collection}: missing additional canonical ${action.record_id}`);
      for (const [field, value] of Object.entries(action.approved)) assert.equal(row[field], value);
      assert.equal(
        allRows.filter((item) => item.insect_id === action.insect_id && item.plant_name === action.plant_name).length,
        1,
        `${collection}: additional duplicate remains for ${action.insect_id}/${action.plant_name}`,
      );
    }
  }
});
