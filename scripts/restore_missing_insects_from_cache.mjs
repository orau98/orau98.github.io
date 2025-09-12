#!/usr/bin/env node
// Restore missing insect rows into public/insects.csv from cache/insects-csv/v1.csv
// Targets are inferred from reports/pruned_unknown_insect_refs.csv (unique insect_id values)

import fs from 'fs';
import path from 'path';

const PUBLIC_INSECTS = path.join('public', 'insects.csv');
const CACHE_INSECTS = path.join('cache', 'insects-csv', 'v1.csv');
const PRUNED_REPORT = path.join('reports', 'pruned_unknown_insect_refs.csv');

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

function getMissingIdsFromReport(fp) {
  if (!fs.existsSync(fp)) return [];
  const text = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = text.split('\n');
  const header = lines[0]?.split(',') || [];
  const idx = header.indexOf('insect_id');
  const ids = new Set();
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = parseCsvLine(line);
    const id = (cols[idx] || '').trim();
    if (id) ids.add(id);
  }
  return Array.from(ids);
}

function loadCacheRowsById(fp) {
  const map = new Map();
  if (!fs.existsSync(fp)) throw new Error('Cache insects CSV not found: ' + fp);
  const text = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = text.split('\n');
  const header = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const id = parseCsvLine(line)[0]?.trim();
    if (id) map.set(id, line);
  }
  return { header, map };
}

function loadExistingIds(fp) {
  const ids = new Set();
  if (!fs.existsSync(fp)) throw new Error('Public insects CSV not found: ' + fp);
  const text = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = text.split('\n');
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const id = parseCsvLine(line)[0]?.trim();
    if (id) ids.add(id);
  }
  return ids;
}

function main() {
  const targetIds = getMissingIdsFromReport(PRUNED_REPORT);
  if (targetIds.length === 0) {
    console.log('No target IDs found (report missing or empty). Nothing to restore.');
    return;
  }
  const existing = loadExistingIds(PUBLIC_INSECTS);
  const { map: cacheMap } = loadCacheRowsById(CACHE_INSECTS);

  const toAppend = [];
  const notFound = [];
  for (const id of targetIds) {
    if (existing.has(id)) continue; // already present
    const row = cacheMap.get(id);
    if (row) toAppend.push(row);
    else notFound.push(id);
  }

  if (toAppend.length === 0) {
    console.log('All target IDs already present; nothing to append. Missing in cache:', notFound);
    return;
  }

  const backupPath = PUBLIC_INSECTS + '.bak.restore_' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  fs.copyFileSync(PUBLIC_INSECTS, backupPath);

  // Ensure file ends with a newline before appending
  const existingBuf = fs.readFileSync(PUBLIC_INSECTS);
  const endsWithNewline = existingBuf.length > 0 && (existingBuf[existingBuf.length - 1] === 0x0a);
  let payload = toAppend.map(l => (l.endsWith('\n') ? l : l + '\n')).join('');
  if (!endsWithNewline) payload = '\n' + payload;
  fs.appendFileSync(PUBLIC_INSECTS, payload);
  console.log(`Appended ${toAppend.length} insects from cache. Backup: ${backupPath}`);
  if (notFound.length) console.log('IDs not found in cache:', notFound.join(', '));
}

main();
