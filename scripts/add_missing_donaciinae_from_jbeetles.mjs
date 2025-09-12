#!/usr/bin/env node
// Add missing Donaciinae (ネクイハムシ亜科) species into public/insects.csv
// using reports/jbeetles_chrysomelidae_map.json as authoritative list.

import fs from 'fs';
import path from 'path';

const INSECTS = path.join('public', 'insects.csv');
const MAP = path.join('reports', 'jbeetles_chrysomelidae_map.json');

function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === '"') { if (line[i+1] === '"') { cur += '"'; i++; } else { q = false; } } else cur += ch; }
    else { if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
  }
  out.push(cur);
  return out;
}

function csvEscape(s) {
  const str = (s ?? '').toString();
  return /[",\n]/.test(str) ? '"' + str.replace(/"/g, '""') + '"' : str;
}

const headerExpected = ['insect_id','family','family_jp','subfamily','subfamily_jp','tribe','tribe_jp','genus','subgenus','species','subspecies','author','year','japanese_name','old_japanese_name','alternative_name','other_names','scientific_name','synonyms','changes_since_standard','notes'];

function loadInsects(fp) {
  const raw = fs.readFileSync(fp, 'utf-8').replace(/\r\n?|\n/g, '\n');
  const lines = raw.split('\n');
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i=1;i<lines.length;i++) {
    const line = lines[i]; if (!line || !line.trim()) continue;
    const cols = parseCsvLine(line);
    rows.push(cols);
  }
  return { header, rows };
}

function getMaxHId(rows) {
  let max = 0;
  for (const r of rows) {
    const id = r[0] || '';
    const m = id.match(/^species-H(\d+)/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  }
  return max;
}

function existsInInsects(rows, genus, species, subspecies) {
  for (const r of rows) {
    if ((r[7]||'').trim() === genus && (r[9]||'').trim() === species && (r[10]||'').trim() === (subspecies||'')) return true;
  }
  return false;
}

function main() {
  const map = JSON.parse(fs.readFileSync(MAP, 'utf-8'));
  const items = map.byJa.map(([ja,obj]) => ({ ja, ...obj }));
  const targets = items.filter(x => x.genus === 'Donacia' || x.genus === 'Plateumaris');

  const { header, rows } = loadInsects(INSECTS);
  // Sanity: header length align
  if (header.length !== headerExpected.length) {
    console.warn('Header length mismatch. Proceeding but fields may misalign.');
  }
  let maxH = getMaxHId(rows);
  const toAppend = [];

  for (const t of targets) {
    const genus = (t.genus||'').trim();
    // species may include subspecies, split by space
    const parts = (t.species||'').trim().split(/\s+/).filter(Boolean);
    const species = parts[0] || '';
    const subspecies = parts.length > 1 ? parts.slice(1).join(' ') : '';
    const jp = (t.jp || t.ja || '').trim();
    const subgenus = (t.subgenus || '').trim();
    const author = (t.author || '').replace(/&amp;/g,'&').trim();
    const year = (t.year || '').trim();

    if (!genus || !species || !jp) continue; // insufficient data
    if (existsInInsects(rows, genus, species, subspecies)) continue; // already present

    // Compose insect row
    maxH += 1;
    const insect_id = `species-H${maxH}`;
    const family = 'Chrysomelidae';
    const family_jp = 'ハムシ科';
    const subfamily = 'Donaciinae';
    const subfamily_jp = 'ネクイハムシ亜科';
    const tribe = 'Donaciini';
    const tribe_jp = 'ネクイハムシ族';
    const scientific_name = [genus, species, subspecies].filter(Boolean).join(' ') + (author || year ? ` ${author}${year?`, ${year}`:''}` : '');

    const row = [
      insect_id,
      family,
      family_jp,
      subfamily,
      subfamily_jp,
      tribe,
      tribe_jp,
      genus,
      subgenus,
      species,
      subspecies,
      author,
      year,
      jp,
      '',
      '',
      '',
      scientific_name,
      '',
      year,
      ''
    ];
    toAppend.push(row);
  }

  if (toAppend.length === 0) {
    console.log('No missing Donaciinae species to add.');
    return;
  }

  // Append to CSV with backup
  const backup = INSECTS + '.bak.add_donaciinae_' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  fs.copyFileSync(INSECTS, backup);
  const payload = toAppend.map(r => r.map(csvEscape).join(',')).join('\n') + '\n';
  fs.appendFileSync(INSECTS, payload);
  console.log(`Appended ${toAppend.length} Donaciinae rows. Backup: ${backup}`);
}

main();

