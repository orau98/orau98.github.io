import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';
import { collectGeneralNoteIssues } from './lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');

const SOURCE = '日本のハマキガ2';
const EXPECTED_VERSION = 'hamakiga2-general-notes-v1-2026-07-12';
const EXPECTED_LEDGER_SHA256 = 'ce01b372ee86ed75bc125979f85c680d413bcd0bcf13cdaba890a4d4b85b9009';
const EXPECTED_PDF_SHA256 = 'c08313ec4623e47ea158bf63a93109568b007413cfb8030a7f094ca48fc35ef1';
const EXPECTED_PDF_PAGES = 89;
const EXPECTED_LOCATOR_SHA256 = '36abfdebf08d6dfc372c513a425f18da4622bfb0c58a5be565981cfd28d910e7';
const EXPECTED_LOCATOR_PAGES = 45;
const EXPECTED_ACTIONS = new Map([
  ['update_note', 21],
  ['delete_note', 5],
]);
const EXPECTED_CLASSES = new Map([
  ['explicit_inference', 10],
  ['qualitative_candidate', 13],
  ['integrity_companion', 3],
]);
const TARGET_INFERENCE_PATTERN = /可能性|かもしれな|思われ|おそらく|恐らく|推定|考えられ|疑われ|推測|らしい/;
const EDITORIAL_PATTERN = /に詳しい|を参照/;
const TYPE_KEYS = new Map([
  ['出現時期', 'emergence'],
  ['生態情報', 'ecology'],
]);

const resolvePath = (envName, fallback) => process.env[envName]
  ? path.resolve(process.env[envName])
  : path.join(ROOT, fallback);

const NOTES_PATH = resolvePath(
  'HAMAKIGA2_NOTE_AUDIT_NOTES_PATH',
  'normalized_data/general_notes.csv',
);
const AUDIT_PATH = resolvePath(
  'HAMAKIGA2_NOTE_AUDIT_PATH',
  'data/source_audits/japanese-tortricid-moths-2-general-note-audit-2026-07-12.json',
);
const PDF_PATH = process.env.HAMAKIGA2_NOTE_AUDIT_PDF_PATH
  ? path.resolve(process.env.HAMAKIGA2_NOTE_AUDIT_PDF_PATH)
  : null;
const PRODUCTION_AUDIT_PATH = path.join(
  ROOT,
  'data',
  'source_audits',
  'japanese-tortricid-moths-2-general-note-audit-2026-07-12.json',
);
const CHECK_ONLY = process.argv.includes('--check');
const unknownArguments = process.argv.slice(2).filter(argument => argument !== '--check');
if (unknownArguments.length > 0) {
  throw new Error('Unknown arguments: ' + unknownArguments.join(', '));
}

const sha256File = (filePath) => {
  const hash = crypto.createHash('sha256');
  const descriptor = fs.openSync(filePath, 'r');
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest('hex');
};

const repairedRecordId = (auditRow) => {
  const insectKey = auditRow.insect_id.replace(/^species-/, '');
  const typeKey = TYPE_KEYS.get(auditRow.note_type) || 'note';
  const signature = [
    SOURCE,
    auditRow.insect_id,
    auditRow.note_type,
    auditRow.approved_content,
    auditRow.approved_page,
    '',
  ].join('\u0000');
  const digest = crypto.createHash('sha1').update(signature).digest('hex').slice(0, 12);
  return 'note-hamakiga2-' + insectKey + '-' + typeKey + '-' + digest;
};

const rawAudit = fs.readFileSync(AUDIT_PATH, 'utf8');
let audit;
try {
  audit = JSON.parse(rawAudit);
} catch (error) {
  throw new Error(path.basename(AUDIT_PATH) + ': ' + error.message);
}

