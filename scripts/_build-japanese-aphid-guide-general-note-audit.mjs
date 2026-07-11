#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const SOURCE = '日本原色アブラムシ図鑑';
const REVIEWED_ON = '2026-07-12';

function resolveCoverageInput(envName, fileName) {
  if (process.env[envName]) return path.resolve(process.env[envName]);
  const candidates = [
    path.join(ROOT, 'data/ocr/japanese-aphid-guide', fileName),
    path.join('/private/tmp', fileName),
    path.join(os.tmpdir(), fileName),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (existing) return existing;
  throw new Error(`${fileName} not found; set ${envName}`);
}

const FIRST_HALF = resolveCoverageInput(
  'APHID_GUIDE_FIRST_HALF',
  'aphid-accounts-001-120-audit.csv',
);
const SECOND_HALF = resolveCoverageInput(
  'APHID_GUIDE_SECOND_HALF',
  'aphid-accounts-121-240-audit.csv',
);
const COVERAGE_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-aphid-guide-all-accounts-2026-07-12.csv',
);
const AUDIT_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-aphid-guide-general-note-integrity-2026-07-12.json',
);
const NOTES_PATH = path.join(ROOT, 'normalized_data/general_notes.csv');
const HOSTS_PATH = path.join(ROOT, 'normalized_data/hostplants.csv');
const INSECTS_PATH = path.join(ROOT, 'normalized_data/insects.csv');

const COVERAGE_COLUMNS = [
  'account_number', 'pdf_page', 'printed_page', 'side', 'source_japanese_name',
  'source_scientific_name', 'current_insect_ids', 'source_scope',
  'application_targets', 'excluded_targets', 'scope_reason', 'objective_ecology',
  'parasitism_fact', 'existing_note_ids', 'decision', 'evidence_note',
];
const NOTE_COLUMNS = ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'];
const HOST_COLUMNS = [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
];

const readCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
};
const normalizeIds = (value) => (value || '')
  .split(/[;|]/)
  .map(item => item.trim())
  .filter(Boolean)
  .join('|');
const splitIds = (value) => normalizeIds(value).split('|').filter(Boolean);
const normalizeText = (value) => (value || '').normalize('NFC').trim();
const canonicalRows = (rows, columns) => rows
  .map(row => Object.fromEntries(columns.map(column => [column, row[column] || ''])))
  .sort((left, right) => left.record_id.localeCompare(right.record_id));
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const rowMap = (rows, idColumn) => new Map(rows.map(row => [row[idColumn], row]));

const firstHalf = readCsv(FIRST_HALF);
const secondHalf = readCsv(SECOND_HALF);
const coverage = [...firstHalf, ...secondHalf]
  .map(raw => Object.fromEntries(COVERAGE_COLUMNS.map(column => [column, normalizeText(raw[column])])))
  .map(row => ({
    ...row,
    current_insect_ids: normalizeIds(row.current_insect_ids),
    application_targets: normalizeIds(row.application_targets),
    excluded_targets: normalizeIds(row.excluded_targets),
    existing_note_ids: normalizeIds(row.existing_note_ids),
  }))
  .sort((left, right) => Number(left.account_number) - Number(right.account_number));

if (coverage.length !== 240) throw new Error(`Expected 240 source accounts; found ${coverage.length}`);
for (let index = 0; index < coverage.length; index += 1) {
  const row = coverage[index];
  const account = index + 1;
  if (Number(row.account_number) !== account) throw new Error(`Missing source account ${account}`);
  const expectedPrintedPage = 224 + account + (account >= 161 ? 1 : 0) + (account >= 170 ? 1 : 0);
  if (Number(row.printed_page) !== expectedPrintedPage) {
    throw new Error(`Unexpected printed page for source account ${account}`);
  }
  const expectedPdfPage = account <= 160
    ? Math.floor((account + 2) / 2)
    : account <= 169
      ? Math.floor((account + 3) / 2)
      : Math.floor((account + 4) / 2);
  if (Number(row.pdf_page) !== expectedPdfPage) {
    throw new Error(`Unexpected PDF page for source account ${account}`);
  }
  const expectedSide = account >= 161 && account <= 169
    ? (account % 2 === 0 ? 'right' : 'left')
    : (account % 2 === 0 ? 'left' : 'right');
  if (row.side !== expectedSide) {
    throw new Error(`Unexpected page side for source account ${account}`);
  }
  if (!row.source_scientific_name || !row.source_scope || !row.scope_reason || !row.decision) {
    throw new Error(`Incomplete audit identity for source account ${account}`);
  }
  if (!row.evidence_note.includes('目視確認')) {
    throw new Error(`Source account ${account} is missing original-image review evidence`);
  }
  const targets = splitIds(row.application_targets);
  if (targets.length === 0 && !row.decision.includes('hold')) {
    throw new Error(`Source account ${account} has no target but is not held`);
  }
  if (targets.length > 0 && row.decision.includes('hold')) {
    throw new Error(`Held source account ${account} unexpectedly has an application target`);
  }
}

