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
const SCRIPT = path.join(ROOT, 'scripts', 'apply-aphid-p0-integrity.mjs');
const AUDIT = path.join(ROOT, 'data', 'source_audits', 'japanese-aphid-p0-integrity-2026-07-12.csv');
const COLLECTIONS = ['normalized_data', 'public'];
const TARGET_PATHS = COLLECTIONS.flatMap((collection) => [
  `${collection}/insects.csv`,
  `${collection}/hostplants.csv`,
]);
const AUDIT_COLUMNS = [
  'audit_id', 'entity', 'record_id', 'insect_id', 'source_account', 'source_taxon',
  'source_taxon_rank', 'subspecies_scope', 'action', 'expected_json', 'approved_json',
  'source_reference', 'source_pdf_status', 'ocr_sha256', 'ocr_page', 'printed_page',
  'taxonomy_source', 'taxonomy_otu_id', 'false_merge_commit', 'approved_parent_commit',
  'decision', 'reviewed_on', 'review_note',
];
const INSECT_HEADER = 'insect_id,family,family_jp,subfamily,subfamily_jp,tribe,tribe_jp,genus,subgenus,species,subspecies,author,year,japanese_name,old_japanese_name,alternative_name,other_names,scientific_name,synonyms,changes_since_standard,notes\r\n';
const HOST_HEADER = 'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\n';
const FIXED_AUDIT = {
  source_reference: '日本原色アブラムシ図鑑',
  source_pdf_status: 'not_available_ocr_candidate_only_no_new_fact',
  ocr_sha256: '0302ac1f9ad483a9240b0e25e8a97d0cfc6313b0dc4a25ca726109769acc2482',
  ocr_page: '1',
  printed_page: '1',
  taxonomy_source: 'https://aphid.speciesfile.org/otus/1/overview',
  taxonomy_otu_id: '1',
  reviewed_on: '2026-07-12',
  review_note: 'fixture',
  source_taxon_rank: 'species',
  subspecies_scope: 'species_level_unqualified',
};

const parseCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8'), { header: true, skipEmptyLines: true });
  assert.equal(parsed.errors.length, 0, `${filePath}: ${parsed.errors[0]?.message || ''}`);
  return parsed.data;
};

const hashes = (root) => Object.fromEntries(TARGET_PATHS.map((relativePath) => [
  relativePath,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex'),
]));

const fixtureAudits = () => [
  {
    ...FIXED_AUDIT,
    audit_id: 'fixture-insect',
    entity: 'insect',
    record_id: 'species-test',
    insect_id: 'species-test',
    source_account: '1',
    source_taxon: 'Correctus correctus',
    action: 'patch',
    expected_json: JSON.stringify({ genus: 'Wrongus', scientific_name: 'Wrongus wrongus' }),
    approved_json: JSON.stringify({ genus: 'Correctus', scientific_name: 'Correctus correctus' }),
    false_merge_commit: '1456d7e1676f345d83d0b4b72b2511b8a7039292',
    approved_parent_commit: '3dad4169f38ae55e3490aa8db8e8ea295d709ae5',
    decision: 'restore_false_merge_identity',
  },
  {
    ...FIXED_AUDIT,
    audit_id: 'fixture-host-patch',
    entity: 'hostplant',
    record_id: 'host-keep',
    insect_id: 'species-correct',
    source_account: '2',
    source_taxon: 'Correctus correctus',
    action: 'patch',
    expected_json: JSON.stringify({
      record_id: 'host-keep', insect_id: 'species-correct', plant_name: '植物A',
      plant_family: '科A', observation_type: '文献', plant_part: '', life_stage: '幼虫',
      reference: '日本原色アブラムシ図鑑', notes: '既存情報',
    }),
    approved_json: JSON.stringify({
      record_id: 'host-keep', insect_id: 'species-correct', plant_name: '植物A',
      plant_family: '科A', observation_type: '文献', plant_part: '葉裏', life_stage: '',
      reference: '日本原色アブラムシ図鑑', notes: '既存情報',
    }),
    false_merge_commit: '',
    approved_parent_commit: '',
    decision: 'retain_reinterpreted_account_update_metadata',
  },
  {
    ...FIXED_AUDIT,
    audit_id: 'fixture-host-delete',
    entity: 'hostplant',
    record_id: 'host-delete',
    insect_id: 'species-wrong',
    source_account: '2',
    source_taxon: 'Correctus correctus',
    action: 'delete',
    expected_json: JSON.stringify({
      record_id: 'host-delete', insect_id: 'species-wrong', plant_name: '植物A',
      plant_family: '科A', observation_type: '文献', plant_part: '葉裏', life_stage: '',
      reference: '日本原色アブラムシ図鑑', notes: '誤配属',
    }),
    approved_json: '{}',
    false_merge_commit: '',
    approved_parent_commit: '',
    decision: 'remove_wrong_account_mapping',
  },
];

