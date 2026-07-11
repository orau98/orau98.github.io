import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const HOSTPLANTS_PATH = resolvePath(
  'TAMAMUSHI_AUDIT_HOSTPLANTS_PATH',
  'normalized_data/hostplants.csv',
);
const NOTES_PATH = resolvePath(
  'TAMAMUSHI_AUDIT_NOTES_PATH',
  'normalized_data/general_notes.csv',
);
const AUDIT_PATH = resolvePath(
  'TAMAMUSHI_AUDIT_PATH',
  'data/source_audits/japanese-jewel-beetles-grand-atlas-integrity-2026-07-11.csv',
);
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-jewel-beetles-grand-atlas-integrity-2026-07-11.csv',
);
const EXPECTED_PDF_SHA256 = '7893e51f670e7a42e6d3df3bb5b224f7ef547112e6e7cdb1954b1f254a673415';
const EXPECTED_PRODUCTION_AUDIT_SHA256 = 'eed4c28862703b48c0f28fb8f5e21a11f3c037e4a86c0f69185d9aea3d19ef9a';
const EXPECTED_PRODUCTION_ACTION_COUNTS = new Map([
  ['delete_host_records', 4],
  ['update_host_field', 8],
  ['upsert_host_relation', 1],
  ['add_host_relation', 12],
  ['delete_note_content', 12],
  ['replace_note_content', 65],
  ['move_note_insect', 1],
  ['add_note', 26],
]);

const readCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    { header: true, skipEmptyLines: true },
  );
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, filePath)}: ${parsed.errors[0].message}`);
  }
  return parsed.data;
};

const loadEditableCsv = (filePath, requiredColumns) => {
  const source = fs.readFileSync(filePath, 'utf-8');
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

  const rows = entries.slice(1).filter((entry) => entry.record).map((entry) => {
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
  if (result !== csv.source) fs.writeFileSync(filePath, result, 'utf-8');
  return result !== csv.source;
};

const splitIds = (value) => String(value || '')
  .split(';')
  .map((item) => item.trim())
  .filter(Boolean);

const auditRows = readCsv(AUDIT_PATH);
const auditIds = new Set();
const allowedActions = new Set([
  'delete_host_records',
  'update_host_field',
  'upsert_host_relation',
  'add_host_relation',
  'delete_note_content',
  'replace_note_content',
  'move_note_insect',
  'add_note',
]);
for (const audit of auditRows) {
  const auditId = (audit.audit_id || '').trim();
  if (!auditId || auditIds.has(auditId)) throw new Error(`Invalid or duplicate audit_id: ${auditId}`);
  auditIds.add(auditId);
  if (!allowedActions.has((audit.action || '').trim())) {
    throw new Error(`Unsupported action for ${auditId}: ${audit.action}`);
  }
  if ((audit.source_pdf_sha256 || '').trim() !== EXPECTED_PDF_SHA256) {
    throw new Error(`Unexpected source_pdf_sha256 for ${auditId}`);
  }
  if (!(audit.pdf_page || '').trim() || !(audit.printed_page || '').trim()) {
    throw new Error(`Missing source page for ${auditId}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test((audit.reviewed_on || '').trim())) {
    throw new Error(`Invalid reviewed_on for ${auditId}`);
  }
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.TAMAMUSHI_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const auditSha256 = crypto.createHash('sha256')
    .update(fs.readFileSync(AUDIT_PATH))
    .digest('hex');
  if (auditSha256 !== EXPECTED_PRODUCTION_AUDIT_SHA256) {
    throw new Error(`Production audit SHA-256 mismatch: ${auditSha256}`);
  }
  const actionCounts = new Map();
  for (const audit of auditRows) {
    const action = audit.action.trim();
    actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
  }
  const expectedTotal = [...EXPECTED_PRODUCTION_ACTION_COUNTS.values()]
    .reduce((sum, count) => sum + count, 0);
  if (auditRows.length !== expectedTotal) {
    throw new Error(`Production audit row count mismatch: ${auditRows.length} != ${expectedTotal}`);
  }
  for (const [action, expected] of EXPECTED_PRODUCTION_ACTION_COUNTS) {
    const actual = actionCounts.get(action) || 0;
    if (actual !== expected) {
      throw new Error(`Production action count mismatch for ${action}: ${actual} != ${expected}`);
    }
  }
  const species10007 = auditRows.find((audit) => audit.audit_id === 'BUP-001');
  if (!species10007 || splitIds(species10007.record_ids).length !== 69) {
    throw new Error('BUP-001 must enumerate exactly 69 misassigned host rows');
  }
}

