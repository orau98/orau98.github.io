import assert from 'node:assert/strict';
import fs from 'node:fs';
import Papa from 'papaparse';

const auditPath = new URL('../../data/source_audits/general-note-redundancy-recheck-2026-11-27.csv', import.meta.url);
const parsed = Papa.parse(fs.readFileSync(auditPath, 'utf8'), { header: true, skipEmptyLines: true });
assert.deepEqual(parsed.errors, []);
export const redundancyAudit = parsed.data;

export function notesBeforeRedundancyAudit(notes) {
  const previous = new Map(notes);
  for (const entry of redundancyAudit) {
    previous.set(entry.record_id, {
      record_id: entry.record_id,
      insect_id: entry.insect_id,
      note_type: entry.previous_note_type,
      content: entry.previous_content,
      reference: entry.reference,
      page: entry.previous_page,
      year: entry.previous_year,
    });
  }
  return previous;
}