function createFixture({ unexpectedGenus = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'aphid-p0-'));
  for (const collection of COLLECTIONS) {
    fs.mkdirSync(path.join(root, collection));
    fs.writeFileSync(
      path.join(root, collection, 'insects.csv'),
      `\ufeff${INSECT_HEADER}species-test,Aphididae,アブラムシ科,Aphidinae,アブラムシ亜科,Macrosiphini,,${unexpectedGenus ? 'Unexpectedus' : 'Wrongus'},,wrongus,,,,,,,,Wrongus wrongus,,,\r\n`,
    );
    fs.writeFileSync(
      path.join(root, collection, 'hostplants.csv'),
      `${HOST_HEADER}host-keep,species-correct,植物A,科A,文献,,幼虫,日本原色アブラムシ図鑑,既存情報\r\nhost-delete,species-wrong,植物A,科A,文献,葉裏,,日本原色アブラムシ図鑑,誤配属\r\n`,
    );
  }
  const auditPath = path.join(root, 'audit.csv');
  fs.writeFileSync(auditPath, `${Papa.unparse(fixtureAudits(), { columns: AUDIT_COLUMNS, newline: '\n' })}\n`);
  return { root, auditPath };
}

const runFixture = ({ root, auditPath }) => spawnSync(process.execPath, [SCRIPT], {
  cwd: ROOT,
  env: { ...process.env, APHID_P0_DATA_ROOT: root, APHID_P0_AUDIT_PATH: auditPath },
  encoding: 'utf8',
});

test('aphid P0 apply patches and deletes safely, then becomes byte-idempotent', () => {
  const fixture = createFixture();
  try {
    const first = runFixture(fixture);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.match(first.stdout, /insect_fields=2/);
    assert.match(first.stdout, /host_fields=2 deleted=1/);
    const firstHashes = hashes(fixture.root);

    for (const collection of COLLECTIONS) {
      const insects = parseCsv(path.join(fixture.root, collection, 'insects.csv'));
      const hosts = parseCsv(path.join(fixture.root, collection, 'hostplants.csv'));
      assert.equal(insects[0].genus, 'Correctus');
      assert.equal(insects[0].scientific_name, 'Correctus correctus');
      assert.equal(hosts.length, 1);
      assert.equal(hosts[0].plant_part, '葉裏');
      assert.equal(hosts[0].life_stage, '');
    }

    const second = runFixture(fixture);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /insect_fields=0/);
    assert.match(second.stdout, /host_fields=0 deleted=0/);
    assert.deepEqual(hashes(fixture.root), firstHashes);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('aphid P0 apply fails closed on an unexpected audited value without writing any target', () => {
  const fixture = createFixture({ unexpectedGenus: true });
  try {
    const before = hashes(fixture.root);
    const result = runFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unexpected normalized_data\.genus/);
    assert.deepEqual(hashes(fixture.root), before);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test('versioned aphid ledger is narrowly scoped and applied to normalized and public data', () => {
  const audits = parseCsv(AUDIT);
  assert.equal(audits.length, 20);
  assert.equal(audits.filter((row) => row.decision === 'restore_false_merge_identity').length, 11);
  assert.equal(audits.filter((row) => row.action === 'delete').length, 6);
  assert.ok(audits.every((row) => row.source_taxon_rank === 'species'));
  assert.ok(audits.every((row) => row.subspecies_scope === 'species_level_unqualified'));
  assert.ok(audits.every((row) => row.action !== 'add'));

  for (const collection of COLLECTIONS) {
    const insects = new Map(parseCsv(path.join(ROOT, collection, 'insects.csv')).map((row) => [row.insect_id, row]));
    const hosts = new Map(parseCsv(path.join(ROOT, collection, 'hostplants.csv')).map((row) => [row.record_id, row]));
    for (const audit of audits) {
      const approved = JSON.parse(audit.approved_json);
      if (audit.action === 'delete') {
        assert.equal(hosts.has(audit.record_id), false, `${collection}: ${audit.record_id}`);
        continue;
      }
      const row = audit.entity === 'insect' ? insects.get(audit.record_id) : hosts.get(audit.record_id);
      assert.ok(row, `${collection}: ${audit.record_id}`);
      for (const [field, value] of Object.entries(approved)) {
        assert.equal(row[field], value, `${collection}: ${audit.record_id}.${field}`);
      }
    }

    for (const recordId of ['hostplant-902219', 'hostplant-902220', 'hostplant-902221']) {
      assert.equal(hosts.get(recordId)?.insect_id, 'species-21150');
    }
    assert.equal(insects.get('species-21364')?.subspecies, '');
    for (const withheldId of ['species-21218', 'species-21342']) {
      assert.equal(insects.has(withheldId), false, `${collection}: withheld ${withheldId}`);
      assert.equal([...hosts.values()].some((row) => row.insect_id === withheldId), false);
    }
  }
});