if (audit.audit_version !== EXPECTED_VERSION) throw new Error('Unexpected audit_version');
if (audit.reviewed_on !== '2026-07-12') throw new Error('Unexpected reviewed_on');
if (audit.reference !== SOURCE) throw new Error('Unexpected audit reference');
if (!audit.method) throw new Error('Missing audit method');
if (
  audit.source_pdf?.sha256 !== EXPECTED_PDF_SHA256
  || audit.source_pdf?.page_count !== EXPECTED_PDF_PAGES
  || audit.source_pdf?.role !== 'original_full_pdf_image_review'
) {
  throw new Error('Unexpected original source PDF identity');
}
if (
  audit.candidate_locator_pdf?.sha256 !== EXPECTED_LOCATOR_SHA256
  || audit.candidate_locator_pdf?.page_count !== EXPECTED_LOCATOR_PAGES
  || audit.candidate_locator_pdf?.role !== 'text_layer_candidate_location_only_not_acceptance_evidence'
) {
  throw new Error('Unexpected candidate-locator PDF identity');
}
if (
  audit.scan_scope?.general_note_rows_before !== 127
  || audit.scan_scope?.general_note_rows_after !== 122
  || audit.scan_scope?.note_type_counts_before?.出現時期 !== 78
  || audit.scan_scope?.note_type_counts_before?.生態情報 !== 49
  || audit.scan_scope?.explicit_inference_candidates !== 10
  || audit.scan_scope?.qualitative_candidates !== 13
  || audit.scan_scope?.integrity_companion_rows !== 3
  || audit.scan_scope?.unresolved_or_hold !== 0
) {
  throw new Error('Unexpected scan scope');
}
if (!Array.isArray(audit.rows) || audit.rows.length !== 26) {
  throw new Error('Expected 26 audit rows; found ' + audit.rows?.length);
}

const auditIds = new Set();
const recordIds = new Set();
const actionCounts = new Map();
const classCounts = new Map();
for (const row of audit.rows) {
  if (!row.audit_id || auditIds.has(row.audit_id)) {
    throw new Error('Invalid or duplicate audit_id: ' + row.audit_id);
  }
  auditIds.add(row.audit_id);
  if (!row.record_id || recordIds.has(row.record_id)) {
    throw new Error('Invalid or duplicate record_id: ' + row.record_id);
  }
  recordIds.add(row.record_id);
  if (!EXPECTED_ACTIONS.has(row.action)) {
    throw new Error('Unsupported action for ' + row.audit_id + ': ' + row.action);
  }
  if (!EXPECTED_CLASSES.has(row.review_class)) {
    throw new Error('Unsupported review_class for ' + row.audit_id + ': ' + row.review_class);
  }
  if (
    !row.insect_id
    || !row.japanese_name
    || !row.scientific_name
    || !['出現時期', '生態情報'].includes(row.note_type)
    || row.source_taxon_scope !== 'species'
  ) {
    throw new Error('Incomplete or over-narrow target identity for ' + row.audit_id);
  }
  if (
    !Number.isInteger(row.source_account)
    || row.source_account < 1
    || !row.source_heading
    || !Array.isArray(row.pdf_pages)
    || row.pdf_pages.length === 0
    || !row.pdf_pages.every(page => Number.isInteger(page) && page >= 1 && page <= EXPECTED_PDF_PAGES)
    || !Array.isArray(row.printed_pages)
    || row.printed_pages.length === 0
    || !row.printed_pages.every(page => Number.isInteger(page) && page >= 1)
    || !row.evidence
    || !row.decision
  ) {
    throw new Error('Incomplete original-PDF provenance for ' + row.audit_id);
  }
  if (typeof row.old_content !== 'string' || !row.old_content || row.old_page !== '') {
    throw new Error('Invalid legacy state for ' + row.audit_id);
  }
  if (row.action === 'update_note') {
    const expectedPage = String(row.printed_pages.at(-1));
    if (!row.approved_content || row.approved_page !== expectedPage) {
      throw new Error('Invalid approved state for ' + row.audit_id);
    }
    const issues = collectGeneralNoteIssues({
      note_type: row.note_type,
      content: row.approved_content,
      page: row.approved_page,
    });
    if (issues.length > 0) {
      throw new Error(
        'Approved note fails quality rules for ' + row.audit_id + ': ' + issues.join(','),
      );
    }
    if (TARGET_INFERENCE_PATTERN.test(row.approved_content)) {
      throw new Error('Approved note retains target inference for ' + row.audit_id);
    }
    if (EDITORIAL_PATTERN.test(row.approved_content)) {
      throw new Error('Approved note retains editorial guidance for ' + row.audit_id);
    }
  } else if (row.approved_content !== '' || row.approved_page !== '') {
    throw new Error('Deleted note has approved data for ' + row.audit_id);
  }
  actionCounts.set(row.action, (actionCounts.get(row.action) || 0) + 1);
  classCounts.set(row.review_class, (classCounts.get(row.review_class) || 0) + 1);
}
for (const [action, expected] of EXPECTED_ACTIONS) {
  const actual = actionCounts.get(action) || 0;
  if (actual !== expected || audit.expected_profile?.[action] !== expected) {
    throw new Error('Action profile mismatch for ' + action + ': ' + actual + ' != ' + expected);
  }
}
for (const [reviewClass, expected] of EXPECTED_CLASSES) {
  const actual = classCounts.get(reviewClass) || 0;
  if (actual !== expected) {
    throw new Error(
      'Review-class profile mismatch for ' + reviewClass + ': ' + actual + ' != ' + expected,
    );
  }
}

