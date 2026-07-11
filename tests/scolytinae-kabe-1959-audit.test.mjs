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
const SCRIPT = path.join(ROOT, 'scripts', 'apply-scolytinae-kabe-1959-audit.mjs');
const AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'scolytinae-kabe-1959-host-zero-audit-2026-07-12.json',
);
const TARGET_PATHS = [
  'normalized_data/hostplants.csv',
  'public/hostplants.csv',
  'normalized_data/general_notes.csv',
  'public/general_notes.csv',
];
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const SOURCE_REFERENCE = '加辺正明 (1959) 日本産キクイムシ類食痕図説';

const readAudit = () => JSON.parse(fs.readFileSync(AUDIT_PATH, 'utf8'));

const parseCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8'), { header: true, skipEmptyLines: true });
  assert.equal(parsed.errors.length, 0, `${filePath}: ${parsed.errors[0]?.message || ''}`);
  return parsed.data;
};

const hashes = (root) => Object.fromEntries(TARGET_PATHS.map((relativePath) => [
  relativePath,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relativePath))).digest('hex'),
]));

const expectedHostId = (accountNo, index) => (
  `hostplant-SCOLYT-KABE-1959-${String(accountNo).padStart(3, '0')}-${String(index + 1).padStart(2, '0')}`
);
const expectedNoteId = (accountNo) => `note-SCOLYT-KABE-1959-${String(accountNo).padStart(3, '0')}`;

function writeFixtureCsv(filePath, rows, columns, { bom = false, trailingNewline = true } = {}) {
  const csv = Papa.unparse(rows, { columns, newline: '\r\n' });
  fs.writeFileSync(filePath, `${bom ? '\ufeff' : ''}${csv}${trailingNewline ? '\r\n' : ''}`, 'utf8');
}

