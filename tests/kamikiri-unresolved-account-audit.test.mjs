import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import Papa from 'papaparse';

const ROOT = path.resolve(import.meta.dirname, '..');
const AUDIT = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-longhorn-beetles-2007-unresolved-account-actions-2026-07-11.csv',
);
const CROSSWALK = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-longhorn-beetles-2007.csv',
);
const COVERAGE = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-longhorn-beetles-2007-unresolved-account-decisions-2026-07-11.csv',
);
const SCRIPT = path.join(ROOT, 'scripts', 'apply-kamikiri-unresolved-account-audit.mjs');
const PDF_SHA256 = '52299895c14c1fd1c74279dca00f6fd9ba64d36d69e3bf3dd9c3a29a92802e77';

function readCsv(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  assert.equal(parsed.errors.length, 0, `${filePath}: ${JSON.stringify(parsed.errors)}`);
  return parsed.data;
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kamikiri-unresolved-test-'));
  for (const collection of ['normalized_data', 'public']) {
    fs.mkdirSync(path.join(root, collection), { recursive: true });
    for (const fileName of ['insects.csv', 'hostplants.csv', 'general_notes.csv']) {
      fs.copyFileSync(path.join(ROOT, collection, fileName), path.join(root, collection, fileName));
    }
  }
  return root;
}