const enforceProductionAudit = path.resolve(AUDIT_PATH) === path.resolve(PRODUCTION_AUDIT_PATH)
  || process.env.HAMAKIGA2_NOTE_AUDIT_ENFORCE_PRODUCTION === '1';
if (enforceProductionAudit) {
  const actualSha256 = crypto.createHash('sha256').update(rawAudit).digest('hex');
  if (actualSha256 !== EXPECTED_LEDGER_SHA256) {
    throw new Error('Production audit SHA-256 mismatch: ' + actualSha256);
  }
}
if (PDF_PATH) {
  const actualSha256 = sha256File(PDF_PATH);
  if (actualSha256 !== EXPECTED_PDF_SHA256) {
    throw new Error('Source PDF SHA-256 mismatch: ' + actualSha256);
  }
}

const source = fs.readFileSync(NOTES_PATH, 'utf8');
const hasBom = source.charCodeAt(0) === 0xfeff;
const body = hasBom ? source.slice(1) : source;
const records = splitCsvRecordsWithDelimiters(body);
if (records.length === 0) throw new Error('general_notes.csv is empty');
const headerParsed = Papa.parse(records[0].record);
if (headerParsed.errors.length > 0) {
  throw new Error('general_notes.csv: ' + headerParsed.errors[0].message);
}
const header = headerParsed.data[0];
const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
for (const column of ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year']) {
  if (indexes[column] === undefined) throw new Error('general_notes.csv is missing ' + column);
}
const csvRows = records.slice(1).filter(record => record.record).map((record) => {
  const parsed = Papa.parse(record.record);
  if (parsed.errors.length > 0 || parsed.data.length !== 1) {
    throw new Error(
      'Malformed general_notes.csv row: ' + (parsed.errors[0]?.message || 'row count'),
    );
  }
  return { record, values: parsed.data[0], changed: false, deleted: false };
});
const byRecordId = new Map();
for (const row of csvRows) {
  const recordId = row.values[indexes.record_id] || '';
  if (!recordId || byRecordId.has(recordId)) {
    throw new Error('Invalid or duplicate general-note record_id: ' + recordId);
  }
  byRecordId.set(recordId, row);
}

const semanticMatches = auditRow => csvRows.filter(row => (
  row.values[indexes.insect_id] === auditRow.insect_id
  && row.values[indexes.note_type] === auditRow.note_type
  && row.values[indexes.reference] === SOURCE
  && row.values[indexes.content] === auditRow.old_content
));
const assertIdentity = (auditRow, csvRow) => {
  if (
    csvRow.values[indexes.insect_id] !== auditRow.insect_id
    || csvRow.values[indexes.note_type] !== auditRow.note_type
    || csvRow.values[indexes.reference] !== SOURCE
  ) {
    throw new Error('Target identity mismatch for ' + auditRow.audit_id);
  }
};

