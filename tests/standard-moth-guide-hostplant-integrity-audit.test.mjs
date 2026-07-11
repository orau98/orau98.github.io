import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-standard-moth-guide-hostplant-integrity-audit.mjs');
const AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-standard-moth-guides-hostplant-integrity-2026-07-12.json',
);
const HOSTPLANTS_PATH = path.join(ROOT, 'normalized_data', 'hostplants.csv');
const INSECTS_PATH = path.join(ROOT, 'normalized_data', 'insects.csv');
const NOTES_PATH = path.join(ROOT, 'normalized_data', 'general_notes.csv');
const auditRaw = fs.readFileSync(AUDIT_PATH, 'utf8');
const audit = JSON.parse(auditRaw);

const parseCsv = filePath => Papa.parse(
  fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
  { header: true, skipEmptyLines: true },
).data;
const writeCsv = (filePath, rows, columns, bom = false) => fs.writeFileSync(
  filePath,
  `${bom ? '\ufeff' : ''}${Papa.unparse(rows, { columns, newline: '\r\n' })}\r\n`,
);
const runApply = (fixture, args = []) => spawnSync(
  process.execPath,
  [APPLY_SCRIPT, ...args],
  {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      SMG_HOST_AUDIT_HOSTPLANTS_PATH: fixture.hostplantsPath,
      SMG_HOST_AUDIT_INSECTS_PATH: fixture.insectsPath,
      SMG_HOST_AUDIT_NOTES_PATH: fixture.notesPath,
    },
  },
);

const makeBeforeFixture = () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'smg-host-audit-'));
  const hostplantsPath = path.join(directory, 'hostplants.csv');
  const insectsPath = path.join(directory, 'insects.csv');
  const notesPath = path.join(directory, 'general_notes.csv');
  let hostplants = parseCsv(HOSTPLANTS_PATH);
  let insects = parseCsv(INSECTS_PATH);
  let notes = parseCsv(NOTES_PATH);

  const hostById = new Map(hostplants.map(row => [row.record_id, row]));
  for (const action of audit.actions) {
    if (action.action === 'delete_hostplant') {
      if (!hostById.has(action.record_id)) {
        hostplants.push({ ...action.before });
        hostById.set(action.record_id, hostplants.at(-1));
      } else {
        Object.assign(hostById.get(action.record_id), action.before);
      }
    } else if (action.action === 'update_hostplant') {
      const row = hostById.get(action.record_id);
      if (!row) {
        hostplants.push({ ...action.before });
        hostById.set(action.record_id, hostplants.at(-1));
      } else {
        Object.assign(row, action.before);
      }
    } else {
      hostplants = hostplants.filter(row => row.record_id !== action.record_id);
      hostById.delete(action.record_id);
    }
  }

  for (const identity of audit.identity_actions) {
    insects = insects.filter(row => ![
      identity.canonical_insect_id,
      identity.duplicate_insect_id,
    ].includes(row.insect_id));
    insects.push({ ...identity.canonical_before }, { ...identity.duplicate_before });
    for (const recordId of identity.migrate_hostplant_record_ids) {
      const row = hostplants.find(candidate => candidate.record_id === recordId);
      assert.ok(row, recordId);
      row.insect_id = identity.duplicate_insect_id;
    }
    for (const recordId of identity.migrate_general_note_record_ids) {
      const row = notes.find(candidate => candidate.record_id === recordId);
      assert.ok(row, recordId);
      row.insect_id = identity.duplicate_insect_id;
    }
  }

  writeCsv(hostplantsPath, hostplants, Object.keys(hostplants[0]));
  writeCsv(insectsPath, insects, Object.keys(insects[0]), true);
  writeCsv(notesPath, notes, Object.keys(notes[0]), true);
  return { directory, hostplantsPath, insectsPath, notesPath };
};

test('production ledger covers every exact-reference guide row and pins source identity', () => {
  assert.equal(audit.audit_version, 'japanese-standard-moth-guides-hostplant-integrity-v1-2026-07-12');
  assert.equal(audit.scan_scope.exact_reference_rows_before, 7471);
  assert.deepEqual(audit.scan_scope.exact_reference_rows_before_by_reference, {
    日本産蛾類標準図鑑1: 2449,
    日本産蛾類標準図鑑2: 2449,
    日本産蛾類標準図鑑3: 2128,
    日本産蛾類標準図鑑4: 445,
  });
  assert.equal(audit.coverage_rows.length, 7471);
  assert.equal(new Set(audit.coverage_rows.map(row => row.record_id)).size, 7471);
  assert.equal(audit.actions.length, Object.values(audit.scan_scope.action_counts).reduce((a, b) => a + b, 0));
  assert.deepEqual(audit.scan_scope.action_counts, {
    add_hostplant: 21,
    delete_hostplant: 197,
    update_hostplant: 60,
  });
  assert.deepEqual(audit.scan_scope.exact_reference_rows_after_expected_by_reference, {
    日本産蛾類標準図鑑1: 2425,
    日本産蛾類標準図鑑2: 2449,
    日本産蛾類標準図鑑3: 1976,
    日本産蛾類標準図鑑4: 445,
  });
  assert.equal(audit.source_pdfs['日本産蛾類標準図鑑3'][0].sha256, '205b3090c799655004bae148d6931e90a2abb968c85c376b2680ce105ed37850');
  assert.equal(audit.source_pdfs['日本産蛾類標準図鑑4'][0].outside_covered_pages, 'source_not_recovered_hold_no_claim');
  assert.match(audit.scan_scope.guide4_scope, /outside that range remains source-not-recovered hold/);
  assert.ok(audit.actions.every(row => row.pdf_page && (row.printed_page || row.printed_page_range)));
  assert.ok(audit.actions.every(row => row.evidence.includes('原PDF画像')));
  assert.equal(
    new Set(audit.actions.map(row => row.audit_id)).size,
    audit.actions.length,
  );
  assert.equal(
    crypto.createHash('sha256').update(auditRaw).digest('hex'),
    '627bc2a7d2c939fffc60fb442b6e0f8e4e8c0b63d09aa522f698fd082d2ab6f9',
  );
});

