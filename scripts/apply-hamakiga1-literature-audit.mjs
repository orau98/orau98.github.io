import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const SOURCE = '日本のハマキガ1';
const EXPECTED_PDF_SHA256 = '78f75fd532ace774cff181d573c96c04052e1c65dd77a352ec520d7cd33de646';
const EXPECTED_ACCOUNT_VERSION = 'hamakiga1-v1-2026-07-12';
const EDITORIAL_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-1-editorial-cleanup-2026-07-12.csv',
);
const EXPECTED_EDITORIAL_AUDIT_SHA256 = 'b85e026c96061e765c6bb5fcd16b4f861cc1985801d55b5a0f9fb8ca31187ffd';

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const HOSTPLANTS_PATH = resolvePath(
  'HAMAKIGA1_AUDIT_HOSTPLANTS_PATH',
  'normalized_data/hostplants.csv',
);
const NOTES_PATH = resolvePath(
  'HAMAKIGA1_AUDIT_NOTES_PATH',
  'normalized_data/general_notes.csv',
);
const AUDIT_PATH = resolvePath(
  'HAMAKIGA1_AUDIT_PATH',
  'data/source_audits/japanese-tortricid-moths-1-integrity-2026-07-12.csv',
);
const ACCOUNTS_PATH = resolvePath(
  'HAMAKIGA1_ACCOUNTS_PATH',
  'data/source_audits/japanese-tortricid-moths-1-all-accounts-2026-07-12.csv',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-1-integrity-2026-07-12.csv',
);
const PRODUCTION_ACCOUNTS_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-1-all-accounts-2026-07-12.csv',
);
const EXPECTED_PRODUCTION_ACTION_COUNTS = new Map([
  ['delete_host_records', 2],
  ['update_host_field', 5],
  ['add_host_relation', 52],
  ['replace_note_content', 19],
  ['delete_note', 1],
  ['add_note', 1],
]);

const readCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''),
    { header: true, skipEmptyLines: true },
  );
  if (parsed.errors.length > 0) {
    throw new Error(`${path.basename(filePath)}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
};

const loadEditableCsv = (filePath, requiredColumns) => {
  const source = fs.readFileSync(filePath, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${path.basename(filePath)} is empty`);
  const header = Papa.parse(entries[0].record).data[0];
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const column of requiredColumns) {
    if (indexes[column] === undefined) {
      throw new Error(`${path.basename(filePath)} is missing ${column}`);
    }
  }
  const rows = entries.slice(1).filter(entry => entry.record).map((entry) => {
    const parsed = Papa.parse(entry.record);
    if (parsed.errors.length > 0) {
      throw new Error(`${path.basename(filePath)}: ${parsed.errors[0].message}`);
    }
    return { entry, row: parsed.data[0], changed: false, deleted: false };
  });
  return { source, hasBom, header, indexes, headerEntry: entries[0], rows };
};

const saveEditableCsv = (filePath, csv, addedRows = []) => {
  const defaultDelimiter = csv.rows.findLast(({ entry }) => entry.delimiter)?.entry.delimiter
    || csv.headerEntry.delimiter
    || '\r\n';
  const output = [csv.headerEntry];
  for (const item of csv.rows) {
    if (item.deleted) continue;
    if (item.changed) {
      output.push({
        record: Papa.unparse([item.row], { newline: '' }),
        delimiter: item.entry.delimiter,
      });
    } else {
      output.push(item.entry);
    }
  }
  for (const row of addedRows) {
    output.push({ record: Papa.unparse([row], { newline: '' }), delimiter: defaultDelimiter });
  }
  const result = `${csv.hasBom ? '\ufeff' : ''}${output
    .map(({ record, delimiter }) => `${record}${delimiter}`)
    .join('')}`;
  if (result !== csv.source) fs.writeFileSync(filePath, result, 'utf8');
  return result !== csv.source;
};

