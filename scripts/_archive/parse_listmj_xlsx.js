// Minimal XLSX parser for ListMJ3-210603DL.xlsx using XML files (no external deps)
// - Reads xl/sharedStrings.xml and xl/worksheets/sheet1.xml
// - Produces a JSON array of rows with header keys
// Usage: node scripts/parse_listmj_xlsx.js ListMJ3-210603DL.xlsx > tmp_listmj.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const xlsxPath = process.argv[2] || path.join(process.cwd(), 'ListMJ3-210603DL.xlsx');
const tmpDir = path.join(process.cwd(), 'tmp_xlsx_cli');
try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
fs.mkdirSync(tmpDir, { recursive: true });

// Unzip xlsx
execSync(`unzip -q ${JSON.stringify(xlsxPath)} -d ${JSON.stringify(tmpDir)}`);

const sharedStringsXml = fs.readFileSync(path.join(tmpDir, 'xl', 'sharedStrings.xml'), 'utf-8');
const sheetXml = fs.readFileSync(path.join(tmpDir, 'xl', 'worksheets', 'sheet1.xml'), 'utf-8');

// Parse shared strings: each <si> may have multiple <t> nodes (rich text)
const siBlocks = sharedStringsXml.split(/<si\b[^>]*>/).slice(1).map(s => s.split(/<\/si>/)[0]);
const shared = siBlocks.map(block => {
  // Extract all <t>...</t> (preserve spaces inside)
  const texts = Array.from(block.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)).map(m => m[1]);
  const combined = texts.join('');
  // Unescape XML entities
  return combined
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r?\n/g, ' ')
    .trim();
});

// Helper: convert column letters to index (A->1, B->2 ...)
const colToIndex = (col) => {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + (col.charCodeAt(i) - 64);
  }
  return n;
};

// Parse sheet rows
const rowBlocks = sheetXml.split(/<row\b[^>]*>/).slice(1).map(s => s.split(/<\/row>/)[0]);
const rows = rowBlocks.map(block => {
  const cells = Array.from(block.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)).map(m => {
    const attrs = m[1];
    const body = m[2];
    const r = (attrs.match(/\br=\"([A-Z]+\d+)\"/) || [])[1] || '';
    const t = (attrs.match(/\bt=\"([^"]+)\"/) || [])[1] || '';
    const v = (body.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
    let value = '';
    if (typeof v === 'string') {
      if (t === 's') {
        const idx = parseInt(v, 10);
        value = shared[idx] ?? '';
      } else {
        value = v;
      }
    }
    // cell reference r like A1 -> col letters
    const col = r.replace(/\d+/g, '');
    return { col, index: colToIndex(col), value };
  });
  // Sort by column index and return array of values
  cells.sort((a, b) => a.index - b.index);
  return cells.map(c => c.value);
});

// Determine header from first non-empty row
let header = null;
for (const r of rows) {
  const nonEmpty = r.some(v => v && String(v).trim());
  if (nonEmpty) { header = r.map(s => String(s || '').trim()); break; }
}
if (!header) {
  console.error('No header row found');
  process.exit(1);
}

// Build records until empty rows
const startIndex = rows.indexOf(header);
const dataRows = rows.slice(startIndex + 1);
const records = [];
for (const r of dataRows) {
  const values = r.map(s => String(s || '').trim());
  const hasAny = values.some(v => v);
  if (!hasAny) continue;
  const obj = {};
  header.forEach((h, i) => { if (h) obj[h] = values[i] || ''; });
  records.push(obj);
}

process.stdout.write(JSON.stringify({ header, count: records.length, records }, null, 2));

