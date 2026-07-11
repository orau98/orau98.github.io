#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { splitCsvRecordsWithDelimiters } from './lib/csvRecords.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const DATA_ROOT = process.env.GA_TSUSHIN_DATA_ROOT
  ? path.resolve(process.env.GA_TSUSHIN_DATA_ROOT)
  : ROOT;
const AUDIT_PATH = process.env.GA_TSUSHIN_AUDIT_PATH
  ? path.resolve(process.env.GA_TSUSHIN_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-candidates-2026-07-12.csv');
const DEDUP_AUDIT_PATH = process.env.GA_TSUSHIN_DEDUP_AUDIT_PATH
  ? path.resolve(process.env.GA_TSUSHIN_DEDUP_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-dedup-2026-07-12.csv');
const CLEANUP_AUDIT_PATH = process.env.GA_TSUSHIN_CLEANUP_AUDIT_PATH
  ? path.resolve(process.env.GA_TSUSHIN_CLEANUP_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-note-cleanup-2026-07-12.csv');
const ADDITIONAL_DEDUP_AUDIT_PATH = process.env.GA_TSUSHIN_ADDITIONAL_DEDUP_AUDIT_PATH
  ? path.resolve(process.env.GA_TSUSHIN_ADDITIONAL_DEDUP_AUDIT_PATH)
  : path.join(ROOT, 'data', 'source_audits', 'ga-tsushin-hostplant-additional-dedup-2026-07-12.csv');
const PDF_ROOT = process.env.GA_TSUSHIN_PDF_ROOT
  ? path.resolve(process.env.GA_TSUSHIN_PDF_ROOT)
  : '';
const CHECK_ONLY = process.argv.includes('--check');
const COLLECTIONS = ['normalized_data', 'public'];
const TARGETS = COLLECTIONS.map((collection) => ({
  collection,
  path: path.join(DATA_ROOT, collection, 'hostplants.csv'),
}));

const REVIEWED_ON_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHA256_RE = /^[a-f0-9]{64}$/;
const REQUIRED_LINES = new Set(['881', '887', '888', '889', '890', '891', '895', '896', '898']);
const REQUIRED_COLUMNS = [
  'audit_id',
  'candidate_line',
  'candidate_insect_id',
  'source_taxon',
  'current_insect_id',
  'current_taxon',
  'taxonomy_mapping',
  'taxonomy_evidence',
  'decision_status',
  'decision',
  'apply_action',
  'target_record_id',
  'expected_json',
  'approved_json',
  'source_pdf',
  'pdf_sha256',
  'pdf_pages',
  'printed_pages',
  'source_reference',
  'evidence_status',
  'source_evidence',
  'approved_plant_name',
  'approved_plant_family',
  'approved_observation_type',
  'approved_plant_part',
  'approved_life_stage',
  'geographic_scope',
  'reviewed_on',
  'review_note',
];
const DEDUP_REQUIRED_COLUMNS = [
  'merge_id',
  'insect_id',
  'plant_name',
  'canonical_record_id',
  'duplicate_record_id',
  'canonical_expected_json',
  'canonical_approved_json',
  'duplicate_expected_json',
  'source_pdf',
  'pdf_sha256',
  'pdf_pages',
  'printed_pages',
  'source_reference',
  'decision',
  'reviewed_on',
  'review_note',
];
const CLEANUP_REQUIRED_COLUMNS = [
  'cleanup_id',
  'insect_id',
  'record_id',
  'expected_json',
  'approved_json',
  'source_pdf',
  'pdf_sha256',
  'pdf_pages',
  'printed_pages',
  'source_reference',
  'decision',
  'reviewed_on',
  'review_note',
];
const ADDITIONAL_DEDUP_REQUIRED_COLUMNS = [
  'action_id',
  'insect_id',
  'plant_name',
  'action',
  'record_id',
  'expected_json',
  'approved_json',
  'source_pdf',
  'pdf_sha256',
  'pdf_pages',
  'printed_pages',
  'source_reference',
  'evidence_status',
  'decision',
  'reviewed_on',
  'review_note',
];
const ALLOWED_STATUS = new Set(['accept', 'reject', 'reject_correct', 'retain_corrected']);
const ALLOWED_ACTIONS = new Set(['none', 'add', 'patch', 'delete']);
const ALLOWED_DECISIONS = new Set([
  'reject_other_subspecies',
  'accept_direct_field_feeding_add_specific_host',
  'reject_speculative_host',
  'reject_uncertain_insect_identification_stronger_record_exists',
  'reject_pupal_attachment_inference_remove_invalid_existing_row',
  'accept_direct_field_host_merge_provenance',
  'correct_existing_foreign_secondary_record_do_not_add_new_record',
  'accept_rearing_feeding_merge_provenance',
]);
const ALLOWED_DEDUP_DECISIONS = new Set([
  'merge_reference_delete_weaker_duplicate',
  'merge_rearing_details_delete_duplicate',
]);
const ALLOWED_CLEANUP_DECISIONS = new Set([
  'remove_public_audit_metadata_keep_objective_observation',
]);
const ALLOWED_ADDITIONAL_DEDUP_DECISIONS = new Set([
  'merge_primary_and_summary_duplicates',
  'merge_summary_duplicate_without_reassessing_fact',
]);
const ALLOWED_ADDITIONAL_EVIDENCE = new Set([
  'original_pdf_visual_confirmed',
  'prior_original_pdf_visual_confirmation_reused_exact_relation',
]);

const clean = (value) => (value ?? '').toString().trim();
const isPlainObject = (value) => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

function parseJsonObject(value, auditId, column) {
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    throw new Error(`${auditId}: invalid ${column}: ${error.message}`);
  }
  if (!isPlainObject(parsed)) throw new Error(`${auditId}: ${column} must be a JSON object`);
  for (const [field, fieldValue] of Object.entries(parsed)) {
    if (!field || typeof fieldValue !== 'string') {
      throw new Error(`${auditId}: ${column} must contain only string field values`);
    }
  }
  return parsed;
}

function verifyPdfHashes(audits) {
  if (!PDF_ROOT) return;
  const expectedByFile = new Map();
  for (const audit of audits) {
    const known = expectedByFile.get(audit.sourcePdf);
    if (known && known !== audit.pdfSha256) {
      throw new Error(`${audit.auditId}: conflicting PDF hashes for ${audit.sourcePdf}`);
    }
    expectedByFile.set(audit.sourcePdf, audit.pdfSha256);
  }
  for (const [fileName, expectedHash] of expectedByFile) {
    const filePath = path.join(PDF_ROOT, fileName);
    if (!fs.existsSync(filePath)) throw new Error(`Missing source PDF: ${filePath}`);
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (actualHash !== expectedHash) {
      throw new Error(`${fileName}: PDF SHA-256 mismatch (${actualHash})`);
    }
  }
}

function readAudit() {
  const parsed = Papa.parse(fs.readFileSync(AUDIT_PATH, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, AUDIT_PATH)}: ${parsed.errors[0].message}`);
  }
  const fields = new Set(parsed.meta.fields || []);
  for (const column of REQUIRED_COLUMNS) {
    if (!fields.has(column)) throw new Error(`${path.relative(ROOT, AUDIT_PATH)} is missing ${column}`);
  }

  const auditIds = new Set();
  const candidateLines = new Set();
  const actionTargets = new Set();
  const audits = parsed.data.map((raw) => {
    const auditId = clean(raw.audit_id);
    const candidateLine = clean(raw.candidate_line);
    const currentInsectId = clean(raw.current_insect_id);
    const status = clean(raw.decision_status);
    const decision = clean(raw.decision);
    const action = clean(raw.apply_action);
    const recordId = clean(raw.target_record_id);
    const expected = parseJsonObject(raw.expected_json, auditId, 'expected_json');
    const approved = parseJsonObject(raw.approved_json, auditId, 'approved_json');
    const sourcePdf = clean(raw.source_pdf);
    const pdfSha256 = clean(raw.pdf_sha256);

    if (!auditId || auditIds.has(auditId)) throw new Error(`Invalid or duplicate audit_id: ${auditId}`);
    auditIds.add(auditId);
    if (!REQUIRED_LINES.has(candidateLine) || candidateLines.has(candidateLine)) {
      throw new Error(`${auditId}: invalid or duplicate candidate_line ${candidateLine}`);
    }
    candidateLines.add(candidateLine);
    if (!currentInsectId || !clean(raw.current_taxon) || !clean(raw.taxonomy_mapping) || !clean(raw.taxonomy_evidence)) {
      throw new Error(`${auditId}: current-taxon mapping is incomplete`);
    }
    if (!ALLOWED_STATUS.has(status)) throw new Error(`${auditId}: unsupported decision_status ${status}`);
    if (!ALLOWED_DECISIONS.has(decision)) throw new Error(`${auditId}: unsupported decision ${decision}`);
    if (!ALLOWED_ACTIONS.has(action)) throw new Error(`${auditId}: unsupported apply_action ${action}`);
    if (!sourcePdf.endsWith('.pdf') || !SHA256_RE.test(pdfSha256)) {
      throw new Error(`${auditId}: invalid source PDF provenance`);
    }
    if (!/^\d+(?:-\d+)?$/.test(clean(raw.pdf_pages)) || !/^\d+(?:-\d+)?$/.test(clean(raw.printed_pages))) {
      throw new Error(`${auditId}: PDF and printed pages are required`);
    }
    if (!clean(raw.source_reference) || !clean(raw.source_evidence) || !clean(raw.evidence_status)) {
      throw new Error(`${auditId}: source evidence is incomplete`);
    }
    if (!REVIEWED_ON_RE.test(clean(raw.reviewed_on)) || !clean(raw.review_note)) {
      throw new Error(`${auditId}: review metadata is incomplete`);
    }

    if (action === 'none') {
      if (recordId || Object.keys(expected).length > 0 || Object.keys(approved).length > 0) {
        throw new Error(`${auditId}: none actions must not contain target data`);
      }
    } else {
      if (!recordId || actionTargets.has(recordId)) throw new Error(`${auditId}: invalid or duplicate action target ${recordId}`);
      actionTargets.add(recordId);
      const expectedKeys = Object.keys(expected).sort();
      const approvedKeys = Object.keys(approved).sort();
      if (action === 'add') {
        if (expectedKeys.length > 0 || approvedKeys.length === 0) {
          throw new Error(`${auditId}: add requires empty expected_json and a complete approved_json`);
        }
      } else if (action === 'patch') {
        if (expectedKeys.length === 0 || JSON.stringify(expectedKeys) !== JSON.stringify(approvedKeys)) {
          throw new Error(`${auditId}: patch objects must have the same non-empty field set`);
        }
      } else if (expectedKeys.length === 0 || approvedKeys.length > 0) {
        throw new Error(`${auditId}: delete requires a complete expected_json and empty approved_json`);
      }
      const identity = action === 'delete' ? expected : approved;
      if (identity.record_id !== recordId || identity.insect_id !== currentInsectId) {
        throw new Error(`${auditId}: target identity does not match current taxon mapping`);
      }
      if (action === 'patch' && (expected.record_id !== recordId || expected.insect_id !== currentInsectId)) {
        throw new Error(`${auditId}: expected patch identity mismatch`);
      }
    }

    return {
      auditId,
      candidateLine,
      currentInsectId,
      status,
      decision,
      action,
      recordId,
      expected,
      approved,
      sourcePdf,
      pdfSha256,
    };
  });

  if (candidateLines.size !== REQUIRED_LINES.size) {
    throw new Error('Audit ledger does not cover all nine required candidate lines');
  }
  const accepted = audits.filter((audit) => audit.status === 'accept').length;
  const rejected = audits.filter((audit) => audit.status.startsWith('reject')).length;
  const corrected = audits.filter((audit) => audit.status === 'retain_corrected').length;
  if (accepted !== 3 || rejected !== 5 || corrected !== 1) {
    throw new Error(`Unexpected decision totals: accept=${accepted} reject=${rejected} corrected=${corrected}`);
  }
  return audits;
}

function readDedupAudit() {
  const parsed = Papa.parse(fs.readFileSync(DEDUP_AUDIT_PATH, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, DEDUP_AUDIT_PATH)}: ${parsed.errors[0].message}`);
  }
  const fields = new Set(parsed.meta.fields || []);
  for (const column of DEDUP_REQUIRED_COLUMNS) {
    if (!fields.has(column)) throw new Error(`${path.relative(ROOT, DEDUP_AUDIT_PATH)} is missing ${column}`);
  }

  const mergeIds = new Set();
  const targetIds = new Set();
  const pairKeys = new Set();
  const merges = parsed.data.map((raw) => {
    const mergeId = clean(raw.merge_id);
    const insectId = clean(raw.insect_id);
    const plantName = clean(raw.plant_name);
    const canonicalRecordId = clean(raw.canonical_record_id);
    const duplicateRecordId = clean(raw.duplicate_record_id);
    const canonicalExpected = parseJsonObject(raw.canonical_expected_json, mergeId, 'canonical_expected_json');
    const canonicalApproved = parseJsonObject(raw.canonical_approved_json, mergeId, 'canonical_approved_json');
    const duplicateExpected = parseJsonObject(raw.duplicate_expected_json, mergeId, 'duplicate_expected_json');
    const sourcePdf = clean(raw.source_pdf);
    const pdfSha256 = clean(raw.pdf_sha256);
    const decision = clean(raw.decision);

    if (!mergeId || mergeIds.has(mergeId)) throw new Error(`Invalid or duplicate merge_id: ${mergeId}`);
    mergeIds.add(mergeId);
    if (!insectId || !plantName || !canonicalRecordId || !duplicateRecordId || canonicalRecordId === duplicateRecordId) {
      throw new Error(`${mergeId}: incomplete duplicate identity`);
    }
    const pairKey = `${insectId}\u0000${plantName}`;
    if (pairKeys.has(pairKey)) throw new Error(`${mergeId}: duplicate insect-plant merge pair`);
    pairKeys.add(pairKey);
    for (const recordId of [canonicalRecordId, duplicateRecordId]) {
      if (targetIds.has(recordId)) throw new Error(`${mergeId}: duplicate merge target ${recordId}`);
      targetIds.add(recordId);
    }
    const expectedKeys = Object.keys(canonicalExpected).sort();
    const approvedKeys = Object.keys(canonicalApproved).sort();
    if (expectedKeys.length === 0 || JSON.stringify(expectedKeys) !== JSON.stringify(approvedKeys)) {
      throw new Error(`${mergeId}: canonical objects must have the same complete field set`);
    }
    if (Object.keys(duplicateExpected).length === 0) {
      throw new Error(`${mergeId}: duplicate_expected_json must be complete`);
    }
    if (
      canonicalExpected.record_id !== canonicalRecordId
      || canonicalApproved.record_id !== canonicalRecordId
      || duplicateExpected.record_id !== duplicateRecordId
      || canonicalExpected.insect_id !== insectId
      || canonicalApproved.insect_id !== insectId
      || duplicateExpected.insect_id !== insectId
      || canonicalExpected.plant_name !== plantName
      || canonicalApproved.plant_name !== plantName
      || duplicateExpected.plant_name !== plantName
    ) {
      throw new Error(`${mergeId}: canonical or duplicate identity mismatch`);
    }
    if (!sourcePdf.endsWith('.pdf') || !SHA256_RE.test(pdfSha256)) {
      throw new Error(`${mergeId}: invalid source PDF provenance`);
    }
    if (!/^\d+(?:-\d+)?$/.test(clean(raw.pdf_pages)) || !/^\d+(?:-\d+)?$/.test(clean(raw.printed_pages))) {
      throw new Error(`${mergeId}: PDF and printed pages are required`);
    }
    if (!clean(raw.source_reference) || !ALLOWED_DEDUP_DECISIONS.has(decision)) {
      throw new Error(`${mergeId}: source or decision metadata is invalid`);
    }
    if (!REVIEWED_ON_RE.test(clean(raw.reviewed_on)) || !clean(raw.review_note)) {
      throw new Error(`${mergeId}: review metadata is incomplete`);
    }

    return {
      mergeId,
      insectId,
      plantName,
      canonicalRecordId,
      duplicateRecordId,
      canonicalExpected,
      canonicalApproved,
      duplicateExpected,
      sourcePdf,
      pdfSha256,
      decision,
    };
  });

  if (merges.length !== 3) throw new Error(`Expected three duplicate merges, found ${merges.length}`);
  const actions = merges.flatMap((merge) => [
    {
      auditId: `${merge.mergeId}:canonical`,
      currentInsectId: merge.insectId,
      action: 'patch',
      recordId: merge.canonicalRecordId,
      expected: merge.canonicalExpected,
      approved: merge.canonicalApproved,
      sourcePdf: merge.sourcePdf,
      pdfSha256: merge.pdfSha256,
    },
    {
      auditId: `${merge.mergeId}:duplicate`,
      currentInsectId: merge.insectId,
      action: 'delete',
      recordId: merge.duplicateRecordId,
      expected: merge.duplicateExpected,
      approved: {},
      sourcePdf: merge.sourcePdf,
      pdfSha256: merge.pdfSha256,
    },
  ]);
  return { merges, actions };
}