const notes = readCsv(NOTES_PATH);
const hosts = readCsv(HOSTS_PATH);
const insects = readCsv(INSECTS_PATH);
const insectsById = rowMap(insects, 'insect_id');
const sourceNotes = canonicalRows(notes.filter(row => row.reference === SOURCE), NOTE_COLUMNS);
const sourceNotesByInsect = new Map();
for (const note of sourceNotes) {
  const values = sourceNotesByInsect.get(note.insect_id) || [];
  values.push(note.record_id);
  sourceNotesByInsect.set(note.insect_id, values);
}
for (const row of coverage) {
  if (row.existing_note_ids) continue;
  const ids = new Set([
    ...splitIds(row.current_insect_ids),
    ...splitIds(row.application_targets),
    ...splitIds(row.excluded_targets),
  ]);
  row.existing_note_ids = [...ids]
    .flatMap(insectId => sourceNotesByInsect.get(insectId) || [])
    .sort()
    .join('|');
}

const coverageText = `${Papa.unparse(coverage, {
  columns: COVERAGE_COLUMNS,
  newline: '\n',
  header: true,
})}\n`;
fs.writeFileSync(COVERAGE_PATH, coverageText, 'utf8');

const desiredNotes = [];
for (const row of coverage) {
  const account = Number(row.account_number);
  const targets = splitIds(row.application_targets);
  if (targets.length === 0) continue;
  let content = row.objective_ecology || row.parasitism_fact;
  if (account > 120 && row.objective_ecology && row.parasitism_fact) {
    content = `${row.objective_ecology} ${row.parasitism_fact}`;
  }
  content = content.trim();
  if (!content) throw new Error(`Source account ${account} has no approved ecology content`);
  for (const target of targets) {
    const insect = insectsById.get(target);
    if (!insect || insect.family !== 'Aphididae') {
      throw new Error(`Source account ${account} has invalid Aphididae target ${target}`);
    }
    desiredNotes.push({
      record_id: `note-aphid-guide-a${String(account).padStart(3, '0')}-${target}-ecology`,
      insect_id: target,
      note_type: '生態情報',
      content,
      reference: SOURCE,
      page: row.printed_page,
      year: '',
    });
  }
}
const desiredNoteIds = new Set(desiredNotes.map(row => row.record_id));
if (desiredNoteIds.size !== desiredNotes.length) throw new Error('Duplicate approved general-note IDs');
const unrelatedNoteIds = new Set(notes.filter(row => row.reference !== SOURCE).map(row => row.record_id));
for (const id of desiredNoteIds) {
  if (unrelatedNoteIds.has(id)) throw new Error(`Approved note ID collides with an unrelated row: ${id}`);
}

const hostsById = rowMap(hosts, 'record_id');
const hostActions = [];
const actionIds = new Set();
const addHostAction = (auditId, action, recordId, expected, approved, account, decision) => {
  if (actionIds.has(auditId)) throw new Error(`Duplicate host audit ID: ${auditId}`);
  actionIds.add(auditId);
  hostActions.push({
    audit_id: auditId,
    action,
    record_id: recordId,
    source_account: account,
    expected,
    approved,
    decision,
  });
};
const expectHost = (recordId) => {
  const row = hostsById.get(recordId);
  if (!row) throw new Error(`Missing expected host row ${recordId}`);
  return Object.fromEntries(HOST_COLUMNS.map(column => [column, row[column] || '']));
};
const patchHost = (auditId, recordId, account, changes, decision) => {
  const expected = expectHost(recordId);
  addHostAction(auditId, 'patch_host', recordId, expected, { ...expected, ...changes }, account, decision);
};
const deleteHost = (auditId, recordId, account, decision) => {
  addHostAction(auditId, 'delete_host', recordId, expectHost(recordId), null, account, decision);
};
const addHost = (auditId, recordId, account, sourceRecordId, insectId, changes = {}) => {
  const source = expectHost(sourceRecordId);
  const approved = { ...source, record_id: recordId, insect_id: insectId, ...changes };
  addHostAction(
    auditId,
    'add_host',
    recordId,
    null,
    approved,
    account,
    'share_or_move_original_account_host_record',
  );
};