const states = [];
for (const auditRow of audit.rows) {
  const csvRow = byRecordId.get(auditRow.record_id);
  if (!csvRow) {
    if (auditRow.action === 'update_note') {
      const recalculatedId = repairedRecordId(auditRow);
      const recalculatedRow = byRecordId.get(recalculatedId);
      if (recalculatedRow) {
        assertIdentity(auditRow, recalculatedRow);
        if (
          recalculatedRow.values[indexes.content] !== auditRow.approved_content
          || recalculatedRow.values[indexes.page] !== auditRow.approved_page
          || (recalculatedRow.values[indexes.year] || '') !== ''
        ) {
          throw new Error('Unexpected recalculated-ID state for ' + auditRow.audit_id);
        }
        states.push({ auditRow, csvRow: recalculatedRow, state: 'applied' });
        continue;
      }
    }
    if (auditRow.action === 'delete_note' && semanticMatches(auditRow).length === 0) {
      states.push({ auditRow, csvRow: null, state: 'applied' });
      continue;
    }
    throw new Error('Required note is missing for ' + auditRow.audit_id + ': ' + auditRow.record_id);
  }
  if (
    auditRow.action === 'update_note'
    && repairedRecordId(auditRow) !== auditRow.record_id
    && byRecordId.has(repairedRecordId(auditRow))
  ) {
    throw new Error('Both legacy and recalculated target IDs exist for ' + auditRow.audit_id);
  }
  assertIdentity(auditRow, csvRow);
  const content = csvRow.values[indexes.content] || '';
  const page = csvRow.values[indexes.page] || '';
  if (auditRow.action === 'update_note') {
    if (content === auditRow.old_content && page === auditRow.old_page) {
      states.push({ auditRow, csvRow, state: 'pending' });
    } else if (content === auditRow.approved_content && page === auditRow.approved_page) {
      states.push({ auditRow, csvRow, state: 'applied' });
    } else {
      throw new Error('Unexpected update state for ' + auditRow.audit_id);
    }
  } else if (content === auditRow.old_content && page === auditRow.old_page) {
    states.push({ auditRow, csvRow, state: 'pending' });
  } else {
    throw new Error('Unexpected delete state for ' + auditRow.audit_id);
  }
}
const pendingCount = states.filter(item => item.state === 'pending').length;
const appliedCount = states.filter(item => item.state === 'applied').length;
if (pendingCount > 0 && appliedCount > 0) {
  throw new Error('Partial audit state: pending=' + pendingCount + ', applied=' + appliedCount);
}

const currentSourceRows = csvRows.filter(row => row.values[indexes.reference] === SOURCE);
const currentTypeCounts = currentSourceRows.reduce((counts, row) => {
  const type = row.values[indexes.note_type];
  counts.set(type, (counts.get(type) || 0) + 1);
  return counts;
}, new Map());
const expectedCurrentRows = pendingCount > 0 ? 127 : 122;
const expectedEmergence = pendingCount > 0 ? 78 : 76;
const expectedEcology = pendingCount > 0 ? 49 : 46;
if (
  currentSourceRows.length !== expectedCurrentRows
  || (currentTypeCounts.get('出現時期') || 0) !== expectedEmergence
  || (currentTypeCounts.get('生態情報') || 0) !== expectedEcology
) {
  throw new Error('Unexpected 日本のハマキガ2 source-row profile');
}

let noteUpdated = 0;
let noteDeleted = 0;
if (pendingCount > 0) {
  for (const { auditRow, csvRow } of states) {
    if (auditRow.action === 'update_note') {
      csvRow.values[indexes.content] = auditRow.approved_content;
      csvRow.values[indexes.page] = auditRow.approved_page;
      csvRow.changed = true;
      noteUpdated += 1;
    } else {
      csvRow.deleted = true;
      noteDeleted += 1;
    }
  }
}