function readCleanupAudit() {
  const parsed = Papa.parse(fs.readFileSync(CLEANUP_AUDIT_PATH, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, CLEANUP_AUDIT_PATH)}: ${parsed.errors[0].message}`);
  }
  const fields = new Set(parsed.meta.fields || []);
  for (const column of CLEANUP_REQUIRED_COLUMNS) {
    if (!fields.has(column)) throw new Error(`${path.relative(ROOT, CLEANUP_AUDIT_PATH)} is missing ${column}`);
  }

  const cleanupIds = new Set();
  const recordIds = new Set();
  const actions = parsed.data.map((raw) => {
    const cleanupId = clean(raw.cleanup_id);
    const currentInsectId = clean(raw.insect_id);
    const recordId = clean(raw.record_id);
    const expected = parseJsonObject(raw.expected_json, cleanupId, 'expected_json');
    const approved = parseJsonObject(raw.approved_json, cleanupId, 'approved_json');
    const sourcePdf = clean(raw.source_pdf);
    const pdfSha256 = clean(raw.pdf_sha256);
    const decision = clean(raw.decision);

    if (!cleanupId || cleanupIds.has(cleanupId)) throw new Error(`Invalid or duplicate cleanup_id: ${cleanupId}`);
    cleanupIds.add(cleanupId);
    if (!currentInsectId || !recordId || recordIds.has(recordId)) {
      throw new Error(`${cleanupId}: invalid or duplicate cleanup target ${recordId}`);
    }
    recordIds.add(recordId);
    const expectedKeys = Object.keys(expected).sort();
    const approvedKeys = Object.keys(approved).sort();
    if (expectedKeys.length === 0 || JSON.stringify(expectedKeys) !== JSON.stringify(approvedKeys)) {
      throw new Error(`${cleanupId}: cleanup objects must have the same complete field set`);
    }
    if (
      expected.record_id !== recordId
      || approved.record_id !== recordId
      || expected.insect_id !== currentInsectId
      || approved.insect_id !== currentInsectId
    ) {
      throw new Error(`${cleanupId}: cleanup identity mismatch`);
    }
    const changedFields = expectedKeys.filter((field) => expected[field] !== approved[field]);
    if (changedFields.length !== 1 || changedFields[0] !== 'notes') {
      throw new Error(`${cleanupId}: cleanup may change only notes`);
    }
    if (/。|原報掲載名|PDF|未確認|国内記録ではない/.test(approved.notes)) {
      throw new Error(`${cleanupId}: approved public note still contains audit prose`);
    }
    if (!sourcePdf.endsWith('.pdf') || !SHA256_RE.test(pdfSha256)) {
      throw new Error(`${cleanupId}: invalid source PDF provenance`);
    }
    if (!/^\d+(?:-\d+)?$/.test(clean(raw.pdf_pages)) || !/^\d+(?:-\d+)?$/.test(clean(raw.printed_pages))) {
      throw new Error(`${cleanupId}: PDF and printed pages are required`);
    }
    if (!clean(raw.source_reference) || !ALLOWED_CLEANUP_DECISIONS.has(decision)) {
      throw new Error(`${cleanupId}: source or decision metadata is invalid`);
    }
    if (!REVIEWED_ON_RE.test(clean(raw.reviewed_on)) || !clean(raw.review_note)) {
      throw new Error(`${cleanupId}: review metadata is incomplete`);
    }

    return {
      auditId: cleanupId,
      currentInsectId,
      action: 'patch',
      recordId,
      expected,
      approved,
      sourcePdf,
      pdfSha256,
    };
  });

  if (actions.length !== 2) throw new Error(`Expected two note cleanups, found ${actions.length}`);
  return actions;
}

function readAdditionalDedupAudit() {
  const parsed = Papa.parse(fs.readFileSync(ADDITIONAL_DEDUP_AUDIT_PATH, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${path.relative(ROOT, ADDITIONAL_DEDUP_AUDIT_PATH)}: ${parsed.errors[0].message}`);
  }
  const fields = new Set(parsed.meta.fields || []);
  for (const column of ADDITIONAL_DEDUP_REQUIRED_COLUMNS) {
    if (!fields.has(column)) {
      throw new Error(`${path.relative(ROOT, ADDITIONAL_DEDUP_AUDIT_PATH)} is missing ${column}`);
    }
  }

  const actionIds = new Set();
  const recordIds = new Set();
  const actions = parsed.data.map((raw) => {
    const auditId = clean(raw.action_id);
    const currentInsectId = clean(raw.insect_id);
    const plantName = clean(raw.plant_name);
    const action = clean(raw.action);
    const recordId = clean(raw.record_id);
    const expected = parseJsonObject(raw.expected_json, auditId, 'expected_json');
    const approved = parseJsonObject(raw.approved_json, auditId, 'approved_json');
    const sourcePdf = clean(raw.source_pdf);
    const pdfSha256 = clean(raw.pdf_sha256);
    const evidenceStatus = clean(raw.evidence_status);
    const decision = clean(raw.decision);

    if (!auditId || actionIds.has(auditId)) throw new Error(`Invalid or duplicate action_id: ${auditId}`);
    actionIds.add(auditId);
    if (!currentInsectId || !plantName || !recordId || recordIds.has(recordId)) {
      throw new Error(`${auditId}: invalid or duplicate additional-dedup target ${recordId}`);
    }
    recordIds.add(recordId);
    if (!['patch', 'delete'].includes(action)) throw new Error(`${auditId}: invalid action ${action}`);
    const expectedKeys = Object.keys(expected).sort();
    const approvedKeys = Object.keys(approved).sort();
    if (expectedKeys.length === 0) throw new Error(`${auditId}: expected_json must be complete`);
    if (action === 'patch' && JSON.stringify(expectedKeys) !== JSON.stringify(approvedKeys)) {
      throw new Error(`${auditId}: patch objects must have the same complete field set`);
    }
    if (action === 'delete' && approvedKeys.length > 0) {
      throw new Error(`${auditId}: delete approved_json must be empty`);
    }
    const identity = action === 'patch' ? approved : expected;
    if (
      expected.record_id !== recordId
      || expected.insect_id !== currentInsectId
      || expected.plant_name !== plantName
      || identity.record_id !== recordId
      || identity.insect_id !== currentInsectId
      || identity.plant_name !== plantName
    ) {
      throw new Error(`${auditId}: action identity mismatch`);
    }
    if (action === 'patch' && /。|原報掲載名|PDF|未確認|国内記録ではない/.test(approved.notes)) {
      throw new Error(`${auditId}: approved public note contains audit prose`);
    }
    if (!sourcePdf.endsWith('.pdf') || !SHA256_RE.test(pdfSha256)) {
      throw new Error(`${auditId}: invalid source PDF provenance`);
    }
    if (!/^\d+(?:-\d+)?$/.test(clean(raw.pdf_pages)) || !/^\d+(?:-\d+)?$/.test(clean(raw.printed_pages))) {
      throw new Error(`${auditId}: PDF and printed pages are required`);
    }
    if (
      !clean(raw.source_reference)
      || !ALLOWED_ADDITIONAL_EVIDENCE.has(evidenceStatus)
      || !ALLOWED_ADDITIONAL_DEDUP_DECISIONS.has(decision)
    ) {
      throw new Error(`${auditId}: source, evidence, or decision metadata is invalid`);
    }
    if (!REVIEWED_ON_RE.test(clean(raw.reviewed_on)) || !clean(raw.review_note)) {
      throw new Error(`${auditId}: review metadata is incomplete`);
    }

    return {
      auditId,
      currentInsectId,
      action,
      recordId,
      expected,
      approved,
      sourcePdf,
      pdfSha256,
      verifyPdfHash: evidenceStatus === 'original_pdf_visual_confirmed',
    };
  });

  const patchCount = actions.filter((action) => action.action === 'patch').length;
  const deleteCount = actions.filter((action) => action.action === 'delete').length;
  if (actions.length !== 8 || patchCount !== 3 || deleteCount !== 5) {
    throw new Error(`Expected 3 additional patches and 5 deletes, found ${patchCount}/${deleteCount}`);
  }
  return actions;
}