const splitIds = value => String(value || '')
  .split(';')
  .map(item => item.trim())
  .filter(Boolean);

const assertAllAccountsLedger = () => {
  const accounts = readCsv(ACCOUNTS_PATH);
  if (accounts.length !== 216) {
    throw new Error(`All-account ledger must contain 216 rows, found ${accounts.length}`);
  }
  const accountNumbers = new Set();
  const insectIds = new Set();
  for (const account of accounts) {
    if (account.audit_version !== EXPECTED_ACCOUNT_VERSION) {
      throw new Error(`Unexpected account ledger version: ${account.audit_version}`);
    }
    if (account.reference !== SOURCE || account.source_pdf_sha256 !== EXPECTED_PDF_SHA256) {
      throw new Error(`Unexpected source identity for account ${account.account_no}`);
    }
    const number = Number(account.account_no);
    if (!Number.isInteger(number) || number < 1 || number > 216 || accountNumbers.has(number)) {
      throw new Error(`Invalid or duplicate account_no: ${account.account_no}`);
    }
    if (!account.insect_id || insectIds.has(account.insect_id)) {
      throw new Error(`Invalid or duplicate account insect_id: ${account.insect_id}`);
    }
    accountNumbers.add(number);
    insectIds.add(account.insect_id);
  }
  for (let number = 1; number <= 216; number += 1) {
    if (!accountNumbers.has(number)) throw new Error(`Missing source account ${number}`);
  }
  return insectIds;
};