const hostCsv = loadEditableCsv(HOSTPLANTS_PATH, [
  'record_id',
  'insect_id',
  'plant_name',
  'plant_family',
  'observation_type',
  'plant_part',
  'life_stage',
  'reference',
  'notes',
]);
const hostIndex = hostCsv.indexes;
const hostById = new Map();
for (const item of hostCsv.rows) {
  const id = (item.row[hostIndex.record_id] || '').trim();
  if (!id || hostById.has(id)) throw new Error(`Invalid or duplicate hostplant record_id: ${id}`);
  hostById.set(id, item);
}

let hostDeleted = 0;
let hostUpdated = 0;
let hostAdded = 0;
const addedHostRows = [];

for (const audit of auditRows.filter((row) => row.entity === 'hostplant')) {
  const action = audit.action.trim();
  if (action === 'delete_host_records') {
    const ids = splitIds(audit.record_ids);
    if (ids.length === 0) throw new Error(`No record_ids for ${audit.audit_id}`);
    const existingItems = ids
      .map((id) => hostById.get(id))
      .filter((item) => item && !item.deleted);
    if (existingItems.length !== 0 && existingItems.length !== ids.length) {
      throw new Error(
        `Partial delete state for ${audit.audit_id}: ${existingItems.length}/${ids.length} rows remain`,
      );
    }
    if (existingItems.length === 0) continue;
    for (const id of ids) {
      const item = hostById.get(id);
      if ((item.row[hostIndex.insect_id] || '').trim() !== audit.insect_id.trim()) {
        throw new Error(`insect_id mismatch for ${audit.audit_id}: ${id}`);
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
    if ((item.row[hostIndex.insect_id] || '').trim() !== audit.insect_id.trim()) {
      throw new Error(`insect_id mismatch for ${audit.audit_id}: ${ids[0]}`);
    }
    const field = (audit.field || '').trim();
    if (hostIndex[field] === undefined) throw new Error(`Unknown host field for ${audit.audit_id}: ${field}`);
    const current = item.row[hostIndex[field]] || '';
    const expected = audit.expected_value || '';
    const approved = audit.approved_value || '';
    if (current === approved) continue;
    if (current !== expected) {
      throw new Error(`Unexpected value for ${audit.audit_id}: ${field}=${current}`);
    }
    item.row[hostIndex[field]] = approved;
    item.changed = true;
    hostUpdated += 1;
    continue;
  }

  if (action === 'upsert_host_relation') {
    const ids = splitIds(audit.record_ids);
    if (ids.length !== 1) throw new Error(`Expected one record_id for ${audit.audit_id}`);
    const approvedPlantName = audit.approved_value || audit.plant_name || '';
    const expected = {
      record_id: ids[0],
      insect_id: audit.insect_id || '',
      plant_name: approvedPlantName,
      plant_family: audit.plant_family || '',
      observation_type: audit.observation_type || '',
      plant_part: audit.plant_part || '',
      life_stage: audit.life_stage || '',
      reference: audit.reference || '',
      notes: audit.notes || '',
    };
    const existing = hostById.get(ids[0]);
    if (!existing) {
      const row = hostCsv.header.map(() => '');
      for (const [field, value] of Object.entries(expected)) row[hostIndex[field]] = value;
      const numericTarget = ids[0].match(/^hostplant-(\d+)$/);
      let insertionIndex = -1;
      if (numericTarget) {
        const targetNumber = Number(numericTarget[1]);
        let nextNumber = Number.POSITIVE_INFINITY;
        hostCsv.rows.forEach((item, index) => {
          const match = (item.row[hostIndex.record_id] || '').match(/^hostplant-(\d+)$/);
          if (!match) return;
          const candidate = Number(match[1]);
          if (candidate > targetNumber && candidate < nextNumber) {
            nextNumber = candidate;
            insertionIndex = index;
          }
        });
      } else {
        insertionIndex = hostCsv.rows.findIndex((item) => (
          (item.row[hostIndex.record_id] || '').localeCompare(ids[0], 'en') > 0
        ));
      }
      const delimiter = insertionIndex >= 0
        ? hostCsv.rows[insertionIndex].entry.delimiter
        : hostCsv.rows.at(-1)?.entry.delimiter || '\r\n';
      const newItem = {
        entry: { record: '', delimiter },
        row,
        changed: true,
        deleted: false,
      };
      if (insertionIndex >= 0) hostCsv.rows.splice(insertionIndex, 0, newItem);
      else hostCsv.rows.push(newItem);
      hostById.set(ids[0], newItem);
      hostAdded += 1;
      continue;
    }
    if ((existing.row[hostIndex.insect_id] || '') !== expected.insect_id) {
      throw new Error(`insect_id mismatch for ${audit.audit_id}: ${ids[0]}`);
    }
    const currentPlantName = existing.row[hostIndex.plant_name] || '';
    if (currentPlantName !== (audit.expected_value || '') && currentPlantName !== approvedPlantName) {
      throw new Error(`Unexpected plant_name for ${audit.audit_id}: ${currentPlantName}`);
    }
    let changed = false;
    for (const field of [
      'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes',
    ]) {
      const current = existing.row[hostIndex[field]] || '';
      const approved = expected[field];
      if (field !== 'plant_name' && current !== '' && current !== approved) {
        throw new Error(`Unexpected ${field} for ${audit.audit_id}: ${current}`);
      }
      if (current !== approved) {
        existing.row[hostIndex[field]] = approved;
        changed = true;
      }
    }
    if (changed) {
      existing.changed = true;
      hostUpdated += 1;
    }
    continue;
  }

  if (action === 'add_host_relation') {
    const ids = splitIds(audit.record_ids);
    if (ids.length !== 1) throw new Error(`Expected one record_id for ${audit.audit_id}`);
    const expected = {
      record_id: ids[0],
      insect_id: audit.insect_id || '',
      plant_name: audit.plant_name || '',
      plant_family: audit.plant_family || '',
      observation_type: audit.observation_type || '',
      plant_part: audit.plant_part || '',
      life_stage: audit.life_stage || '',
      reference: audit.reference || '',
      notes: audit.notes || '',
    };
    const existing = hostById.get(ids[0]);
    if (existing) {
      let changed = false;
      for (const [field, value] of Object.entries(expected)) {
        const current = existing.row[hostIndex[field]] || '';
        if (current === value) continue;
        const isControlledFieldUpdate = audit.field === field
          && current === (audit.expected_value || '')
          && value === (audit.approved_value || '');
        if (!isControlledFieldUpdate) {
          throw new Error(`Existing relation differs from ${audit.audit_id}: ${field}`);
        }
        existing.row[hostIndex[field]] = value;
        changed = true;
      }
      if (changed) {
        existing.changed = true;
        hostUpdated += 1;
      }
      continue;
    }
    const semanticDuplicate = hostCsv.rows.some((item) => !item.deleted
      && item.row[hostIndex.insect_id] === expected.insect_id
      && item.row[hostIndex.plant_name] === expected.plant_name
      && item.row[hostIndex.observation_type] === expected.observation_type
      && item.row[hostIndex.life_stage] === expected.life_stage
      && item.row[hostIndex.reference] === expected.reference);
    if (semanticDuplicate) continue;
    const row = hostCsv.header.map(() => '');
    for (const [field, value] of Object.entries(expected)) row[hostIndex[field]] = value;
    addedHostRows.push(row);
    hostAdded += 1;
    continue;
  }
}

const notesCsv = loadEditableCsv(NOTES_PATH, [
  'record_id',
  'insect_id',
  'note_type',
  'content',
  'reference',
  'page',
  'year',
]);
const noteIndex = notesCsv.indexes;
const addedNoteRows = [];
let noteDeleted = 0;
let noteUpdated = 0;
let noteMoved = 0;
let noteAdded = 0;

const activeNoteMatches = ({ insectId, noteType, content, reference }) => notesCsv.rows.filter((item) => (
  !item.deleted
  && item.row[noteIndex.insect_id] === insectId
  && item.row[noteIndex.note_type] === noteType
  && item.row[noteIndex.content] === content
  && item.row[noteIndex.reference] === reference
));

for (const audit of auditRows.filter((row) => row.entity === 'general_note')) {
  const action = audit.action.trim();
  const insectId = audit.insect_id || '';
  const noteType = audit.note_type || '';
  const reference = audit.reference || '';
  const before = audit.match_content || '';
  const after = audit.approved_value || '';

  if (action === 'delete_note_content') {
    const matches = activeNoteMatches({ insectId, noteType, content: before, reference });
    if (matches.length > 1) throw new Error(`Ambiguous note delete for ${audit.audit_id}`);
    if (matches.length === 1) {
      matches[0].deleted = true;
      noteDeleted += 1;
    }
    continue;
  }

  if (action === 'replace_note_content') {
    const acceptedBeforeContents = [...new Set([before, audit.expected_value || ''])]
      .filter(Boolean);
    const beforeMatches = acceptedBeforeContents.flatMap((content) => (
      activeNoteMatches({ insectId, noteType, content, reference })
    ));
    const afterMatches = activeNoteMatches({ insectId, noteType, content: after, reference });
    if (beforeMatches.length === 0 && afterMatches.length === 1) continue;
    if (beforeMatches.length !== 1 || afterMatches.length !== 0) {
      throw new Error(`Could not uniquely replace note for ${audit.audit_id}`);
    }
    beforeMatches[0].row[noteIndex.content] = after;
    beforeMatches[0].changed = true;
    noteUpdated += 1;
    continue;
  }

  if (action === 'move_note_insect') {
    const targetId = after;
    const approvedContent = audit.notes || before;
    const sourceMatches = activeNoteMatches({ insectId, noteType, content: before, reference });
    const targetMatches = activeNoteMatches({ insectId: targetId, noteType, content: before, reference });
    const approvedMatches = approvedContent === before ? [] : activeNoteMatches({
      insectId: targetId,
      noteType,
      content: approvedContent,
      reference,
    });
    if (sourceMatches.length === 0 && targetMatches.length === 0 && approvedMatches.length === 1) {
      continue;
    }
    if (sourceMatches.length + targetMatches.length !== 1 || approvedMatches.length !== 0) {
      throw new Error(`Could not uniquely move note for ${audit.audit_id}`);
    }
    const item = sourceMatches[0] || targetMatches[0];
    item.row[noteIndex.insect_id] = targetId;
    item.row[noteIndex.content] = approvedContent;
    item.changed = true;
    noteMoved += 1;
    continue;
  }

  if (action === 'add_note') {
    const matches = activeNoteMatches({ insectId, noteType, content: after, reference });
    if (matches.length === 1) continue;
    if (matches.length > 1) throw new Error(`Duplicate approved note for ${audit.audit_id}`);
    const ids = splitIds(audit.record_ids);
    if (ids.length !== 1) throw new Error(`Expected one provisional note ID for ${audit.audit_id}`);
    const row = notesCsv.header.map(() => '');
    const values = {
      record_id: ids[0],
      insect_id: insectId,
      note_type: noteType,
      content: after,
      reference,
      page: audit.note_page || '',
      year: audit.note_year || '',
    };
    for (const [field, value] of Object.entries(values)) row[noteIndex[field]] = value;
    addedNoteRows.push(row);
    noteAdded += 1;
    continue;
  }
}

const hostChanged = saveEditableCsv(HOSTPLANTS_PATH, hostCsv, addedHostRows);
const noteChanged = saveEditableCsv(NOTES_PATH, notesCsv, addedNoteRows);

console.log([
  '[tamamushi-literature-audit]',
  `host_deleted=${hostDeleted}`,
  `host_updated=${hostUpdated}`,
  `host_added=${hostAdded}`,
  `note_deleted=${noteDeleted}`,
  `note_updated=${noteUpdated}`,
  `note_moved=${noteMoved}`,
  `note_added=${noteAdded}`,
  `files_changed=${Number(hostChanged) + Number(noteChanged)}`,
].join(' '));