function parseRecord(record, filePath) {
  const parsed = Papa.parse(record);
  if (parsed.errors.length > 0) throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  return parsed.data[0];
}

function matchesObject(row, indexes, object) {
  return Object.entries(object).every(([field, value]) => (row[indexes[field]] ?? '') === value);
}

function transformCsv(target, audits, { sourceText = null, laterApprovedByRecord = new Map() } = {}) {
  if (sourceText === null && !fs.existsSync(target.path)) throw new Error(`Missing target: ${target.path}`);
  const source = sourceText ?? fs.readFileSync(target.path, 'utf8');
  const hasBom = source.charCodeAt(0) === 0xfeff;
  const body = hasBom ? source.slice(1) : source;
  const entries = splitCsvRecordsWithDelimiters(body);
  if (entries.length === 0) throw new Error(`${target.path} is empty`);

  const header = parseRecord(entries[0].record, target.path);
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]));
  for (const field of ['record_id', 'insect_id', 'plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes']) {
    if (indexes[field] === undefined) throw new Error(`${target.path} is missing ${field}`);
  }

  const actions = new Map(audits.filter((audit) => audit.action !== 'none').map((audit) => [audit.recordId, audit]));
  const output = [entries[0]];
  const seenIds = new Set();
  const finalRows = new Map();
  let beforeCount = 0;
  let patchedFields = 0;
  let deletedRows = 0;
  let addedRows = 0;

  for (const entry of entries.slice(1)) {
    if (!entry.record) continue;
    const row = parseRecord(entry.record, target.path);
    const recordId = row[indexes.record_id];
    if (!recordId || seenIds.has(recordId)) throw new Error(`${target.path}: invalid or duplicate record_id ${recordId}`);
    seenIds.add(recordId);
    beforeCount += 1;
    const audit = actions.get(recordId);
    if (!audit) {
      output.push(entry);
      finalRows.set(recordId, row);
      continue;
    }
    for (const field of new Set([...Object.keys(audit.expected), ...Object.keys(audit.approved)])) {
      if (indexes[field] === undefined) throw new Error(`${audit.auditId}: ${target.path} is missing ${field}`);
    }
    if (row[indexes.insect_id] !== audit.currentInsectId) {
      throw new Error(`${audit.auditId}: ${target.collection} insect_id mismatch`);
    }

    const laterApproved = laterApprovedByRecord.get(recordId);
    if (laterApproved && matchesObject(row, indexes, laterApproved)) {
      output.push(entry);
      finalRows.set(recordId, row);
      continue;
    }

    if (audit.action === 'add') {
      if (!matchesObject(row, indexes, audit.approved)) {
        throw new Error(`${audit.auditId}: conflicting ${target.collection} add target already exists`);
      }
      output.push(entry);
      finalRows.set(recordId, row);
      continue;
    }
    if (audit.action === 'delete') {
      if (!matchesObject(row, indexes, audit.expected)) {
        throw new Error(`${audit.auditId}: unexpected ${target.collection} delete target`);
      }
      deletedRows += 1;
      continue;
    }

    let changed = false;
    for (const [field, expectedValue] of Object.entries(audit.expected)) {
      const approvedValue = audit.approved[field];
      const currentValue = row[indexes[field]] ?? '';
      if (currentValue === approvedValue) continue;
      if (currentValue !== expectedValue) {
        throw new Error(`${audit.auditId}: unexpected ${target.collection}.${field}=${JSON.stringify(currentValue)}`);
      }
      row[indexes[field]] = approvedValue;
      patchedFields += 1;
      changed = true;
    }
    output.push(changed
      ? { record: Papa.unparse([row], { newline: '' }), delimiter: entry.delimiter }
      : entry);
    finalRows.set(recordId, row);
  }

  const defaultDelimiter = entries.find((entry) => entry.delimiter)?.delimiter || '\n';
  for (const audit of actions.values()) {
    if (seenIds.has(audit.recordId)) continue;
    if (audit.action === 'add') {
      const row = header.map((field) => audit.approved[field] ?? '');
      const previous = output.at(-1);
      if (previous && !previous.delimiter) previous.delimiter = defaultDelimiter;
      output.push({ record: Papa.unparse([row], { newline: '' }), delimiter: defaultDelimiter });
      finalRows.set(audit.recordId, row);
      addedRows += 1;
      continue;
    }
    if (audit.action === 'delete') continue;
    throw new Error(`${audit.auditId}: required ${target.collection} patch target is missing`);
  }

  const text = `${hasBom ? '\ufeff' : ''}${output.map(({ record, delimiter }) => `${record}${delimiter}`).join('')}`;
  return {
    target,
    text,
    indexes,
    finalRows,
    beforeCount,
    afterCount: finalRows.size,
    patchedFields,
    deletedRows,
    addedRows,
  };
}

