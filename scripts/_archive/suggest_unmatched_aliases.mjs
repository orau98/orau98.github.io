import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

// Suggest alias mappings for unmatched scientific names based on insects.csv
// Usage: node scripts/suggest_unmatched_aliases.mjs reports/unmatched_xxx.txt [--threshold=2]

const unmatchedPath = process.argv[2] || path.join('reports', 'unmatched_日本産蛾類標準図鑑1.txt');
const thresholdArg = process.argv.find(a => a.startsWith('--threshold='));
const MAX_DISTANCE = thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 2;

function loadCSV(p) {
  const text = fs.readFileSync(p, 'utf8');
  return Papa.parse(text, { header: true, skipEmptyLines: true, transformHeader: h => h.trim(), transform: v => (v ?? '').toString().trim() }).data;
}

function toBinomial(sci) {
  if (!sci) return '';
  const cleaned = String(sci).replace(/[\*_`]/g, '').replace(/\s+/g, ' ').trim();
  const t = cleaned.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const parts = t.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
}

function levenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function main() {
  if (!fs.existsSync(unmatchedPath)) {
    console.error('Unmatched file not found:', unmatchedPath);
    process.exit(2);
  }
  const insectsCsv = path.join('public', 'insects.csv');
  const insects = loadCSV(insectsCsv);
  const bin2id = new Map();
  const byGenus = new Map();
  insects.forEach(r => {
    const bin = toBinomial(r.scientific_name || `${r.genus || ''} ${r.species || ''}`);
    if (!bin) return;
    if (!bin2id.has(bin)) bin2id.set(bin, r.insect_id);
    const [genus, species] = bin.split(' ');
    if (!byGenus.has(genus)) byGenus.set(genus, []);
    byGenus.get(genus).push({ bin, id: r.insect_id, species });
  });

  const unmatchedLines = fs.readFileSync(unmatchedPath, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const suggestions = [];
  for (const raw of unmatchedLines) {
    const bin = toBinomial(raw);
    if (!bin) continue;
    const [genus, species] = bin.split(' ');
    const candidates = byGenus.get(genus) || [];
    let best = null;
    for (const c of candidates) {
      const d = levenshtein(species || '', c.species || '');
      if (d <= MAX_DISTANCE) {
        if (!best || d < best.distance) best = { ...c, distance: d };
      }
    }
    if (best) {
      suggestions.push({ source: bin, target: best.bin, insect_id: best.id, distance: best.distance });
    }
  }

  const outPath = path.join('reports', 'alias_suggestions_from_unmatched.csv');
  const csv = Papa.unparse(suggestions, { columns: ['source', 'target', 'insect_id', 'distance'] });
  fs.writeFileSync(outPath, csv, 'utf8');
  console.log(`Suggestions written: ${outPath} (count=${suggestions.length}, threshold=${MAX_DISTANCE})`);
}

main();

