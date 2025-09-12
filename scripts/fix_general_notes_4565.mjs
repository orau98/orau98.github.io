#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const targetFiles = [
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

function fixFile(fp) {
  const raw = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = raw.split('\n');
  const out = [];
  const header = lines[0];
  out.push(header);

  // We'll accumulate cleaned 4565 lines
  let addedCleanLine = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    // basic sanity
    if (cols.length < 4) { out.push(line); continue; }
    const record_id = cols[0];
    const insect_id = cols[1];
    const note_type = cols[2];
    const content = cols[3];

    if (insect_id === 'species-4565') {
      // Drop invalid emergence content '1925)'
      if (note_type.includes('出現') && content.trim() === '1925)') {
        continue; // drop
      }
      // Skip broken duplicated 通年 lines; we'll add one clean line later
      if (note_type.includes('生態') && content.includes('通年')) {
        // skip both malformed lines
        continue;
      }
    }

    out.push(line);
  }

  // Append a single cleaned 生態情報 line for species-4565
  // Try to reuse one of the original record_ids if present; default to note-999229
  let cleanRecordId = 'note-999229';
  const orig = raw.match(/^(note-\d+),species-4565,生態情報/m);
  if (orig) cleanRecordId = orig[1];
  out.push([cleanRecordId, 'species-4565', '生態情報', '通年', '日本産蛾類標準図鑑2', '', ''].join(','));

  const backup = fp + '.bak.fix4565.' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
  fs.copyFileSync(fp, backup);
  fs.writeFileSync(fp, out.join('\n') + '\n');
  return { file: fp, backup };
}

const results = targetFiles.map(fixFile);
console.log('Fixed species-4565 duplicates and invalid emergence entry in:', results);