function createFixture({ unexpectedHost = false, ambiguousBinomial = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scolyt-kabe-1959-'));
  fs.mkdirSync(path.join(root, 'normalized_data'));
  fs.mkdirSync(path.join(root, 'public'));
  fs.copyFileSync(
    path.join(ROOT, 'normalized_data', 'insects.csv'),
    path.join(root, 'normalized_data', 'insects.csv'),
  );
  if (ambiguousBinomial) {
    const insectsPath = path.join(root, 'normalized_data', 'insects.csv');
    const parsed = Papa.parse(fs.readFileSync(insectsPath, 'utf8'), { header: true, skipEmptyLines: true });
    const original = parsed.data.find((row) => row.insect_id === 'species-SC210');
    parsed.data.push({ ...original, insect_id: 'species-SC-DUPLICATE' });
    writeFixtureCsv(insectsPath, parsed.data, parsed.meta.fields, { bom: true });
  }

  const hostRows = [{
    record_id: 'host-control',
    insect_id: 'species-control',
    plant_name: '対照植物',
    plant_family: '対照科',
    observation_type: '文献',
    plant_part: '',
    life_stage: '',
    reference: '対照文献',
    notes: '変更しない',
  }];
  if (unexpectedHost) {
    hostRows.push({
      record_id: 'host-unexpected-target',
      insect_id: 'species-SC210',
      plant_name: '想定外植物',
      plant_family: '想定外科',
      observation_type: '文献',
      plant_part: '',
      life_stage: '',
      reference: '別文献',
      notes: '',
    });
  }
  const noteRows = [{
    record_id: 'note-control',
    insect_id: 'species-control',
    note_type: '生態情報',
    content: '変更しない',
    reference: '対照文献',
    page: '',
    year: '',
  }];
  for (const [index, collection] of ['normalized_data', 'public'].entries()) {
    writeFixtureCsv(path.join(root, collection, 'hostplants.csv'), hostRows, HOST_COLUMNS, {
      bom: index === 0,
      trailingNewline: index === 0,
    });
    writeFixtureCsv(path.join(root, collection, 'general_notes.csv'), noteRows, NOTE_COLUMNS, {
      bom: index === 0,
      trailingNewline: index === 0,
    });
  }
  return root;
}

const runFixture = (root, args = []) => spawnSync(process.execPath, [SCRIPT, ...args], {
  cwd: ROOT,
  env: {
    ...process.env,
    SCOLYT_KABE_DATA_ROOT: root,
    SCOLYT_KABE_AUDIT_PATH: AUDIT_PATH,
    SCOLYT_KABE_INSECTS_PATH: path.join(root, 'normalized_data', 'insects.csv'),
  },
  encoding: 'utf8',
});

function assertApprovedData(root) {
  const audit = readAudit();
  const targetIds = new Set(audit.accounts.map((account) => account.insect_id));
  for (const collection of ['normalized_data', 'public']) {
    const hostRows = parseCsv(path.join(root, collection, 'hostplants.csv'));
    const targetHosts = hostRows.filter((row) => targetIds.has(row.insect_id));
    assert.equal(targetHosts.length, 52);
    const hostsById = new Map(targetHosts.map((row) => [row.record_id, row]));
    for (const account of audit.accounts) {
      const accountRows = targetHosts.filter((row) => row.insect_id === account.insect_id);
      assert.equal(accountRows.length, account.accepted_hosts.length, `account ${account.account_no}`);
      account.accepted_hosts.forEach((host, index) => {
        const row = hostsById.get(expectedHostId(account.account_no, index));
        assert.ok(row, `${collection}: missing account ${account.account_no} host ${index + 1}`);
        assert.equal(row.insect_id, account.insect_id);
        assert.equal(row.plant_name, host.plant_name);
        assert.equal(row.plant_family, host.plant_family);
        assert.equal(row.observation_type, '野外（国内）');
        assert.equal(row.plant_part, '');
        assert.equal(row.life_stage, '');
        assert.equal(row.reference, SOURCE_REFERENCE);
        assert.equal(row.notes, '');
      });
      for (const excluded of account.excluded_parenthetical_hosts) {
        assert.equal(
          accountRows.some((row) => row.plant_name === excluded),
          false,
          `${collection}: parenthetical host leaked for account ${account.account_no}: ${excluded}`,
        );
      }
    }

    const noteRows = parseCsv(path.join(root, collection, 'general_notes.csv'));
    const sourceNotes = noteRows.filter((row) => row.record_id.startsWith('note-SCOLYT-KABE-1959-'));
    assert.equal(sourceNotes.length, 25);
    const notesById = new Map(sourceNotes.map((row) => [row.record_id, row]));
    for (const account of audit.accounts.filter((item) => item.ecology_note)) {
      const row = notesById.get(expectedNoteId(account.account_no));
      assert.ok(row, `${collection}: missing ecology note for account ${account.account_no}`);
      assert.equal(row.insect_id, account.insect_id);
      assert.equal(row.note_type, '生態情報');
      assert.equal(row.content, account.ecology_note);
      assert.doesNotMatch(row.content, /PDF|監査|ページ|頁/);
      assert.equal(row.reference, SOURCE_REFERENCE);
      assert.equal(row.page, '');
      assert.equal(row.year, '1959');
    }
  }
}

test('Scolytinae Kabe ledger covers 50 exact-binomial accounts and separates direct from parenthetical hosts', () => {
  const audit = readAudit();
  assert.equal(audit.accounts.length, 50);
  assert.equal(new Set(audit.accounts.map((account) => account.account_no)).size, 50);
  assert.equal(new Set(audit.accounts.map((account) => account.insect_id)).size, 50);
  assert.equal(audit.accounts.filter((account) => account.accepted_hosts.length > 0).length, 28);
  assert.equal(audit.accounts.filter((account) => account.accepted_hosts.length === 0).length, 22);
  assert.equal(audit.accounts.flatMap((account) => account.accepted_hosts).length, 52);
  assert.equal(audit.accounts.filter((account) => account.ecology_note).length, 25);
  assert.ok(audit.accounts.every((account) => account.source_binomial === account.current_binomial));
  assert.ok(audit.accounts.every((account) => account.evidence_status === 'original_pdf_visual_confirmed'));
  assert.equal(audit.source.sha256, '1964fac26604728349a195d5b6f02e329499eec6da1d8b8484442c864a332c22');
  assert.equal(audit.source.method_page, 12);
});

test('Scolytinae Kabe apply adds 52 direct hosts and 25 objective notes byte-idempotently', () => {
  const root = createFixture();
  try {
    const first = runFixture(root);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    assert.match(first.stdout, /normalized_data\/hosts: 1->53 added=52/);
    assert.match(first.stdout, /public\/hosts: 1->53 added=52/);
    assert.match(first.stdout, /normalized_data\/notes: 1->26 added=25/);
    assert.match(first.stdout, /public\/notes: 1->26 added=25/);
    assertApprovedData(root);
    const firstHashes = hashes(root);

    const second = runFixture(root);
    assert.equal(second.status, 0, second.stderr || second.stdout);
    assert.match(second.stdout, /normalized_data\/hosts: 53->53 added=0/);
    assert.match(second.stdout, /public\/notes: 26->26 added=0/);
    assert.deepEqual(hashes(root), firstHashes);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Scolytinae Kabe check mode validates additions without writing', () => {
  const root = createFixture();
  try {
    const before = hashes(root);
    const result = runFixture(root, ['--check']);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /normalized_data\/hosts: 1->53 added=52 check-only/);
    assert.match(result.stdout, /public\/notes: 1->26 added=25 check-only/);
    assert.deepEqual(hashes(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Scolytinae Kabe apply fails closed if a target insect gains an unapproved host', () => {
  const root = createFixture({ unexpectedHost: true });
  try {
    const before = hashes(root);
    const result = runFixture(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /required host=0 baseline/);
    assert.deepEqual(hashes(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('Scolytinae Kabe apply fails closed if a current binomial is no longer unique', () => {
  const root = createFixture({ ambiguousBinomial: true });
  try {
    const before = hashes(root);
    const result = runFixture(root);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /binomial mapping is no longer exact and unique/);
    assert.deepEqual(hashes(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('live normalized and public data match all approved Scolytinae Kabe actions', () => {
  assertApprovedData(ROOT);
});
