#!/usr/bin/env node
// Audit general_notes.csv files for duplicates and anomalies without modifying data
import fs from 'fs';
import path from 'path';

const files = [
  path.join('public', 'general_notes.csv'),
  path.join('normalized_data', 'general_notes.csv')
];

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function norm(s) {
  return (s || '').toString().replace(/^\"+|\"+$/g, '').replace(/\"\"/g, '"').replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

const summary = [];
const dupReport = [];
const anomalyReport = [];

for (const fp of files) {
  if (!fs.existsSync(fp)) { summary.push({ file: fp, missing: true }); continue; }
  const raw = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = raw.split('\n');
  const header = parseCsvLine(lines[0]).map(h => h.replace(/^\"|\"$/g, '').trim());
  const idx = {
    record_id: header.indexOf('record_id'),
    insect_id: header.indexOf('insect_id'),
    note_type: header.indexOf('note_type'),
    content: header.indexOf('content'),
    reference: header.indexOf('reference'),
    page: header.indexOf('page'),
    year: header.indexOf('year')
  };

  const seen = new Map();
  let dups = 0, malformed = 0;
  const dupPerSpecies = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = parseCsvLine(line);
    if (cols.length < 4) { malformed++; anomalyReport.push({ file: fp, line: i+1, reason: 'too_few_columns', raw: line }); continue; }
    const insect_id = norm(cols[idx.insect_id >= 0 ? idx.insect_id : 1]);
    const note_type = norm(cols[idx.note_type >= 0 ? idx.note_type : 2]);
    const content = norm(cols[idx.content >= 0 ? idx.content : 3]);
    const record_id = norm(cols[idx.record_id >= 0 ? idx.record_id : 0]);

    // malformed content patterns
    if (/^""/.test(cols[idx.content >= 0 ? idx.content : 3]) || /,\s*$/.test(cols[idx.content >= 0 ? idx.content : 3])) {
      malformed++;
      anomalyReport.push({ file: fp, line: i+1, insect_id, note_type, content_raw: cols[idx.content >= 0 ? idx.content : 3], reason: 'broken_quotes_or_trailing_comma' });
    }

    const key = `${insect_id}|${note_type}|${content}`;
    if (!seen.has(key)) {
      seen.set(key, { firstRecord: record_id, firstLine: i+1, count: 1 });
    } else {
      const entry = seen.get(key); entry.count++;
      dups++; dupReport.push({ file: fp, insect_id, note_type, content, firstRecord: entry.firstRecord, firstLine: entry.firstLine, dupRecord: record_id, dupLine: i+1 });
      dupPerSpecies.set(insect_id, (dupPerSpecies.get(insect_id) || 0) + 1);
    }
  }

  // top species by duplicates
  const top = Array.from(dupPerSpecies.entries()).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([id,c])=>({ insect_id:id, duplicates:c }));
  summary.push({ file: fp, total_lines: lines.length-1, duplicates: dups, malformed, top_species_by_duplicates: top });
}

const outDir = 'reports'; if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'general_notes_audit_summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, 'general_notes_duplicates.json'), JSON.stringify(dupReport.slice(0, 2000), null, 2));
fs.writeFileSync(path.join(outDir, 'general_notes_anomalies.json'), JSON.stringify(anomalyReport.slice(0, 2000), null, 2));
console.log('Audit complete. See reports/general_notes_audit_summary.json');