function runApply(dataRoot, extraArgs = [], extraEnv = {}) {
  return spawnSync(process.execPath, [SCRIPT, ...extraArgs], {
    cwd: ROOT,
    env: {
      ...process.env,
      KAMIKIRI_UNRESOLVED_DATA_ROOT: dataRoot,
      ...extraEnv,
    },
    encoding: 'utf8',
  });
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

test('action ledger is complete, unique, and source-provenanced', () => {
  const rows = readCsv(AUDIT);
  assert.equal(rows.length, 79);
  assert.equal(rows.filter((row) => row.action === 'add_host').length, 42);
  assert.equal(rows.filter((row) => row.action === 'add_note').length, 37);
  assert.equal(new Set(rows.map((row) => row.action_id)).size, rows.length);
  assert.equal(new Set(rows.map((row) => row.record_id)).size, rows.length);
  for (const row of rows) {
    assert.equal(row.canonical_reference, '日本産カミキリムシ');
    assert.equal(row.pdf_file, '日本産カミキリムシ_compressed.pdf');
    assert.equal(row.source_pdf_sha256, PDF_SHA256);
    assert.equal(row.reviewed_on, '2026-07-11');
    assert.ok(row.pdf_page && row.printed_page && row.evidence_note);
  }
});

test('coverage ledger accounts for all 258 unresolved headings exactly once', () => {
  const coverage = readCsv(COVERAGE);
  const actions = readCsv(AUDIT);
  assert.equal(coverage.length, 258);
  assert.equal(new Set(coverage.map((row) => row.account_audit_id)).size, 258);
  const sourceLocations = coverage.map(
    (row) => `${row.pdf_page}\u0000${row.ocr_line_start}\u0000${row.ocr_line_end}\u0000${row.heading_raw}`,
  );
  assert.equal(new Set(sourceLocations).size, 258);
  const coverageCounts = coverage.reduce((counts, row) => {
    counts[row.coverage_class] = (counts[row.coverage_class] || 0) + 1;
    return counts;
  }, {});
  assert.deepEqual(
    coverageCounts,
    {
      boundary_or_taxonomy_hold: 4,
      duplicate_existing: 2,
      included_action: 24,
      no_actionable_host_or_ecology: 53,
      not_visually_verified: 175,
    },
  );
  assert.equal(
    coverage.filter((row) => row.review_state === 'original_pdf_visually_verified').length,
    30,
  );
  assert.equal(
    coverage
      .filter((row) => row.coverage_class === 'not_visually_verified')
      .every((row) => row.review_state === 'inventory_screened_only'),
    true,
  );
  const allowedLinks = new Set([
    ...actions.map((row) => row.action_id),
    'kamikiri-h2-009',
    'kamikiri-h3-005',
  ]);
  for (const row of coverage) {
    assert.equal(row.source_pdf_sha256, PDF_SHA256);
    assert.ok(row.pdf_page && row.ocr_line_start && row.ocr_line_end && row.review_note);
    for (const link of row.related_action_ids.split(';').filter(Boolean)) {
      assert.equal(allowedLinks.has(link), true, `${row.account_audit_id}: unknown action ${link}`);
    }
  }
  assert.equal(
    coverage.some(
      (row) =>
        row.heading_japanese === 'クロセンノキカミキリ' &&
        row.related_action_ids === 'kamikiri-h3-005' &&
        row.coverage_class === 'included_action',
    ),
    true,
  );
});

test('ambiguous or geographically overbroad mappings remain absent', () => {
  const rows = readCsv(AUDIT);
  assert.equal(rows.some((row) => row.plant_name === 'サワアジサイ'), false);
  assert.equal(rows.some((row) => row.insect_id === 'species-22319'), false);
  assert.equal(rows.some((row) => row.insect_id.startsWith('species-2184')), false);
  assert.equal(rows.some((row) => row.source_taxon.includes('Chlorophorus diadema')), false);
  assert.equal(
    rows.some(
      (row) => row.content.includes('雑種と思われる') || row.content.includes('分布を広げたと推測'),
    ),
    false,
  );
});

test('adult feeding is not silently converted to a larval host', () => {
  const rows = readCsv(AUDIT);
  const adult = rows.find(
    (row) => row.insect_id === 'species-22712' && row.plant_name === 'ナナカマド',
  );
  assert.ok(adult);
  assert.equal(adult.observation_type, '後食');
  assert.equal(adult.life_stage, '成虫');
  assert.equal(adult.plant_part, '葉');
  const larval = rows.find(
    (row) => row.insect_id === 'species-22712' && row.plant_name === 'ズミ',
  );
  assert.ok(larval);
  assert.equal(larval.life_stage, '幼虫');
});

test('crosswalk correction removes the adjacent-subspecies contamination and speculation', () => {
  const row = readCsv(CROSSWALK).find((entry) => entry.audit_id === 'kamikiri-h3-005');
  assert.ok(row);
  assert.equal(row.insect_id, 'species-22748');
  assert.equal(row.host_plants, 'ハリギリ|ウコギ科');
  assert.equal(row.ecology, '');
  assert.match(row.review_note, /境界混入/);
  assert.match(row.review_note, /推測文は公開生態情報から除外/);
});

test('apply is idempotent across normalized and public copies', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const targets = ['normalized_data/hostplants.csv', 'normalized_data/general_notes.csv', 'public/hostplants.csv', 'public/general_notes.csv'];
  const firstHashes = targets.map((relativePath) => sha256(path.join(fixture, relativePath)));
  const second = runApply(fixture);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(
    targets.map((relativePath) => sha256(path.join(fixture, relativePath))),
    firstHashes,
  );
  const check = runApply(fixture, ['--check']);
  assert.equal(check.status, 0, check.stderr || check.stdout);
  for (const collection of ['normalized_data', 'public']) {
    const hosts = readCsv(path.join(fixture, collection, 'hostplants.csv'));
    const notes = readCsv(path.join(fixture, collection, 'general_notes.csv'));
    assert.equal(hosts.filter((row) => row.record_id.startsWith('host-kamikiri-unresolved-')).length, 42);
    assert.equal(notes.filter((row) => row.record_id.startsWith('note-kamikiri-unresolved-')).length, 37);
    assert.equal(
      hosts.some(
        (row) =>
          row.insect_id === 'species-22712' && row.plant_name === 'ナナカマド' &&
          row.observation_type === '後食' && row.life_stage === '成虫',
      ),
      true,
    );
  }
});

test('apply fails closed when an approved relation exists under a second record id', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const first = runApply(fixture);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const filePath = path.join(fixture, 'normalized_data', 'hostplants.csv');
  fs.appendFileSync(
    filePath,
    'host-kamikiri-unresolved-duplicate,species-22304,シラビソ,マツ科,文献,,幼虫,日本産カミキリムシ,\r\n',
    'utf8',
  );
  const result = runApply(fixture);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /approved semantic value is not unique/);
});

test('optional original-PDF verification rejects a hash mismatch', (t) => {
  const fixture = makeFixture();
  t.after(() => fs.rmSync(fixture, { recursive: true, force: true }));
  const fakePdf = path.join(fixture, 'fake.pdf');
  fs.writeFileSync(fakePdf, 'not the source PDF', 'utf8');
  const result = runApply(fixture, [], { KAMIKIRI_UNRESOLVED_SOURCE_PDF: fakePdf });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Source PDF hash mismatch/);
});
