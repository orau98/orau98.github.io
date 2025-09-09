import fs from 'fs/promises';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FILES = [
  path.join(ROOT, 'normalized_data', 'insects.csv'),
  path.join(ROOT, 'public', 'insects.csv'),
];
const REPORT_GAPS = path.join(ROOT, 'reports', 'insect_id_gaps.csv');
const REPORT_STATS = path.join(ROOT, 'reports', 'insect_id_stats.txt');

function parseId(id) {
  const s = String(id || '').trim();
  const mNum = s.match(/^species-(\d+)$/);
  if (mNum) return { type: 'num', num: parseInt(mNum[1], 10), raw: s };
  const mLet = s.match(/^species-([A-Z]+)(\d+)$/);
  if (mLet) return { type: 'let', code: mLet[1], num: parseInt(mLet[2], 10), raw: s };
  return { type: 'other', raw: s };
}

function cmpId(a, b) {
  const pa = parseId(a), pb = parseId(b);
  const rank = { num: 0, let: 1, other: 2 };
  if (pa.type !== pb.type) return rank[pa.type] - rank[pb.type];
  if (pa.type === 'num') return pa.num - pb.num;
  if (pa.type === 'let') return pa.code === pb.code ? (pa.num - pb.num) : (pa.code < pb.code ? -1 : 1);
  return pa.raw < pb.raw ? -1 : pa.raw > pb.raw ? 1 : 0;
}

async function sortFile(file) {
  const raw = await fs.readFile(file, 'utf8');
  const { data, meta } = Papa.parse(raw, { header: true, skipEmptyLines: false });
  const rows = data.filter(r => r && Object.keys(r).length > 1);
  rows.sort((r1, r2) => cmpId(r1['insect_id'], r2['insect_id']));
  const csv = Papa.unparse(rows, { header: true, newline: '\n' });
  await fs.writeFile(file, csv + '\n', 'utf8');
  console.log(`[sort-insects] sorted ${path.relative(ROOT, file)} by insect_id (${rows.length} rows)`);
  return rows;
}

function computeGaps(rows) {
  const nums = [];
  for (const r of rows) {
    const p = parseId(r['insect_id']);
    if (p.type === 'num') nums.push(p.num);
  }
  nums.sort((a,b)=>a-b);
  const uniq = Array.from(new Set(nums));
  const min = uniq[0], max = uniq[uniq.length-1];
  const missing = [];
  const set = new Set(uniq);
  for (let i=min; i<=max; i++) if (!set.has(i)) missing.push(i);
  return { min, max, missing };
}

async function writeGapReport(rows) {
  const { min, max, missing } = computeGaps(rows);
  const lines = [ 'min,max,total_missing', `${min},${max},${missing.length}`, 'missing_list', missing.join(' ') ];
  await fs.mkdir(path.dirname(REPORT_GAPS), { recursive: true });
  await fs.writeFile(REPORT_GAPS, lines.join('\n'), 'utf8');
  console.log(`[sort-insects] wrote gap report: ${path.relative(ROOT, REPORT_GAPS)} (${missing.length} missing)`);
}

async function writeStats(rows) {
  const groups = new Map();
  for (const r of rows) {
    const p = parseId(r['insect_id']);
    if (p.type === 'num') groups.set('numeric', (groups.get('numeric')||0)+1);
    else if (p.type === 'let') groups.set(`letter:${p.code}`, (groups.get(`letter:${p.code}`)||0)+1);
    else groups.set('other', (groups.get('other')||0)+1);
  }
  let out = 'ID statistics\n';
  for (const [k,v] of groups.entries()) out += `${k}: ${v}\n`;
  await fs.writeFile(REPORT_STATS, out, 'utf8');
  console.log(`[sort-insects] wrote stats: ${path.relative(ROOT, REPORT_STATS)}`);
}

const main = async () => {
  // Sort normalized first, then public
  const rowsNorm = await sortFile(FILES[0]);
  await writeGapReport(rowsNorm);
  await writeStats(rowsNorm);
  await sortFile(FILES[1]);
};

main().catch(e => { console.error('sort_insects_by_id failed:', e); process.exit(1); });