test('--check validates the complete hypothetical result without writing', () => {
  const fixture = makeBeforeFixture();
  const before = [
    fs.readFileSync(fixture.hostplantsPath),
    fs.readFileSync(fixture.insectsPath),
    fs.readFileSync(fixture.notesPath),
  ];
  const result = runApply(fixture, ['--check']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const summary = JSON.parse(result.stdout);
  assert.equal(summary.would_change, true);
  assert.equal(summary.hostplant_rows_changed, audit.actions.length + 8);
  assert.equal(summary.insect_rows_changed, 2);
  assert.equal(summary.general_note_rows_changed, 1);
  assert.deepEqual(fs.readFileSync(fixture.hostplantsPath), before[0]);
  assert.deepEqual(fs.readFileSync(fixture.insectsPath), before[1]);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), before[2]);
});

test('apply performs exact host repair and duplicate taxon migration idempotently', () => {
  const fixture = makeBeforeFixture();
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const hostplants = parseCsv(fixture.hostplantsPath);
  const insects = parseCsv(fixture.insectsPath);
  const notes = parseCsv(fixture.notesPath);

  for (const action of audit.actions.filter(row => row.action === 'delete_hostplant')) {
    assert.equal(hostplants.some(row => row.record_id === action.record_id), false, action.record_id);
  }
  for (const action of audit.actions.filter(row => row.action !== 'delete_hostplant')) {
    const row = hostplants.find(candidate => candidate.record_id === action.record_id);
    assert.ok(row, action.record_id);
    for (const [key, value] of Object.entries(action.after)) {
      assert.equal(row[key], value, `${action.record_id}/${key}`);
    }
  }
  assert.equal(hostplants.find(row => row.record_id === 'hostplant-912797').plant_family, 'ヤシ科');
  assert.equal(hostplants.find(row => row.record_id === 'hostplant-908126').plant_name, 'カラコギカエデ');
  assert.equal(hostplants.find(row => row.record_id === 'hostplant-902107').plant_name, 'クヌギ');
  assert.equal(hostplants.find(row => row.record_id === 'hostplant-902108').plant_name, 'カキノキ');
  assert.equal(
    audit.actions.some(row => ['hostplant-908126', 'hostplant-902107', 'hostplant-902108'].includes(row.record_id)),
    false,
  );
  assert.equal(insects.some(row => row.insect_id === 'species-21576'), false);
  assert.equal(insects.find(row => row.insect_id === 'species-3743').japanese_name, 'ミヤマツバメエダシャク');
  assert.equal(hostplants.filter(row => row.insect_id === 'species-21576').length, 0);
  assert.equal(notes.filter(row => row.insect_id === 'species-21576').length, 0);
  assert.equal(
    hostplants.filter(row => audit.identity_actions[0].migrate_hostplant_record_ids.includes(row.record_id))
      .every(row => row.insect_id === 'species-3743'),
    true,
  );

  const bytesAfterFirst = [
    fs.readFileSync(fixture.hostplantsPath),
    fs.readFileSync(fixture.insectsPath),
    fs.readFileSync(fixture.notesPath),
  ];
  const second = runApply(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.equal(JSON.parse(second.stdout).would_change, false);
  assert.deepEqual(fs.readFileSync(fixture.hostplantsPath), bytesAfterFirst[0]);
  assert.deepEqual(fs.readFileSync(fixture.insectsPath), bytesAfterFirst[1]);
  assert.deepEqual(fs.readFileSync(fixture.notesPath), bytesAfterFirst[2]);
});

test('apply fails closed when a reviewed before-row drifts', () => {
  const fixture = makeBeforeFixture();
  const rows = parseCsv(fixture.hostplantsPath);
  const target = audit.actions.find(row => row.action === 'delete_hostplant');
  rows.find(row => row.record_id === target.record_id).plant_name = '意図しない変更';
  writeCsv(fixture.hostplantsPath, rows, Object.keys(rows[0]));
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /precondition mismatch/);
});