function validateFinalState(results, audits, laterApprovedByRecord = new Map()) {
  for (const result of results) {
    for (const audit of audits.filter((item) => item.action !== 'none')) {
      const row = result.finalRows.get(audit.recordId);
      if (audit.action === 'delete') {
        if (row) throw new Error(`${audit.auditId}: ${result.target.collection} deletion did not apply`);
        continue;
      }
      const finalApproved = laterApprovedByRecord.get(audit.recordId) ?? audit.approved;
      if (!row || !matchesObject(row, result.indexes, finalApproved)) {
        throw new Error(`${audit.auditId}: ${result.target.collection} did not reach approved state`);
      }
    }
  }
}

function writeAtomically(results) {
  const temporary = [];
  try {
    for (const result of results) {
      const temporaryPath = `${result.target.path}.ga-host-${process.pid}.tmp`;
      fs.writeFileSync(temporaryPath, result.text, 'utf8');
      temporary.push({ temporaryPath, destination: result.target.path });
    }
    for (const item of temporary) fs.renameSync(item.temporaryPath, item.destination);
  } finally {
    for (const item of temporary) fs.rmSync(item.temporaryPath, { force: true });
  }
}

const audits = readAudit();
const dedup = readDedupAudit();
const cleanup = readCleanupAudit();
const additionalDedup = readAdditionalDedupAudit();
verifyPdfHashes([
  ...audits,
  ...cleanup,
  ...dedup.actions,
  ...additionalDedup.filter((audit) => audit.verifyPdfHash),
]);
const laterApprovedByRecord = new Map([
  ...cleanup.filter((audit) => audit.action === 'patch'),
  ...dedup.actions.filter((audit) => audit.action === 'patch'),
  ...additionalDedup.filter((audit) => audit.action === 'patch'),
].map((audit) => [audit.recordId, audit.approved]));
const candidateResults = TARGETS.map((target) => transformCsv(
  target,
  audits,
  { laterApprovedByRecord },
));
const cleanupResults = candidateResults.map((candidateResult) => transformCsv(
  candidateResult.target,
  cleanup,
  { sourceText: candidateResult.text },
));
const dedupResults = cleanupResults.map((cleanupResult) => transformCsv(
  cleanupResult.target,
  dedup.actions,
  { sourceText: cleanupResult.text },
));
const results = dedupResults.map((dedupResult) => transformCsv(
  dedupResult.target,
  additionalDedup,
  { sourceText: dedupResult.text },
));
validateFinalState(results, audits, laterApprovedByRecord);
validateFinalState(results, cleanup);
validateFinalState(results, dedup.actions);
validateFinalState(results, additionalDedup);
if (!CHECK_ONLY) writeAtomically(results);

for (const result of results) {
  const candidateResult = candidateResults.find((item) => item.target.collection === result.target.collection);
  const cleanupResult = cleanupResults.find((item) => item.target.collection === result.target.collection);
  const dedupResult = dedupResults.find((item) => item.target.collection === result.target.collection);
  const addedRows = candidateResult.addedRows + cleanupResult.addedRows + dedupResult.addedRows + result.addedRows;
  const patchedFields = candidateResult.patchedFields + cleanupResult.patchedFields
    + dedupResult.patchedFields + result.patchedFields;
  const deletedRows = candidateResult.deletedRows + cleanupResult.deletedRows
    + dedupResult.deletedRows + result.deletedRows;
  console.log(
    `[ga-tsushin-hosts] ${result.target.collection}: ${candidateResult.beforeCount}->${result.afterCount} `
    + `added=${addedRows} patched_fields=${patchedFields} deleted=${deletedRows}`
    + `${CHECK_ONLY ? ' check-only' : ''}`,
  );
}
