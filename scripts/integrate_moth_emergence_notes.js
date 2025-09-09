#!/usr/bin/env node
/*
  Integrate moth emergence notes (日本産蛾類標準図鑑1) into normalized_data/general_notes.csv
  - Input: tmp/moth_emergence_notes_book1.csv (custom parsing: ja name, quoted sci name, period, remarks)
  - Output: append to normalized_data/general_notes.csv with note_type '出現時期' and '生態情報'
  - Unmatched lines written to reports/unmatched_moth_emergence_book1.csv
*/
import fs from 'node:fs';
import path from 'node:path';

const INSECTS_CSV = path.join('normalized_data', 'insects.csv');
const NOTES_CSV = path.join('normalized_data', 'general_notes.csv');
const INPUT_CSV = path.join('tmp', 'moth_emergence_notes_book1.csv');
const REPORT_DIR = 'reports';
const UNMATCHED_REPORT = path.join(REPORT_DIR, 'unmatched_moth_emergence_book1.csv');
const REFERENCE = '日本産蛾類標準図鑑1';

function readFileLines(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n?|\n/g, '\n').split('\n');
}

function parseCsvLine(line) {
  // Generic CSV parser with quotes; returns array of fields
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { // escaped quote
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

function normalizeSpaces(s) {
  return s.replace(/\s+/g, ' ').trim();
}

function buildInsectMaps() {
  const lines = readFileLines(INSECTS_CSV);
  const header = parseCsvLine(lines[0]);
  const idx = {
    insect_id: header.indexOf('insect_id'),
    japanese_name: header.indexOf('japanese_name'),
    scientific_name: header.indexOf('scientific_name'),
    old_japanese_name: header.indexOf('old_japanese_name'),
    alternative_name: header.indexOf('alternative_name'),
  };
  if (idx.insect_id < 0 || idx.japanese_name < 0 || idx.scientific_name < 0) {
    throw new Error('insects.csv header missing required columns');
  }
  const byJa = new Map();
  const byJaOld = new Map();
  const byJaAlt = new Map();
  const bySciFull = new Map();
  const byGenusSpecies = new Map();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = parseCsvLine(line);
    const insectId = cols[idx.insect_id];
    const ja = cols[idx.japanese_name] ? cols[idx.japanese_name].trim() : '';
    const jaOld = idx.old_japanese_name >= 0 && cols[idx.old_japanese_name] ? cols[idx.old_japanese_name].trim() : '';
    const jaAlt = idx.alternative_name >= 0 && cols[idx.alternative_name] ? cols[idx.alternative_name].trim() : '';
    const sci = cols[idx.scientific_name] ? cols[idx.scientific_name].trim().replace(/^"|"$/g, '') : '';
    if (ja) byJa.set(ja, insectId);
    if (jaOld) byJaOld.set(jaOld, insectId);
    if (jaAlt) {
      // alternative_name may contain multiple names separated by delimiters
      const parts = jaAlt.split(/[、,;；]/).map(s => s.trim()).filter(Boolean);
      if (parts.length === 0) {
        byJaAlt.set(jaAlt, insectId);
      } else {
        for (const p of parts) byJaAlt.set(p, insectId);
      }
    }
    if (sci) {
      bySciFull.set(sci, insectId);
      const gs = extractGenusSpecies(sci);
      if (gs) {
        const arr = byGenusSpecies.get(gs) || [];
        arr.push(insectId);
        byGenusSpecies.set(gs, arr);
      }
    }
  }
  return { byJa, byJaOld, byJaAlt, bySciFull, byGenusSpecies };
}

function extractGenusSpecies(sciName) {
  // Extract first two tokens that look like Genus species, ignoring subgenus parentheses
  if (!sciName) return '';
  const cleaned = sciName.replace(/\([^)]*\)/g, '').trim();
  const tokens = cleaned.split(/\s+/);
  if (tokens.length >= 2) {
    return `${tokens[0]} ${tokens[1]}`;
  }
  return '';
}

