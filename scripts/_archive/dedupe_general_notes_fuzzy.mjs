#!/usr/bin/env node
/**
 * Remove near-duplicate notes within general_notes.csv files by comparing
 * insect_id + note_type + reference + normalized(content).
 *
 * Normalization removes whitespace/punctuation and Hiragana while keeping Kanji,
 * Katakana, digits, and ASCII so that minor wording differences
 * (e.g. 「する」「〜」「,」) don't create duplicate rows.
 *
 * Preference order when duplicates are found:
 *   1. Record IDs starting with note-B* (newest imports)
 *   2. Record IDs starting with note-9*
 *   3. Record IDs starting with note-2*
 *   4. Others
 * Within the same tier, keep the longer content; if still tied, keep the
 * lexicographically smaller record_id.
 */
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const TARGETS = [
  path.join('public', 'general_notes.csv'),
  path.join('normalized_data', 'general_notes.csv'),
];
const REPORT_PATH = path.join('reports', 'general_notes_fuzzy_dedupe_report.json');

function readCsv(file) {
  const text = fs.readFileSync(file, 'utf8');
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: false });
  const rows = parsed.data.map(row => row || {});
  return { rows, header: parsed.meta.fields };
}

function writeCsv(file, rows) {
  const csv = Papa.unparse(rows, {
    columns: ['record_id', 'insect_id', 'note_type', 'content', 'reference', 'page', 'year'],
  });
  fs.writeFileSync(file, csv + '\n', 'utf8');
}

function priority(recordId = '') {
  if (/^note-b/i.test(recordId)) return 4;
  if (/^note-9/.test(recordId)) return 3;
  if (/^note-2/.test(recordId)) return 2;
  return 1;
}

function normalizeContent(content = '') {
  return content
    .normalize('NFKC')
    .replace(/[\s　]/g, '')
    .replace(/[、。，．,.，。!！?？；;：:〜～~\-‐‑−—–―]/g, '')
    .replace(/[「」『』（）()\[\]{}<>]/g, '')
    .replace(/[･・…‥]/g, '')
    .replace(/[\u3040-\u309F]/g, '') // strip Hiragana
    .trim();
}

function normalizeReference(reference = '') {
  return reference.normalize('NFKC').trim();
}

function choosePreferred(a, b) {
  const pa = priority(a.record_id);
  const pb = priority(b.record_id);
  if (pa !== pb) return pa > pb ? a : b;
  const lenA = (a.content || '').length;
  const lenB = (b.content || '').length;
  if (lenA !== lenB) return lenA >= lenB ? a : b;
  return a.record_id.localeCompare(b.record_id) <= 0 ? a : b;
}

function dedupe(rows) {
  const keyToIndex = new Map();
  const removedIds = new Set();
  const removedPairs = [];

  rows.forEach((row, idx) => {
    if (!row) return;
    const recordId = (row.record_id || '').trim();
    if (!recordId) return;
    const insectId = (row.insect_id || '').trim();
    const noteType = (row.note_type || '').trim();
    const reference = normalizeReference(row.reference || '');
    const content = (row.content || '').trim();
    if (!insectId || !noteType || !content) return;

    const norm = normalizeContent(content);
    if (!norm) return;
    const key = [insectId, noteType, reference || '(no-ref)', norm].join('|');
    if (!keyToIndex.has(key)) {
      keyToIndex.set(key, idx);
      return;
    }

    const existingIdx = keyToIndex.get(key);
    const existing = rows[existingIdx];
    const preferred = choosePreferred(existing, row);
    if (preferred === existing) {
      removedIds.add(recordId);
      removedPairs.push({
        removed: recordId,
        kept: existing.record_id,
        insect_id: insectId,
        note_type: noteType,
      });
    } else {
      removedIds.add(existing.record_id);
      removedPairs.push({
        removed: existing.record_id,
        kept: recordId,
        insect_id: insectId,
        note_type: noteType,
      });
      keyToIndex.set(key, idx);
    }
  });

  return { removedIds, removedPairs };
}

function main() {
  if (!fs.existsSync(TARGETS[0])) {
    console.error('public/general_notes.csv not found');
    process.exit(1);
  }

  const publicData = readCsv(TARGETS[0]);
  const { removedIds, removedPairs } = dedupe(publicData.rows);
  if (!removedIds.size) {
    console.log('No fuzzy duplicates detected.');
    return;
  }

  for (const file of TARGETS) {
    const { rows } = readCsv(file);
    const filtered = rows.filter(row => {
      if (!row || !row.record_id) return true;
      return !removedIds.has(row.record_id);
    });
    writeCsv(file, filtered);
    console.log(`${file}: ${rows.length} -> ${filtered.length} (removed ${rows.length - filtered.length})`);
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(
    REPORT_PATH,
    JSON.stringify(
      {
        removed_count: removedPairs.length,
        removed_records: removedPairs,
      },
      null,
      2
    )
  );
  console.log(`Fuzzy dedupe removed ${removedPairs.length} records. Report: ${REPORT_PATH}`);
}

main();
