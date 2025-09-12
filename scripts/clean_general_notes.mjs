#!/usr/bin/env node
// Clean and deduplicate general_notes.csv
// - Fix malformed quoted contents (e.g., ""通年, -> 通年)
// - Drop invalid emergence-time contents like a bare year (e.g., 1925))
// - Deduplicate identical (insect_id, note_type, normalized content)
// - Produce a report under reports/

import fs from 'fs';
import path from 'path';

const INPUTS = process.argv.slice(2);
const targets = INPUTS.length > 0
  ? INPUTS
  : [
      path.join('public', 'general_notes.csv'),
      path.join('normalized_data', 'general_notes.csv'),
    ];

const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

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
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { out.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out;
}

function normalizeContent(s) {
  let c = (s || '').toString();
  // Remove enclosing stray quotes and duplicated quotes
  c = c.replace(/^"+|"+$/g, '');
  c = c.replace(/""/g, '"');
  // Remove trailing commas inside content, collapse whitespace
  c = c.replace(/,+$/g, '');
  c = c.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return c;
}

function isEmergenceType(t) {
  const tt = (t || '').toString();
  return tt.includes('出現時期') || tt.includes('成虫発生時期') || tt.includes('発生時期') || tt.includes('出現');
}

function looksLikeValidEmergenceContent(c) {
  const s = (c || '').toString();
  if (!s) return false;
  const timeLike = /\d+\s*月|春|夏|秋|冬|上旬|中旬|下旬|頃/.test(s);
  return timeLike;
}

function processFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`skip: ${filePath} (not found)`);
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = raw.split('\n');
  if (!lines.length) return null;

  const headerTokens = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const idxRecord = headerTokens.indexOf('record_id');
  const idxInsect = headerTokens.indexOf('insect_id');
  const idxType = headerTokens.indexOf('note_type');
  const idxContent = headerTokens.indexOf('content');
  const idxRef = headerTokens.indexOf('reference');
  const idxPage = headerTokens.indexOf('page');
  const idxYear = headerTokens.indexOf('year');

  const outRecords = [];
  const report = { file: filePath, totalIn: lines.length - 1, droppedInvalidEmergence: 0, fixedQuoted: 0, duplicatesRemoved: 0, anomalies: [] };
  const seen = new Set();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const qCount = (line.match(/\"/g) || []).length;
    const cols = parseCsvLine(line).map(s => (s || '').trim());
    const record_id = idxRecord >= 0 ? cols[idxRecord] : cols[0] || '';
    const insect_id = idxInsect >= 0 ? cols[idxInsect] : cols[1] || '';
    const note_type = idxType >= 0 ? cols[idxType] : cols[2] || '';
    let content = idxContent >= 0 ? cols[idxContent] : cols[3] || '';
    let reference = idxRef >= 0 ? cols[idxRef] : cols[4] || '';
    const page = idxPage >= 0 ? cols[idxPage] : '';
    const year = idxYear >= 0 ? cols[idxYear] : '';

    let normalized = normalizeContent(content);
    if (normalized !== content) {
      report.fixedQuoted++;
      content = normalized;
    }

    // Drop obviously invalid emergence-time contents (e.g., just a year with parenthesis)
    if (isEmergenceType(note_type) && !looksLikeValidEmergenceContent(content)) {
      // e.g., "1925)" or empty after cleanup
      report.droppedInvalidEmergence++;
      report.anomalies.push({ line: i + 1, insect_id, note_type, content, reason: 'invalid_emergence_content' });
      continue;
    }

    // Normalize duplicate detection key
    const key = [insect_id, note_type, content].join('|');
    if (seen.has(key)) {
      report.duplicatesRemoved++;
      report.anomalies.push({ line: i + 1, insect_id, note_type, content, reason: 'duplicate' });
      continue;
    }
    seen.add(key);

    // Ensure reference/page/year keep quotes normalized
    const cleanRef = normalizeContent(reference);

    outRecords.push({ record_id, insect_id, note_type, content, reference: cleanRef, page, year });
  }

  // Write backup and cleaned file
  const backupPath = filePath + '.bak.' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  fs.copyFileSync(filePath, backupPath);

  const header = ['record_id','insect_id','note_type','content','reference','page','year'].join(',');
  const outCsv = [header, ...outRecords.map(r => {
    const esc = (s) => {
      const str = (s ?? '').toString();
      if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
      return str;
    };
    return [r.record_id, r.insect_id, r.note_type, r.content, r.reference, r.page, r.year].map(esc).join(',');
  })].join('\n') + '\n';
  fs.writeFileSync(filePath, outCsv);

  return report;
}

ensureDir('reports');
const reports = [];
for (const t of targets) {
  const rep = processFile(t);
  if (rep) reports.push(rep);
}

const summaryPath = path.join('reports', 'general_notes_cleanup_report.json');
fs.writeFileSync(summaryPath, JSON.stringify(reports, null, 2));
console.log('Cleanup complete. Report written to', summaryPath);
