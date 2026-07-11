import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import Papa from 'papaparse';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'apply-tamamushi-species-level-sharing.mjs');
const AUDIT = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-jewel-beetles-species-level-sharing-2026-07-12.csv',
);
const PDF_SHA256 = 'ea5ecd8600fbe103e344097b19010d020c69dcedbf7d1328e4a0bb3c06cd9a45';

function readCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  assert.equal(parsed.errors.length, 0, JSON.stringify(parsed.errors));
  return parsed.data;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'tamamushi-sharing-test-'));
  fs.mkdirSync(path.join(root, 'normalized_data'), { recursive: true });
  for (const fileName of ['insects.csv', 'hostplants.csv', 'general_notes.csv']) {
    fs.copyFileSync(
      path.join(ROOT, 'normalized_data', fileName),
      path.join(root, 'normalized_data', fileName),
    );
  }
  return root;
}

function runApply(dataRoot, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    env: { ...process.env, TAMAMUSHI_SHARING_DATA_ROOT: dataRoot, ...extraEnv },
    encoding: 'utf8',
  });
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('ledger records eight original-PDF verified species-level sharing actions', () => {
  const rows = readCsv(AUDIT);
  assert.equal(rows.length, 8);
  assert.equal(rows.filter((row) => row.entity === 'hostplant').length, 4);
  assert.equal(rows.filter((row) => row.entity === 'general_note').length, 4);
  assert.equal(new Set(rows.map((row) => row.action_id)).size, 8);
  assert.equal(new Set(rows.map((row) => row.record_id)).size, 8);
  for (const row of rows) {
    assert.equal(row.source_scope, 'species-level shared');
    assert.equal(row.canonical_reference, '日本産タマムシ大図鑑');
    assert.equal(row.pdf_file, '日本産タマムシ大図鑑.pdf');
    assert.equal(row.source_pdf_sha256, PDF_SHA256);
    assert.equal(row.reviewed_on, '2026-07-12');
    assert.ok(row.pdf_page && row.printed_page && row.evidence_note);
  }
});

test('species-level records are shared only to the two audited current subspecies', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const hosts = readCsv(path.join(fixture, 'normalized_data', 'hostplants.csv'));
  const notes = readCsv(path.join(fixture, 'normalized_data', 'general_notes.csv'));
  assert.deepEqual(
    hosts
      .filter((row) => row.record_id.startsWith('host-tamamushi-scope-'))
      .map((row) => `${row.insect_id}:${row.plant_name}`)
      .sort(),
    [
      'species-21789:アメリカナシ',
      'species-21789:ナナカマド',
      'species-21800:エノキ',
      'species-21800:ケヤキ',
    ],
  );
  assert.deepEqual(
    notes
      .filter((row) => [
        'note-tamamushi-21789-emergence-9b082dbd939a',
        'note-tamamushi-21789-ecology-c6dee7737cbd',
        'note-tamamushi-21800-emergence-0ed60cf45e55',
        'note-tamamushi-21800-ecology-5caf53061bd8',
      ].includes(row.record_id))
      .map((row) => `${row.insect_id}:${row.note_type}:${row.page}`)
      .sort(),
    [
      'species-21789:出現時期:149',
      'species-21789:生態情報:149',
      'species-21800:出現時期:149-150',
      'species-21800:生態情報:149-150',
    ],
  );
});

test('apply is byte-idempotent and check mode confirms completion', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const targets = ['hostplants.csv', 'general_notes.csv']
    .map((fileName) => path.join(fixture, 'normalized_data', fileName));
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstHashes = targets.map(sha256);
  const second = runApply(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(targets.map(sha256), firstHashes);
  const check = runApply(fixture, ['--check']);
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test('taxon drift fails before either data file is written', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const insectsPath = path.join(fixture, 'normalized_data', 'insects.csv');
  const insects = fs.readFileSync(insectsPath, 'utf8').replace(
    'Agrilus viduus subviduus Y. Kurosawa, 1957',
    'Agrilus viduus changed',
  );
  fs.writeFileSync(insectsPath, insects, 'utf8');
  const targets = ['hostplants.csv', 'general_notes.csv']
    .map((fileName) => path.join(fixture, 'normalized_data', fileName));
  const before = targets.map(sha256);
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /scientific name drift/);
  assert.deepEqual(targets.map(sha256), before);
});

test('optional PDF verification rejects a different file', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const fakePdf = path.join(fixture, 'wrong.pdf');
  fs.writeFileSync(fakePdf, 'not the reviewed PDF', 'utf8');
  const result = runApply(fixture, [], { TAMAMUSHI_SHARING_SOURCE_PDF: fakePdf });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF SHA-256 mismatch/);
});
