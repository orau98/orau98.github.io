import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const resolvePath = (name, fallback) => process.env[name]
  ? path.resolve(process.env[name])
  : path.join(ROOT, fallback);

const NOTES_PATH = resolvePath('JMSG1_SUBSCOPE_NOTES_PATH', 'normalized_data/general_notes.csv');
const HOSTS_PATH = resolvePath('JMSG1_SUBSCOPE_HOSTS_PATH', 'normalized_data/hostplants.csv');
const INSECTS_PATH = resolvePath('JMSG1_SUBSCOPE_INSECTS_PATH', 'normalized_data/insects.csv');
const AUDIT_PATH = resolvePath(
  'JMSG1_SUBSCOPE_AUDIT_PATH',
  'data/source_audits/japanese-moths-standard-guide-1-subspecies-scope-2026-07-12.json',
);
const PDF_PATH = process.env.JMSG1_SUBSCOPE_PDF_PATH
  ? path.resolve(process.env.JMSG1_SUBSCOPE_PDF_PATH)
  : null;
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-moths-standard-guide-1-subspecies-scope-2026-07-12.json',
);
const EXPECTED_LEDGER_SHA256 = '9614dca8947d485d4ce2139db429af81123040610037cafe44a6268ad2ec040c';
const EXPECTED_PDF_SHA256 = '35e3a46b1c91a6f16a6aff7522be708ed8a94ccfc8dc39d23c3d3e9171cfd0d9';
const EXPECTED_ACTIONS = new Map([
  ['update_note', 1],
  ['add_note', 2],
  ['add_host', 3],
]);
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter((argument) => argument !== '--check');
if (unknownArguments.length > 0) throw new Error(`Unknown arguments: ${unknownArguments.join(', ')}`);

const sha256File = (filePath) => {
  const hash = crypto.createHash('sha256');
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
};

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
const audit = JSON.parse(rawAudit);
if (audit.audit_version !== '2026-07-12' || audit.reference !== '日本産蛾類標準図鑑1') {
  throw new Error('Unexpected audit identity');
}
if (audit.reviewed_on !== '2026-07-12') throw new Error('Unexpected reviewed_on');
if (
  audit.source_pdf?.filename !== '日本産蛾類標準図鑑1 2.pdf'
  || audit.source_pdf?.sha256 !== EXPECTED_PDF_SHA256
  || audit.source_pdf?.page_count !== 115
) {
  throw new Error('Unexpected source PDF identity');
}
if (!Array.isArray(audit.taxon_reviews) || audit.taxon_reviews.length !== 2) {
  throw new Error('Expected two taxon scope reviews');
}
const expectedTargets = new Map([
  ['jmsg1-subscope-001', 'species-21572'],
  ['jmsg1-subscope-002', 'species-21573'],
]);
for (const review of audit.taxon_reviews) {
  if (review.source_scope !== 'subspecies_explicit_via_geography') {
    throw new Error(`Unexpected source_scope for ${review.review_id}`);
  }
  if (
    !expectedTargets.has(review.review_id)
    || review.apply_targets?.length !== 1
    || review.apply_targets[0].insect_id !== expectedTargets.get(review.review_id)
    || !Array.isArray(review.excluded_targets)
    || review.excluded_targets.length === 0
    || !review.source_scope_evidence
  ) {
    throw new Error(`Incomplete source-scope decision for ${review.review_id}`);
  }
}
if (!Array.isArray(audit.actions) || audit.actions.length !== 6) {
  throw new Error('Expected six subspecies-scope actions');
}
const actionIds = new Set();
const recordIds = new Set();
const counts = new Map();
for (const action of audit.actions) {
  if (!action.action_id || actionIds.has(action.action_id)) {
    throw new Error(`Invalid or duplicate action_id: ${action.action_id}`);
  }
  actionIds.add(action.action_id);
  if (!action.record_id || recordIds.has(action.record_id)) {
    throw new Error(`Invalid or duplicate action record_id: ${action.record_id}`);
  }
  recordIds.add(action.record_id);
  if (!EXPECTED_ACTIONS.has(action.action)) throw new Error(`Unexpected action: ${action.action}`);
  if (action.reference !== audit.reference || action.source_scope !== 'subspecies_explicit_via_geography') {
    throw new Error(`Unexpected source identity for ${action.action_id}`);
  }
  if (!action.decision) throw new Error(`Missing decision for ${action.action_id}`);
  if (action.action.endsWith('note')) {
    if (!action.note_type || !action.approved_content || !action.approved_page) {
      throw new Error(`Incomplete note action for ${action.action_id}`);
    }
    const issues = collectGeneralNoteIssues({
      note_type: action.note_type,
      content: action.approved_content,
      page: action.approved_page,
    });
    if (issues.length) throw new Error(`Approved note fails quality rules: ${action.action_id}: ${issues}`);
  } else if (
    !action.source_record_id
    || !action.plant_name
    || !action.plant_family
    || action.expected_absent !== true
  ) {
    throw new Error(`Incomplete host action for ${action.action_id}`);
  }
  counts.set(action.action, (counts.get(action.action) || 0) + 1);
}
for (const [action, expected] of EXPECTED_ACTIONS) {
  if (audit.scope?.expected_actions?.[action] !== expected || (counts.get(action) || 0) !== expected) {
    throw new Error(`Expected ${expected} ${action} actions`);
  }
}

