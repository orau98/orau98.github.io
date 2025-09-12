#!/usr/bin/env node
// Sort public/insects.csv rows by insect_id in a stable, human-friendly order.
// Order: numeric species-#### ascending, then H-prefixed (species-H###),
// then CR, LB, then other prefixes alphabetically; within each, numeric ascending.

import fs from 'fs';
import path from 'path';

const FILE = path.join('public', 'insects.csv');
const REPORT = path.join('reports', 'insects_sort_report.txt');

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { q = false; }
      } else cur += ch;
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function keyFor(id) {
  const m = (id || '').match(/^species-([A-Za-z]*)(\d+)/);
  if (!m) return { group: 99, prefix: 'ZZ', num: Number.MAX_SAFE_INTEGER, raw: id };
  const prefix = m[1] || '';
  const num = parseInt(m[2], 10) || 0;
  const groupOrder = {
    '': 0,       // pure numeric species-####
    'H': 1,      // leaf beetles unified prefix
    'CR': 2,     // legacy Criocerinae
    'LB': 3      // legacy Leaf Beetle
  };
  const group = groupOrder.hasOwnProperty(prefix) ? groupOrder[prefix] : 9;
  return { group, prefix: prefix || '', num, raw: id };
}

function main() {
  if (!fs.existsSync(FILE)) {
    console.error('File not found:', FILE);
    process.exit(1);
  }
  const raw = fs.readFileSync(FILE, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = raw.split('\n');
  if (lines.length < 2) {
    console.log('Nothing to sort.');
    return;
  }
  const header = lines[0];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;
    const cols = parseCsvLine(line);
    const id = (cols[0] || '').trim();
    if (!id) continue; // skip malformed
    rows.push({ id, line, oldIndex: i + 1 });
  }

  const sorted = rows.slice().sort((a, b) => {
    const ka = keyFor(a.id);
    const kb = keyFor(b.id);
    if (ka.group !== kb.group) return ka.group - kb.group;
    if (ka.prefix !== kb.prefix) return ka.prefix.localeCompare(kb.prefix);
    if (ka.num !== kb.num) return ka.num - kb.num;
    return ka.raw.localeCompare(kb.raw);
  });

  if (sorted.length === 0) {
    console.log('No data rows to sort.');
    return;
  }

  // Backup and write
  const backup = FILE + '.bak.sort_' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  fs.copyFileSync(FILE, backup);
  const out = [header, ...sorted.map(r => r.line)].join('\n') + '\n';
  fs.writeFileSync(FILE, out);

  // Write a brief report (moved positions)
  const reportLines = [];
  reportLines.push(`Sorted ${sorted.length} rows by insect_id. Backup: ${backup}`);
  reportLines.push('First 30 IDs after sort:');
  for (let i = 0; i < Math.min(30, sorted.length); i++) {
    reportLines.push(`${i + 2}: ${sorted[i].id}`);
  }
  reportLines.push('Last 30 IDs after sort:');
  for (let i = Math.max(0, sorted.length - 30); i < sorted.length; i++) {
    reportLines.push(`${i + 2}: ${sorted[i].id}`);
  }
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, reportLines.join('\n') + '\n');
  console.log(reportLines.slice(0, 3).join('\n'));
}

main();