patchHost(
  'aphid-guide-a043-host-original-wording',
  'hostplant-902258',
  43,
  { plant_part: '茎（特に穂茎）', notes: 'コロニーは大きい' },
  'restore_original_parasitism_wording',
);
for (const [recordId, plantPart, notesText, family] of [
  ['hostplant-902412', '葉裏', '点在し、コロニーは小さい', 'タデ科'],
  ['hostplant-902413', '葉裏', '点在し、コロニーは小さい', 'タデ科'],
  ['hostplant-902414', '葉裏', '点在し、コロニーは小さい', 'タデ科'],
  ['hostplant-902415', '新芽・新葉', '秋に移住して卵態越冬し、翌春に大繁殖する', 'グミ科'],
]) {
  patchHost(
    `aphid-guide-a113-host-${recordId}`,
    recordId,
    113,
    { plant_part: plantPart, notes: notesText, plant_family: family },
    'restore_original_host_specific_parasitism_fields',
  );
}
for (const [index, sourceRecordId] of [
  'hostplant-902412', 'hostplant-902413', 'hostplant-902414', 'hostplant-902415',
].entries()) {
  const approvedSource = hostActions.find(action => action.record_id === sourceRecordId)?.approved;
  const recordId = `hostplant-aphid-guide-a113-species-21350-${String(index + 1).padStart(2, '0')}`;
  addHostAction(
    `aphid-guide-a113-share-${index + 1}`,
    'add_host',
    recordId,
    null,
    { ...approvedSource, record_id: recordId, insect_id: 'species-21350' },
    113,
    'share_unqualified_species_account_to_parent_and_current_subspecies',
  );
}

deleteHost('aphid-guide-a120-delete-wrong-genus-host', 'hostplant-902433', 120, 'remove_epithet_only_false_match');
for (const recordId of ['hostplant-902449', 'hostplant-902450']) {
  deleteHost(`aphid-guide-a130-hold-${recordId}`, recordId, 130, 'remove_epithet_only_false_match_and_hold');
}
deleteHost('aphid-guide-a147-hold-host', 'hostplant-902487', 147, 'remove_wrong_species_host_and_hold');
deleteHost('aphid-guide-a180-hold-host', 'hostplant-902581', 180, 'remove_wrong_genus_host_and_hold');
deleteHost('aphid-guide-a223-hold-host', 'hostplant-902686', 223, 'remove_qualified_identification_host_and_hold');
for (const recordId of ['hostplant-902695', 'hostplant-902696', 'hostplant-902697']) {
  deleteHost(`aphid-guide-a226-hold-${recordId}`, recordId, 226, 'withhold_explicit_unrepresented_subspecies');
}
for (const recordId of ['hostplant-902720', 'hostplant-902721', 'hostplant-902722', 'hostplant-902723']) {
  deleteHost(`aphid-guide-a237-hold-${recordId}`, recordId, 237, 'remove_rows_from_unresolved_account');
}
deleteHost('aphid-guide-a240-hold-host', 'hostplant-902730', 240, 'remove_row_from_unresolved_account');