const enforceProduction = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.JMSG1_SUBSCOPE_ENFORCE_PRODUCTION === '1';
if (enforceProduction) {
  const hash = crypto.createHash('sha256').update(rawAudit).digest('hex');
  if (hash !== EXPECTED_LEDGER_SHA256) throw new Error(`Production audit SHA-256 mismatch: ${hash}`);
}
if (PDF_PATH && sha256File(PDF_PATH) !== EXPECTED_PDF_SHA256) {
  throw new Error(`Source PDF SHA-256 mismatch: ${sha256File(PDF_PATH)}`);
}

const parseSimpleCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length) throw new Error(`${path.basename(filePath)}: ${parsed.errors[0].message}`);
  return parsed.data;
};

const insects = new Map(parseSimpleCsv(INSECTS_PATH).map((row) => [row.insect_id, row]));
const expectedTaxa = new Map([
  ['species-20461', ['Eumelea biflavata Warren, 1896', 'オビベニホソシャク']],
  ['species-21572', ['Eumelea biflavata insulata', 'オレベニホシシャク']],
  ['species-4252', ['Xenortholitha propinguata (Kollar, 1844)', 'フタクロテンナミシャク']],
  ['species-21573', ['Xenortholitha propinguata niphonica', 'フタクチトガリナミシャク']],
]);
for (const [insectId, [scientificName, japaneseName]] of expectedTaxa) {
  const row = insects.get(insectId);
  if (row?.scientific_name !== scientificName || row?.japanese_name !== japaneseName) {
    throw new Error(`Target taxon identity mismatch: ${insectId}`);
  }
}

const parsePreservingCsv = (filePath) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const records = splitCsvRecordsWithDelimiters(hasBom ? source.slice(1) : source);
  if (!records.length) throw new Error(`${path.basename(filePath)} is empty`);
  const headerParse = Papa.parse(records[0].record);
  if (headerParse.errors.length) throw new Error(`${path.basename(filePath)}: invalid header`);
  const header = headerParse.data[0];
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  const rows = records.slice(1).filter(({ record }) => record).map((record) => {
    const parsed = Papa.parse(record.record);
    if (parsed.errors.length || parsed.data.length !== 1) {
      throw new Error(`${path.basename(filePath)} contains a malformed row`);
    }
    return { record, values: parsed.data[0], changed: false };
  });
  return { source, hasBom, records, header, indexes, rows };
};