const outputRecords = [records[0]];
for (const row of csvRows) {
  if (row.deleted) continue;
  if (row.changed) {
    outputRecords.push({
      record: Papa.unparse([row.values], { newline: '' }),
      delimiter: row.record.delimiter,
    });
  } else {
    outputRecords.push(row.record);
  }
}
const result = (hasBom ? '\ufeff' : '') + outputRecords
  .map(({ record, delimiter }) => record + delimiter)
  .join('');

const outputParsed = Papa.parse(result.replace(/^\ufeff/, ''), {
  header: true,
  skipEmptyLines: true,
});
if (outputParsed.errors.length > 0) {
  throw new Error('Transformed general_notes.csv: ' + outputParsed.errors[0].message);
}
const outputById = new Map();
for (const row of outputParsed.data) {
  if (!row.record_id || outputById.has(row.record_id)) {
    throw new Error('Transformed output has invalid or duplicate record_id: ' + row.record_id);
  }
  outputById.set(row.record_id, row);
}
for (const auditRow of audit.rows) {
  const legacyRow = outputById.get(auditRow.record_id);
  const recalculatedRow = auditRow.action === 'update_note'
    ? outputById.get(repairedRecordId(auditRow))
    : null;
  if (legacyRow && recalculatedRow && legacyRow !== recalculatedRow) {
    throw new Error('Both output target IDs exist for ' + auditRow.audit_id);
  }
  const row = legacyRow || recalculatedRow;
  if (auditRow.action === 'delete_note') {
    if (row) throw new Error('Deleted note remains after transformation: ' + auditRow.record_id);
    continue;
  }
  if (
    !row
    || row.insect_id !== auditRow.insect_id
    || row.note_type !== auditRow.note_type
    || row.reference !== SOURCE
    || row.content !== auditRow.approved_content
    || row.page !== auditRow.approved_page
  ) {
    throw new Error('Approved note is not exact after transformation: ' + auditRow.record_id);
  }
  const issues = collectGeneralNoteIssues(row);
  if (issues.length > 0) {
    throw new Error(
      'Transformed note fails quality rules for ' + auditRow.record_id + ': ' + issues.join(','),
    );
  }
}

const outputSourceRows = outputParsed.data.filter(row => row.reference === SOURCE);
const outputTypeCounts = outputSourceRows.reduce((counts, row) => {
  counts.set(row.note_type, (counts.get(row.note_type) || 0) + 1);
  return counts;
}, new Map());
const residualInference = outputSourceRows.filter(row => TARGET_INFERENCE_PATTERN.test(row.content));
const residualEditorial = outputSourceRows.filter(row => EDITORIAL_PATTERN.test(row.content));
if (
  outputSourceRows.length !== 122
  || (outputTypeCounts.get('出現時期') || 0) !== 76
  || (outputTypeCounts.get('生態情報') || 0) !== 46
  || residualInference.length !== 0
  || residualEditorial.length !== 0
) {
  throw new Error(
    'Transformed source profile is unsafe: rows='
    + outputSourceRows.length
    + ', inference='
    + residualInference.length
    + ', editorial='
    + residualEditorial.length,
  );
}

if (!CHECK_ONLY && result !== source) {
  const temporaryPath = NOTES_PATH + '.tmp-' + process.pid + '-' + crypto.randomUUID();
  try {
    fs.writeFileSync(temporaryPath, result, {
      encoding: 'utf8',
      mode: fs.statSync(NOTES_PATH).mode,
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, NOTES_PATH);
  } catch (error) {
    try {
      if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
    } catch {
      // Preserve the original write failure.
    }
    throw error;
  }
}

console.log(JSON.stringify({
  audit_version: audit.audit_version,
  audit_rows: audit.rows.length,
  note_updated: noteUpdated,
  note_deleted: noteDeleted,
  check_only: CHECK_ONLY,
  changed: !CHECK_ONLY && result !== source,
  would_change: result !== source,
  source_pdf_verified: Boolean(PDF_PATH),
  source_rows_after: outputSourceRows.length,
  target_inference_after: residualInference.length,
  editorial_guidance_after: residualEditorial.length,
}, null, 2));