function loadExistingNotes() {
  const lines = readFileLines(NOTES_CSV);
  const header = parseCsvLine(lines[0]);
  const idx = {
    record_id: header.indexOf('record_id'),
    insect_id: header.indexOf('insect_id'),
    note_type: header.indexOf('note_type'),
    content: header.indexOf('content'),
    reference: header.indexOf('reference'),
  };
  let maxNum = 0;
  const existing = new Set();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const cols = parseCsvLine(line);
    const rid = cols[idx.record_id] || '';
    const insectId = cols[idx.insect_id] || '';
    const noteType = cols[idx.note_type] || '';
    const content = cols[idx.content] || '';
    const ref = cols[idx.reference] || '';
    existing.add(`${insectId}|${noteType}|${content}|${ref}`);
    const m = /^note-(\d+)/.exec(rid);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  return { header, existing, maxNum };
}

function nextRecordIdFactory(start) {
  let cur = start;
  return () => {
    cur += 1;
    return `note-${String(cur).padStart(6, '0')}`;
  };
}

function parseInputLine(line) {
  // Custom parser for the provided format: jaName, "sciName", period, remarks
  // Period may contain commas; we split using the last comma after the closing quote
  if (!line.trim()) return null;
  const firstComma = line.indexOf(',');
  if (firstComma < 0) return null;
  const rawJa = line.slice(0, firstComma).trim();
  const ja = normalizeJaName(rawJa);
  const firstQuote = line.indexOf('"', firstComma + 1);
  const secondQuote = firstQuote >= 0 ? line.indexOf('"', firstQuote + 1) : -1;
  if (firstQuote < 0 || secondQuote < 0) {
    // Fallback for unquoted scientific names containing commas.
    // Strategy: split by comma, then find the first segment that looks like a period field (contains 月/不明/季節/年/上中下旬 等)。
    const cols = line.split(',');
    const parts = cols.map(s => s.trim());
    const ja2 = normalizeJaName(parts[0] || '');
    // Find index of period field among parts[1..]
    const looksLikePeriod = (s) => {
      if (!s) return false;
      // Detect typical period tokens (avoid matching plain years like "1881)" by excluding bare digits)
      return /(\d+\s*[~〜]?\s*\d*\s*月)|月|不明|春|夏|秋|冬|年間|上旬|中旬|下旬|頃|日|〜|~/.test(s);
    };
    let k = -1;
    for (let i = 1; i < parts.length; i++) {
      if (looksLikePeriod(parts[i])) { k = i; break; }
    }
    if (k === -1) {
      // As a very last resort, merge into 4 columns
      const sci2 = (parts[1] || '').replace(/^"|"$/g, '').trim();
      const period2 = parts[2] || '';
      const remarks2 = parts.slice(3).join(',');
      return { ja: ja2, sci: sci2, period: period2, remarks: remarks2 };
    }
    const sci2 = parts.slice(1, k).join(',').replace(/^"|"$/g, '').trim();
    const period2 = parts[k] || '';
    const remarks2 = parts.slice(k + 1).join(',');
    return { ja: ja2, sci: sci2, period: period2, remarks: (remarks2 || '').trim() };
  }
  const sci = line.slice(firstQuote + 1, secondQuote).trim();
  let rest = line.slice(secondQuote + 1);
  if (rest.startsWith(',')) rest = rest.slice(1);
  const lastComma = rest.lastIndexOf(',');
  let period = '';
  let remarks = '';
  if (lastComma >= 0) {
    period = rest.slice(0, lastComma).trim();
    remarks = rest.slice(lastComma + 1).trim();
  } else {
    period = rest.trim();
  }
  period = period.replace(/^"|"$/g, '').trim();
  remarks = remarks.replace(/^"|"$/g, '').trim();
  return { ja, sci, period, remarks };
}

function normalizeJaName(name) {
  if (!name) return name;
  // Fix common OCR/encoding typos: Cyrillic 'да' -> Katakana 'ダ'
  return name.replace(/да/g, 'ダ');
}