const renderCsv = (table, addedValues) => {
  const output = [table.records[0]];
  for (const row of table.rows) {
    output.push(row.changed
      ? { record: Papa.unparse([row.values], { newline: '' }), delimiter: row.record.delimiter }
      : row.record);
  }
  const delimiterCounts = new Map();
  for (const { delimiter } of output) {
    if (delimiter) delimiterCounts.set(delimiter, (delimiterCounts.get(delimiter) || 0) + 1);
  }
  const dominantDelimiter = [...delimiterCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || '\n';
  for (const record of output) {
    if (record.delimiter) record.delimiter = dominantDelimiter;
  }
  if (addedValues.length) {
    const last = output.at(-1);
    if (!last.delimiter) last.delimiter = dominantDelimiter;
    for (const values of addedValues) {
      output.push({ record: Papa.unparse([values], { newline: '' }), delimiter: dominantDelimiter });
    }
  }
  return `${table.hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
};

const notes = parsePreservingCsv(NOTES_PATH);
const hosts = parsePreservingCsv(HOSTS_PATH);
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']) {
  if (notes.indexes[column] === undefined) throw new Error(`general_notes.csv missing ${column}`);
}
for (const column of [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
]) {
  if (hosts.indexes[column] === undefined) throw new Error(`hostplants.csv missing ${column}`);
}
const notesById = new Map(notes.rows.map((row) => [row.values[notes.indexes.record_id], row]));
const hostsById = new Map(hosts.rows.map((row) => [row.values[hosts.indexes.record_id], row]));
if (notesById.size !== notes.rows.length || hostsById.size !== hosts.rows.length) {
  throw new Error('Duplicate record_id in a target CSV');
}

const addedNotes = [];
const addedHosts = [];
let pendingNoteUpdates = 0;
let pendingNoteAdds = 0;
let pendingHostAdds = 0;

for (const action of audit.actions) {
  if (action.action === 'update_note') {
    const row = notesById.get(action.record_id);
    if (!row) throw new Error(`Required note missing: ${action.record_id}`);
    const current = Object.fromEntries(notes.header.map((name, index) => [name, row.values[index] || '']));
    if (
      current.insect_id !== action.insect_id
      || current.note_type !== action.note_type
      || current.reference !== action.reference
    ) {
      throw new Error(`Note identity mismatch: ${action.record_id}`);
    }
    if (current.content === action.approved_content && current.page === action.approved_page) continue;
    if (current.content !== action.expected_content || current.page !== action.expected_page) {
      throw new Error(`Unexpected note state: ${action.record_id}`);
    }
    row.values[notes.indexes.content] = action.approved_content;
    row.values[notes.indexes.page] = action.approved_page;
    row.changed = true;
    pendingNoteUpdates += 1;
    continue;
  }
  if (action.action === 'add_note') {
    const existing = notesById.get(action.record_id);
    const approved = {
      record_id: action.record_id,
      insect_id: action.insect_id,
      note_type: action.note_type,
      content: action.approved_content,
      reference: action.reference,
      page: action.approved_page,
      year: '',
    };
    if (existing) {
      const current = Object.fromEntries(notes.header.map((name, index) => [name, existing.values[index] || '']));
      if (notes.header.some((name) => current[name] !== (approved[name] ?? ''))) {
        throw new Error(`Existing added note is not exact: ${action.record_id}`);
      }
      continue;
    }
    const duplicate = notes.rows.some((row) => (
      row.values[notes.indexes.insect_id] === action.insect_id
      && row.values[notes.indexes.note_type] === action.note_type
      && row.values[notes.indexes.content] === action.approved_content
      && row.values[notes.indexes.reference] === action.reference
    ));
    if (duplicate) throw new Error(`Semantic duplicate note already exists for ${action.action_id}`);
    addedNotes.push(notes.header.map((name) => approved[name] ?? ''));
    pendingNoteAdds += 1;
    continue;
  }

  const sourceRow = hostsById.get(action.source_record_id);
  if (!sourceRow) throw new Error(`Source host row missing: ${action.source_record_id}`);
  const source = Object.fromEntries(hosts.header.map((name, index) => [name, sourceRow.values[index] || '']));
  for (const field of ['plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes']) {
    if (source[field] !== action[field]) throw new Error(`Source host mismatch: ${action.action_id}: ${field}`);
  }
  if (source.insect_id !== 'species-20461') throw new Error(`Unexpected source host taxon: ${action.action_id}`);
  const approved = Object.fromEntries(hosts.header.map((name) => [name, action[name] ?? '']));
  const existing = hostsById.get(action.record_id);
  if (existing) {
    const current = Object.fromEntries(hosts.header.map((name, index) => [name, existing.values[index] || '']));
    if (hosts.header.some((name) => current[name] !== approved[name])) {
      throw new Error(`Existing added host is not exact: ${action.record_id}`);
    }
    continue;
  }
  const duplicate = hosts.rows.some((row) => (
    row.values[hosts.indexes.insect_id] === action.insect_id
    && row.values[hosts.indexes.plant_name] === action.plant_name
    && row.values[hosts.indexes.reference] === action.reference
  ));
  if (duplicate) throw new Error(`Semantic duplicate host already exists for ${action.action_id}`);
  addedHosts.push(hosts.header.map((name) => approved[name]));
  pendingHostAdds += 1;
}

const noteResult = renderCsv(notes, addedNotes);
const hostResult = renderCsv(hosts, addedHosts);
for (const [label, result] of [['general_notes.csv', noteResult], ['hostplants.csv', hostResult]]) {
  const parsed = Papa.parse(result.replace(/^\ufeff/, ''), { header: true, skipEmptyLines: true });
  if (parsed.errors.length) throw new Error(`Transformed ${label}: ${parsed.errors[0].message}`);
}

const changes = [
  { filePath: NOTES_PATH, source: notes.source, result: noteResult },
  { filePath: HOSTS_PATH, source: hosts.source, result: hostResult },
].filter(({ source, result }) => source !== result);

if (!CHECK_ONLY && changes.length) {
  const staged = [];
  try {
    for (const change of changes) {
      const temporaryPath = `${change.filePath}.tmp-${process.pid}-${crypto.randomUUID()}`;
      fs.writeFileSync(temporaryPath, change.result, {
        encoding: 'utf8',
        mode: fs.statSync(change.filePath).mode,
        flag: 'wx',
      });
      staged.push({ ...change, temporaryPath });
    }
    const committed = [];
    try {
      for (const change of staged) {
        fs.renameSync(change.temporaryPath, change.filePath);
        committed.push(change);
      }
    } catch (error) {
      for (const change of committed.reverse()) {
        const rollbackPath = `${change.filePath}.rollback-${process.pid}-${crypto.randomUUID()}`;
        fs.writeFileSync(rollbackPath, change.source, { encoding: 'utf8', flag: 'wx' });
        fs.renameSync(rollbackPath, change.filePath);
      }
      throw error;
    }
  } finally {
    for (const { temporaryPath } of staged) {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    }
  }
}

console.log(JSON.stringify({
  taxon_groups_reviewed: audit.taxon_reviews.length,
  pending_note_updates: pendingNoteUpdates,
  pending_note_adds: pendingNoteAdds,
  pending_host_adds: pendingHostAdds,
  check_only: CHECK_ONLY,
  changed_files: CHECK_ONLY ? 0 : changes.length,
  source_pdf_verified: Boolean(PDF_PATH),
}, null, 2));
