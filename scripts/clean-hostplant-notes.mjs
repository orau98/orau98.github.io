#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Papa from 'papaparse';

import { getHostPlantNoteCleanup } from '../src/utils/publicHostPlantNotes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NORMALIZED_CSV = path.join(ROOT, 'normalized_data/hostplants.csv');
const PUBLIC_CSV = path.join(ROOT, 'public/hostplants.csv');
const AUDIT_CSV = path.join(ROOT, 'reports/hostplant-note-cleanup-20260711.csv');
const APPLY = process.argv.includes('--apply');

// These rows were labelled as European in notes even though their structured
// observation type was domestic. Nearby rows and the source grouping identify
// them as overseas records. Once corrected, the redundant note can be removed.
const OBSERVATION_TYPE_CORRECTIONS = new Map([
  ['hostplant-004211', '国外'],
  ['hostplant-004212', '国外'],
  ['hostplant-004213', '国外'],
  ['hostplant-004214', '国外'],
  ['hostplant-PDFAUDIT-20260710-0120', '野外（国外）'],
  ['hostplant-PDFAUDIT-20260710-0121', '野外（国外）'],
]);

const text = fs.readFileSync(NORMALIZED_CSV, 'utf8');
const newline = text.includes('\r\n') ? '\r\n' : '\n';
const trailingNewline = text.endsWith(newline);
const lines = text.split(newline);
if (trailingNewline) lines.pop();

const header = Papa.parse(lines[0]).data[0];
const columnIndex = Object.fromEntries(header.map((name, index) => [name, index]));
for (const required of ['record_id', 'insect_id', 'observation_type', 'notes']) {
  if (!(required in columnIndex)) {
    throw new Error(`normalized_data/hostplants.csv に必須列 ${required} がありません`);
  }
}

const changes = [];
const outputLines = [lines[0]];

for (const rawLine of lines.slice(1)) {
  const parsed = Papa.parse(rawLine);
  if (parsed.errors.length > 0 || parsed.data.length !== 1) {
    throw new Error(`hostplants.csv の行を解析できません: ${rawLine.slice(0, 120)}`);
  }

  const values = parsed.data[0];
  if (values.length !== header.length) {
    throw new Error(`hostplants.csv の列数が不正です: ${values[0] || '(record_id不明)'}`);
  }

  const recordId = values[columnIndex.record_id];
  const insectId = values[columnIndex.insect_id];
  const originalObservationType = values[columnIndex.observation_type] || '';
  const originalNotes = values[columnIndex.notes] || '';
  const cleanup = getHostPlantNoteCleanup(originalNotes);
  const correctedObservationType = OBSERVATION_TYPE_CORRECTIONS.get(recordId) || originalObservationType;

  const changed = cleanup.note !== originalNotes || correctedObservationType !== originalObservationType;
  if (changed) {
    values[columnIndex.observation_type] = correctedObservationType;
    values[columnIndex.notes] = cleanup.note;
    changes.push({
      record_id: recordId,
      insect_id: insectId,
      original_observation_type: originalObservationType,
      retained_observation_type: correctedObservationType,
      original_notes: originalNotes,
      retained_notes: cleanup.note,
      removed_segments: cleanup.removedSegments.join(' / '),
    });
    outputLines.push(Papa.unparse([values], { newline }));
  } else {
    outputLines.push(rawLine);
  }
}

console.log(`[clean-hostplant-notes] ${changes.length} row(s) require cleanup`);
if (!APPLY) {
  console.log('[clean-hostplant-notes] dry run; pass --apply to update the source CSVs');
  process.exit(0);
}

const output = `${outputLines.join(newline)}${trailingNewline ? newline : ''}`;
fs.writeFileSync(NORMALIZED_CSV, output, 'utf8');
fs.copyFileSync(NORMALIZED_CSV, PUBLIC_CSV);

if (changes.length > 0) {
  const previousAudit = fs.existsSync(AUDIT_CSV)
    ? Papa.parse(fs.readFileSync(AUDIT_CSV, 'utf8'), {
        header: true,
        skipEmptyLines: true,
      }).data
    : [];
  const mergedAudit = new Map(previousAudit.map((row) => [row.record_id, row]));
  for (const change of changes) {
    const previous = mergedAudit.get(change.record_id);
    if (!previous) {
      mergedAudit.set(change.record_id, change);
      continue;
    }
    const removedSegments = [previous.removed_segments, change.removed_segments]
      .filter(Boolean)
      .join(' / ');
    mergedAudit.set(change.record_id, {
      ...change,
      original_observation_type: previous.original_observation_type,
      original_notes: previous.original_notes,
      removed_segments: removedSegments,
    });
  }
  fs.writeFileSync(
    AUDIT_CSV,
    `${Papa.unparse([...mergedAudit.values()], { newline: '\n' })}\n`,
    'utf8',
  );
}

console.log('[clean-hostplant-notes] updated normalized_data/hostplants.csv and public/hostplants.csv');
console.log(`[clean-hostplant-notes] audit: ${path.relative(ROOT, AUDIT_CSV)}`);
