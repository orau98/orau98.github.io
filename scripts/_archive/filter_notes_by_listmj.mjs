import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Filter out suspected hallucinated rows from Markdown notes based on ListMJ presence
// Usage: node scripts/filter_notes_by_listmj.mjs tmp/standard1_notes.md reports/unmatched_detailed_日本産蛾類標準図鑑1.csv tmp_listmj.json

const mdPath = process.argv[2] || path.join('tmp', 'standard1_notes.md');
const unmatchedCsv = process.argv[3] || path.join('reports', 'unmatched_detailed_日本産蛾類標準図鑑1.csv');
const listJson = process.argv[4] || path.join(process.cwd(), 'tmp_listmj.json');

function stripDiacritics(s='') { try { return s.normalize('NFKD').replace(/\p{Diacritic}/gu, ''); } catch { return s; } }
function collapseSubgenus(sci='') { const m=sci.match(/^([A-Z][a-z-]+)\s*\([^)]*\)\s*([a-z-]+)(.*)$/); return m?`${m[1]} ${m[2]}${m[3]||''}`:sci; }
function toBinomial(sci='') {
  let cleaned = String(sci).replace(/[\*_`]/g, '').replace(/\s+/g, ' ').trim();
  cleaned = stripDiacritics(cleaned);
  cleaned = collapseSubgenus(cleaned);
  const t = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = t.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}

function loadMdRows(p){
  const md=fs.readFileSync(p,'utf8');
  const lines=md.split(/\r?\n/);
  const headerIdx = lines.findIndex(l=>/^\s*\|/.test(l));
  if (headerIdx === -1) return { lines, headerIdx, jaIdx:-1, sciIdx:-1 };
  const header = lines[headerIdx].split('|').map(c=>c.trim().replace(/[\*_`]/g,'').trim());
  const jaIdx = header.findIndex(h=>h.includes('和名'));
  const sciIdx = header.findIndex(h=>h.includes('学名'));
  return { lines, headerIdx, jaIdx, sciIdx };
}

function main(){
  if (!fs.existsSync(unmatchedCsv) || !fs.existsSync(mdPath) || !fs.existsSync(listJson)) {
    console.error('Missing input file(s).');
    process.exit(2);
  }
  const list = JSON.parse(fs.readFileSync(listJson,'utf8'));
  const listSet = new Set();
  for (const r of list.records || []) {
    // try both explicit binomial field and any implicit genus/species sequences
    if (r.binomial) listSet.add(toBinomial(r.binomial));
    const vals = Object.values(r).map(v=>String(v||'').trim());
    for (let i=0;i<vals.length-1;i++){
      const a=vals[i], b=vals[i+1];
      if (/^[A-Z][a-z-]+$/.test(a) && /^[a-z][a-z-]+$/.test(b)) listSet.add(`${a} ${b}`);
    }
  }
  const unmatched = Papa.parse(fs.readFileSync(unmatchedCsv,'utf8'), { header:true }).data;
  const suspects = new Set();
  for (const u of unmatched) {
    const bin = toBinomial(u.normalized_binomial || u.original || '');
    if (!bin) continue;
    if (!listSet.has(bin)) suspects.add(bin);
  }
  const { lines, headerIdx, sciIdx } = loadMdRows(mdPath);
  if (headerIdx === -1 || sciIdx === -1) {
    console.error('Could not locate markdown table header/columns');
    process.exit(3);
  }
  const out=[]; let removed=0; const removedBins=new Set();
  for (let i=0;i<lines.length;i++){
    const l=lines[i];
    if (i<=headerIdx+1) { out.push(l); continue; } // header + separator stay
    if (!/^\s*\|/.test(l)) { out.push(l); continue; }
    const cells=l.split('|');
    const sci=cells[sciIdx] ? cells[sciIdx].trim() : '';
    const bin=toBinomial(sci);
    if (suspects.has(bin)) { removed++; removedBins.add(bin); continue; }
    out.push(l);
  }
  // backup and write
  const backup = mdPath + '.bak';
  fs.copyFileSync(mdPath, backup);
  fs.writeFileSync(mdPath, out.join('\n'), 'utf8');
  console.log(JSON.stringify({ removed, removed_bins: Array.from(removedBins).slice(0,50) }, null, 2));
}

main();