function csvEscape(s) {
  if (s == null) return '';
  const needsQuote = /[",\n]/.test(s);
  let v = s.replace(/"/g, '""');
  return needsQuote ? `"${v}"` : v;
}

function sanitizeInline(s) {
  if (s == null) return '';
  let t = String(s);
  t = t.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (t === '"') return '';
  return t;
}

function main() {
  if (!fs.existsSync(INPUT_CSV)) {
    console.error(`Input not found: ${INPUT_CSV}`);
    process.exit(1);
  }
  const { byJa, byJaOld, byJaAlt, bySciFull, byGenusSpecies } = buildInsectMaps();
  const { header, existing, maxNum } = loadExistingNotes();
  const nextId = nextRecordIdFactory(maxNum);

  const inputLines = readFileLines(INPUT_CSV);
  // Skip header
  const dataLines = inputLines.slice(1).filter(l => l.trim().length > 0);

  const rowsToAppend = [];
  const unmatched = [];

  for (const line of dataLines) {
    const rec = parseInputLine(line);
    if (!rec) continue;
    const jaKey = rec.ja;
    const sciKey = rec.sci;

    let insectId = byJa.get(jaKey) || byJaOld.get(jaKey) || byJaAlt.get(jaKey);
    if (!insectId && sciKey) insectId = bySciFull.get(sciKey);
    if (!insectId && sciKey) {
      const gs = extractGenusSpecies(sciKey);
      const arr = byGenusSpecies.get(gs) || [];
      if (arr.length === 1) insectId = arr[0];
    }

    if (!insectId) {
      unmatched.push({ ja: jaKey, sci: sciKey, period: rec.period, remarks: rec.remarks });
      continue;
    }

    const period = sanitizeInline(rec.period || '');
    const remarks = sanitizeInline(rec.remarks || '');

    // 出現時期ノート
    if (period) {
      const content = period;
      const key = `${insectId}|出現時期|${content}|${REFERENCE}`;
      if (!existing.has(key)) {
        const rid = nextId();
        rowsToAppend.push({
          record_id: rid,
          insect_id: insectId,
          note_type: '出現時期',
          content,
          reference: REFERENCE,
          page: '',
          year: ''
        });
        existing.add(key);
      }
    }

    // 備考は生態情報として格納
    if (remarks) {
      const content = remarks;
      const key = `${insectId}|生態情報|${content}|${REFERENCE}`;
      if (!existing.has(key)) {
        const rid = nextId();
        rowsToAppend.push({
          record_id: rid,
          insect_id: insectId,
          note_type: '生態情報',
          content,
          reference: REFERENCE,
          page: '',
          year: ''
        });
        existing.add(key);
      }
    }
  }

  if (rowsToAppend.length === 0 && unmatched.length === 0) {
    console.log('No new notes to append.');
    return;
  }

  // Append to general_notes.csv
  const headerLine = header.join(',');
  const linesOut = rowsToAppend.map(r => [
    r.record_id,
    r.insect_id,
    r.note_type,
    csvEscape(r.content),
    csvEscape(r.reference),
    csvEscape(r.page),
    csvEscape(r.year)
  ].join(','));

  fs.appendFileSync(NOTES_CSV, '\n' + linesOut.join('\n'));
  console.log(`Appended ${rowsToAppend.length} rows to ${NOTES_CSV}`);

  // Write unmatched report
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportHeader = '和名,学名,成虫発生時期,備考\n';
  const reportLines = unmatched.map(u => [csvEscape(sanitizeInline(u.ja)), csvEscape(sanitizeInline(u.sci)), csvEscape(sanitizeInline(u.period)), csvEscape(sanitizeInline(u.remarks))].join(','));
  fs.writeFileSync(UNMATCHED_REPORT, reportHeader + reportLines.join('\n'));
  console.log(`Unmatched: ${unmatched.length}. Report: ${UNMATCHED_REPORT}`);
}

main();