const auditedInsectIds = assertAllAccountsLedger();
const auditRows = readCsv(AUDIT_PATH);
const allowedActions = new Set([
  'delete_host_records',
  'update_host_field',
  'add_host_relation',
  'replace_note_content',
  'delete_note',
  'add_note',
]);
const auditIds = new Set();
for (const audit of auditRows) {
  const auditId = (audit.audit_id || '').trim();
  if (!auditId || auditIds.has(auditId)) throw new Error(`Invalid or duplicate audit_id: ${auditId}`);
  auditIds.add(auditId);
  if (!allowedActions.has((audit.action || '').trim())) {
    throw new Error(`Unsupported action for ${auditId}: ${audit.action}`);
  }
  if ((audit.reference || '').trim() !== SOURCE) {
    throw new Error(`Unexpected reference for ${auditId}`);
  }
  if ((audit.source_pdf_sha256 || '').trim() !== EXPECTED_PDF_SHA256) {
    throw new Error(`Unexpected source_pdf_sha256 for ${auditId}`);
  }
  if (!auditedInsectIds.has((audit.insect_id || '').trim())) {
    throw new Error(`Action targets an insect outside the 216-account ledger: ${auditId}`);
  }
  if (!(audit.pdf_page || '').trim() || !(audit.printed_page || '').trim()) {
    throw new Error(`Missing source page for ${auditId}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test((audit.reviewed_on || '').trim())) {
    throw new Error(`Invalid reviewed_on for ${auditId}`);
  }
}

const usingProductionLedgers = (
  path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  && path.resolve(ACCOUNTS_PATH) === path.resolve(PRODUCTION_ACCOUNTS_PATH)
);
if (usingProductionLedgers) {
  const counts = new Map();
  for (const audit of auditRows) {
    const action = audit.action.trim();
    counts.set(action, (counts.get(action) || 0) + 1);
  }
  const expectedTotal = [...EXPECTED_PRODUCTION_ACTION_COUNTS.values()]
    .reduce((sum, count) => sum + count, 0);
  if (auditRows.length !== expectedTotal) {
    throw new Error(`Production audit row count mismatch: ${auditRows.length} != ${expectedTotal}`);
  }
  for (const [action, expected] of EXPECTED_PRODUCTION_ACTION_COUNTS) {
    const actual = counts.get(action) || 0;
    if (actual !== expected) {
      throw new Error(`Production action count mismatch for ${action}: ${actual} != ${expected}`);
    }
  }
}

const editorialApprovedByBaseContent = new Map();
if (usingProductionLedgers) {
  const editorialBytes = fs.readFileSync(EDITORIAL_AUDIT_PATH);
  const editorialSha256 = crypto.createHash('sha256').update(editorialBytes).digest('hex');
  if (editorialSha256 !== EXPECTED_EDITORIAL_AUDIT_SHA256) {
    throw new Error(`Hamakiga1 editorial audit SHA-256 mismatch: ${editorialSha256}`);
  }
  for (const row of readCsv(EDITORIAL_AUDIT_PATH)) {
    const key = [row.insect_id, row.note_type, row.old_content].join('\0');
    if (!row.approved_content || editorialApprovedByBaseContent.has(key)) {
      throw new Error(`Invalid Hamakiga1 editorial supersession: ${row.audit_id}`);
    }
    editorialApprovedByBaseContent.set(key, row.approved_content);
  }
}

const hostCsv = loadEditableCsv(HOSTPLANTS_PATH, [
  'record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type',
  'plant_part', 'life_stage', 'reference', 'notes',
]);
const hi = hostCsv.indexes;
const hostById = new Map();
for (const item of hostCsv.rows) {
  const id = (item.row[hi.record_id] || '').trim();
  if (!id || hostById.has(id)) throw new Error(`Invalid or duplicate host record_id: ${id}`);
  hostById.set(id, item);
}

let hostDeleted = 0;
let hostUpdated = 0;
let hostAdded = 0;
const addedHostRows = [];

for (const audit of auditRows.filter(row => row.entity === 'hostplant')) {
  const action = audit.action.trim();
  const insectId = audit.insect_id.trim();
  if (action === 'delete_host_records') {
    const ids = splitIds(audit.record_ids);
    if (ids.length === 0) throw new Error(`No record_ids for ${audit.audit_id}`);
    const existing = ids.map(id => hostById.get(id)).filter(item => item && !item.deleted);
    if (existing.length !== 0 && existing.length !== ids.length) {
      throw new Error(`Partial delete state for ${audit.audit_id}: ${existing.length}/${ids.length}`);
    }
    if (existing.length === 0) continue;
    for (const id of ids) {
      const item = hostById.get(id);
      if ((item.row[hi.insect_id] || '').trim() !== insectId) {
        throw new Error(`insect_id mismatch for ${audit.audit_id}: ${id}`);
      }
      if ((item.row[hi.reference] || '').trim() !== SOURCE) {
        throw new Error(`reference mismatch for ${audit.audit_id}: ${id}`);
      }
      item.deleted = true;
      hostDeleted += 1;
    }
    continue;
  }

  if (action === 'update_host_field') {
    const ids = splitIds(audit.record_ids);
    if (ids.length !== 1) throw new Error(`Expected one record_id for ${audit.audit_id}`);
    const item = hostById.get(ids[0]);
    if (!item || item.deleted) throw new Error(`Required host row is missing: ${ids[0]}`);
    if ((item.row[hi.insect_id] || '').trim() !== insectId) {
      throw new Error(`insect_id mismatch for ${audit.audit_id}: ${ids[0]}`);
    }
    if ((item.row[hi.reference] || '').trim() !== SOURCE) {
      throw new Error(`reference mismatch for ${audit.audit_id}: ${ids[0]}`);
    }
    const field = audit.field.trim();
    if (hi[field] === undefined) throw new Error(`Unknown host field for ${audit.audit_id}: ${field}`);
    const current = item.row[hi[field]] || '';
    if (current === audit.approved_value) continue;
    if (current !== audit.expected_value) {
      throw new Error(`Unexpected value for ${audit.audit_id}: ${field}=${current}`);
    }
    item.row[hi[field]] = audit.approved_value || '';
    item.changed = true;
    hostUpdated += 1;
    continue;
  }

  if (action === 'add_host_relation') {
    const ids = splitIds(audit.record_ids);
    if (ids.length !== 1) throw new Error(`Expected one record_id for ${audit.audit_id}`);
    const expected = {
      record_id: ids[0], insect_id: insectId, plant_name: audit.plant_name || '',
      plant_family: audit.plant_family || '', observation_type: audit.observation_type || '',
      plant_part: audit.plant_part || '', life_stage: audit.life_stage || '',
      reference: SOURCE, notes: audit.notes || '',
    };
    const existing = hostById.get(ids[0]);
    if (existing) {
      let changed = false;
      for (const [field, value] of Object.entries(expected)) {
        const current = existing.row[hi[field]] || '';
        if (current === value) continue;
        const isControlledFieldUpdate = audit.field === field
          && current === (audit.expected_value || '')
          && value === (audit.approved_value || '');
        if (!isControlledFieldUpdate) {
          throw new Error(`Existing added row differs for ${audit.audit_id}: ${field}`);
        }
        existing.row[hi[field]] = value;
        changed = true;
      }
      if (changed) {
        existing.changed = true;
        hostUpdated += 1;
      }
      continue;
    }
    const semanticDuplicate = hostCsv.rows.find(item => !item.deleted
      && (item.row[hi.insect_id] || '') === insectId
      && (item.row[hi.plant_name] || '') === expected.plant_name
      && (item.row[hi.observation_type] || '') === expected.observation_type
      && (item.row[hi.reference] || '') === SOURCE);
    if (semanticDuplicate) {
      throw new Error(
        `Semantic duplicate blocks ${audit.audit_id}: ${semanticDuplicate.row[hi.record_id]}`,
      );
    }
    const row = hostCsv.header.map(() => '');
    for (const [field, value] of Object.entries(expected)) row[hi[field]] = value;
    addedHostRows.push(row);
    const item = { row, changed: false, deleted: false, entry: { record: '', delimiter: '' } };
    hostById.set(ids[0], item);
    hostCsv.rows.push(item);
    hostAdded += 1;
    continue;
  }

  throw new Error(`Unhandled host action: ${action}`);
}

const noteCsv = loadEditableCsv(NOTES_PATH, [
  'record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year',
]);
const ni = noteCsv.indexes;
const noteById = new Map();
for (const item of noteCsv.rows) {
  const id = (item.row[ni.record_id] || '').trim();
  if (!id || noteById.has(id)) throw new Error(`Invalid or duplicate note record_id: ${id}`);
  noteById.set(id, item);
}

let noteUpdated = 0;
let noteDeleted = 0;
let noteAdded = 0;
let noteSuperseded = 0;
const addedNoteRows = [];

for (const audit of auditRows.filter(row => row.entity === 'general_note')) {
  const action = audit.action.trim();
  const insectId = audit.insect_id.trim();
  const noteType = audit.note_type.trim();
  if (action === 'delete_note') {
    const ids = splitIds(audit.record_ids);
    if (ids.length !== 1) throw new Error(`Expected one note record_id for ${audit.audit_id}`);
    const item = noteById.get(ids[0]);
    if (!item || item.deleted) continue;
    if (
      (item.row[ni.insect_id] || '').trim() !== insectId
      || (item.row[ni.note_type] || '').trim() !== noteType
      || (item.row[ni.reference] || '').trim() !== SOURCE
    ) {
      throw new Error(`Note identity mismatch for ${audit.audit_id}: ${ids[0]}`);
    }
    if ((item.row[ni.content] || '') !== audit.match_content) {
      throw new Error(`Unexpected note delete content for ${audit.audit_id}`);
    }
    item.deleted = true;
    noteDeleted += 1;
    continue;
  }

  if (action === 'replace_note_content') {
    const oldMatches = noteCsv.rows.filter(item => !item.deleted
      && (item.row[ni.insect_id] || '') === insectId
      && (item.row[ni.note_type] || '') === noteType
      && (item.row[ni.reference] || '') === SOURCE
      && (item.row[ni.content] || '') === audit.match_content);
    const approvedMatches = noteCsv.rows.filter(item => !item.deleted
      && (item.row[ni.insect_id] || '') === insectId
      && (item.row[ni.note_type] || '') === noteType
      && (item.row[ni.reference] || '') === SOURCE
      && (item.row[ni.content] || '') === audit.approved_value);
    const editorialApproved = editorialApprovedByBaseContent.get([
      insectId,
      noteType,
      audit.approved_value,
    ].join('\0'));
    const supersedingMatches = editorialApproved ? noteCsv.rows.filter(item => !item.deleted
      && (item.row[ni.insect_id] || '') === insectId
      && (item.row[ni.note_type] || '') === noteType
      && (item.row[ni.reference] || '') === SOURCE
      && (item.row[ni.content] || '') === editorialApproved) : [];
    if (oldMatches.length === 0 && approvedMatches.length === 1) continue;
    if (oldMatches.length === 0 && approvedMatches.length === 0 && supersedingMatches.length === 1) {
      noteSuperseded += 1;
      continue;
    }
    if (
      oldMatches.length !== 1
      || approvedMatches.length !== 0
      || supersedingMatches.length !== 0
    ) {
      throw new Error(
        `Unexpected note replacement state for ${audit.audit_id}: old=${oldMatches.length}, approved=${approvedMatches.length}, superseded=${supersedingMatches.length}`,
      );
    }
    oldMatches[0].row[ni.content] = audit.approved_value;
    oldMatches[0].changed = true;
    noteUpdated += 1;
    continue;
  }

  if (action === 'add_note') {
    const ids = splitIds(audit.record_ids);
    if (ids.length !== 1) throw new Error(`Expected one note record_id for ${audit.audit_id}`);
    const expected = {
      record_id: ids[0], insect_id: insectId, note_type: noteType,
      content: audit.approved_value || '', reference: SOURCE,
      page: audit.note_page || '', year: audit.note_year || '',
    };
    const existing = noteById.get(ids[0]);
    if (existing) {
      for (const [field, value] of Object.entries(expected)) {
        if ((existing.row[ni[field]] || '') !== value) {
          throw new Error(`Existing added note differs for ${audit.audit_id}: ${field}`);
        }
      }
      continue;
    }
    const semanticDuplicate = noteCsv.rows.find(item => !item.deleted
      && (item.row[ni.insect_id] || '') === insectId
      && (item.row[ni.note_type] || '') === noteType
      && (item.row[ni.content] || '') === expected.content
      && (item.row[ni.reference] || '') === SOURCE);
    if (semanticDuplicate) {
      throw new Error(
        `Semantic note duplicate blocks ${audit.audit_id}: ${semanticDuplicate.row[ni.record_id]}`,
      );
    }
    const row = noteCsv.header.map(() => '');
    for (const [field, value] of Object.entries(expected)) row[ni[field]] = value;
    addedNoteRows.push(row);
    const item = { row, changed: false, deleted: false, entry: { record: '', delimiter: '' } };
    noteById.set(ids[0], item);
    noteCsv.rows.push(item);
    noteAdded += 1;
    continue;
  }

  throw new Error(`Unhandled note action: ${action}`);
}

const hostChanged = saveEditableCsv(HOSTPLANTS_PATH, hostCsv, addedHostRows);
const noteChanged = saveEditableCsv(NOTES_PATH, noteCsv, addedNoteRows);

console.log(JSON.stringify({
  source: SOURCE,
  audited_accounts: auditedInsectIds.size,
  audit_rows: auditRows.length,
  host_deleted: hostDeleted,
  host_updated: hostUpdated,
  host_added: hostAdded,
  note_updated: noteUpdated,
  note_deleted: noteDeleted,
  note_added: noteAdded,
  note_superseded: noteSuperseded,
  host_file_changed: hostChanged,
  note_file_changed: noteChanged,
}, null, 2));