for (const target of ['species-21225', 'species-21226']) {
  addHost(
    `aphid-guide-a161-share-${target}`,
    `hostplant-aphid-guide-a161-${target}-01`,
    161,
    'hostplant-902538',
    target,
  );
}
deleteHost('aphid-guide-a161-delete-parent-host', 'hostplant-902538', 161, 'replace_parent_duplicate_with_subspecies_shares');
for (const target of ['species-21229', 'species-21230']) {
  for (const [index, sourceRecordId] of [
    'hostplant-902540', 'hostplant-902541', 'hostplant-902542', 'hostplant-902543', 'hostplant-902544',
  ].entries()) {
    addHost(
      `aphid-guide-a163-share-${target}-${index + 1}`,
      `hostplant-aphid-guide-a163-${target}-${String(index + 1).padStart(2, '0')}`,
      163,
      sourceRecordId,
      target,
    );
  }
}
for (const recordId of ['hostplant-902540', 'hostplant-902541', 'hostplant-902542', 'hostplant-902543', 'hostplant-902544']) {
  deleteHost(`aphid-guide-a163-delete-parent-${recordId}`, recordId, 163, 'replace_parent_duplicate_with_subspecies_shares');
}
patchHost(
  'aphid-guide-a165-move-host',
  'hostplant-902549',
  165,
  { insect_id: 'species-21238' },
  'move_japanese_population_host_to_current_subspecies',
);
patchHost(
  'aphid-guide-a172-move-host',
  'hostplant-902569',
  172,
  { insect_id: 'species-21251' },
  'move_host_from_temporary_duplicate_to_accepted_taxon',
);
patchHost(
  'aphid-guide-a202-move-host',
  'hostplant-902638',
  202,
  { insect_id: 'species-21213' },
  'move_japanese_population_host_to_current_subspecies',
);
deleteHost('aphid-guide-a215-delete-duplicate-host', 'hostplant-902671', 215, 'remove_temporary_duplicate_host');
for (const recordId of ['hostplant-902727', 'hostplant-902728', 'hostplant-902729']) {
  patchHost(
    `aphid-guide-a239-move-${recordId}`,
    recordId,
    239,
    { insect_id: 'species-23152' },
    'move_next_account_hosts_from_temporary_duplicate',
  );
}

const insectExpected = insectsById.get('species-21350');
if (!insectExpected) throw new Error('Missing species-21350');
const insectActions = [{
  audit_id: 'aphid-guide-a113-parent-japanese-name',
  action: 'patch_insect',
  record_id: 'species-21350',
  source_account: 113,
  expected: Object.fromEntries(Object.keys(insectExpected).map(key => [key, insectExpected[key] || ''])),
  approved: {
    ...Object.fromEntries(Object.keys(insectExpected).map(key => [key, insectExpected[key] || ''])),
    japanese_name: 'タデクギケアブラムシ',
  },
  decision: 'replace_parser_fragment_with_original_account_japanese_name',
}];

const audit = {
  audit_version: 'japanese-aphid-guide-all-accounts-v1-2026-07-12',
  reviewed_on: REVIEWED_ON,
  reference: SOURCE,
  method: 'OCR was used only to locate candidate text. Every account heading, objective ecology statement, parasitism statement, page boundary, and target scope was checked against the original PDF page image before acceptance.',
  source_pdf: {
    filename: 'japanese-aphid-guide-original.pdf',
    sha256: 'd50ba1738d8088d464399da7ffc18b6d5f3418c7954fe58fc9e5b8c95691a61c',
    page_count: 122,
    role: 'original_full_pdf_image_review',
  },
  candidate_ocr: {
    filename: 'ocr-boxes.jsonl',
    sha256: '17708b004357f0dd8ba722dfe14e976a895f24e36c176d7e7e25fb5144807da7',
    role: 'candidate_location_only_not_acceptance_evidence',
  },
  coverage: {
    filename: path.basename(COVERAGE_PATH),
    sha256: sha256(coverageText),
    account_count: coverage.length,
    applied_account_count: coverage.filter(row => splitIds(row.application_targets).length > 0).length,
    held_account_count: coverage.filter(row => splitIds(row.application_targets).length === 0).length,
    approved_target_note_count: desiredNotes.length,
    original_pdf_pages_reviewed: 122,
  },
  expected_profile: {
    existing_source_note_count: sourceNotes.length,
    approved_source_note_count: desiredNotes.length,
    host_action_count: hostActions.length,
    insect_action_count: insectActions.length,
  },
  existing_source_note_profile_sha256: sha256(JSON.stringify(sourceNotes)),
  existing_source_notes: sourceNotes,
  approved_source_notes: canonicalRows(desiredNotes, NOTE_COLUMNS),
  host_actions: hostActions,
  insect_actions: insectActions,
};

fs.writeFileSync(AUDIT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  coverage: path.relative(ROOT, COVERAGE_PATH),
  audit: path.relative(ROOT, AUDIT_PATH),
  ...audit.coverage,
  ...audit.expected_profile,
}, null, 2));
