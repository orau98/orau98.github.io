import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';

const ROOT = process.cwd();
const FILES = {
  insectsPub: path.join(ROOT, 'public', 'insects.csv'),
  insectsNorm: path.join(ROOT, 'normalized_data', 'insects.csv'),
  hostsPub: path.join(ROOT, 'public', 'hostplants.csv'),
  hostsNorm: path.join(ROOT, 'normalized_data', 'hostplants.csv'),
  notesPub: path.join(ROOT, 'public', 'general_notes.csv'),
  notesNorm: path.join(ROOT, 'normalized_data', 'general_notes.csv'),
};

const parse = (p) => Papa.parse(fs.readFileSync(p, 'utf8'), { header: true, skipEmptyLines: false }).data;
const write = (p, rows) => {
  const fields = Object.keys(rows[0] || {});
  const csv = Papa.unparse(rows, { header: true, columns: fields });
  fs.writeFileSync(p, csv, 'utf8');
};

const binomial = (row) => {
  let sci = (row.scientific_name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!sci) {
    const g = (row.genus || '').trim();
    const s = (row.species || '').trim();
    sci = [g, s].filter(Boolean).join(' ');
  }
  const parts = sci.split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1]}`;
  return parts[0] || '';
};

function buildIndex(rows) {
  const byId = new Map();
  const byBinom = new Map();
  const byJP = new Map();
  for (const r of rows) {
    if (!r || !r.insect_id) continue;
    byId.set(r.insect_id.trim(), r);
    const b = binomial(r);
    if (b) byBinom.set(b, r.insect_id.trim());
    const jp = (r.japanese_name || '').trim();
    if (jp) byJP.set(jp, r.insect_id.trim());
  }
  return { byId, byBinom, byJP };
}

function maxH(rows) {
  let mx = 0;
  for (const r of rows) {
    const m = String(r.insect_id || '').match(/^species-H(\d+)$/);
    if (m) mx = Math.max(mx, parseInt(m[1], 10));
  }
  return mx;
}

function unify(insects) {
  const { byId, byBinom, byJP } = buildIndex(insects);
  const mapping = new Map(); // LB -> H
  let nextH = maxH(insects) + 1;
  const kept = new Set();

  // 1) 既存Hを基準。LBをHへ寄せる
  for (const r of insects) {
    const id = (r.insect_id || '').trim();
    if (!/^species-LB\d+$/i.test(id)) continue;
    const b = binomial(r);
    const jp = (r.japanese_name || '').trim();
    let target = '';
    if (b && byBinom.has(b)) {
      const t = byBinom.get(b);
      if (/^species-H\d+$/i.test(t)) target = t;
    }
    if (!target && jp && byJP.has(jp)) {
      const t = byJP.get(jp);
      if (/^species-H\d+$/i.test(t)) target = t;
    }
    if (!target) {
      target = `species-H${String(nextH).padStart(3, '0')}`;
      nextH++;
    }
    mapping.set(id, target);
    kept.add(target);
  }
  return mapping;
}

function applyInsects(insects, mapping) {
  // LB -> H への変換。既存Hがある場合はLB行を削除。新規H割当の場合はIDを置換。
  const existingH = new Set(insects.map(r => (r.insect_id || '').trim()).filter(id => /^species-H\d+$/i.test(id)));
  const toRemove = new Set();
  for (const r of insects) {
    const id = (r.insect_id || '').trim();
    const to = mapping.get(id);
    if (!to) continue;
    if (existingH.has(to)) {
      // 同一種がHで存在 → LBは削除対象
      toRemove.add(id);
    } else {
      // 新規Hを割当
      r.insect_id = to;
    }
  }
  // フィルタ
  const out = insects.filter(r => !toRemove.has((r.insect_id || '').trim()) && !toRemove.has((r.__orig_id || '').trim()));
  return out;
}

function applyRefs(rows, key, mapping) {
  let cnt = 0;
  for (const r of rows) {
    const id = (r[key] || '').trim();
    if (mapping.has(id)) {
      r[key] = mapping.get(id);
      cnt++;
    }
  }
  return cnt;
}

function run() {
  const insectsPub = parse(FILES.insectsPub);
  const insectsNorm = parse(FILES.insectsNorm);
  const mapPub = unify(insectsPub);
  const mapNorm = unify(insectsNorm);

  // 合流（両者のマッピングを統合）
  const mapping = new Map([...mapPub.entries(), ...mapNorm.entries()]);
  if (mapping.size === 0) {
    console.log('No LB IDs to unify.');
    return;
  }
  console.log('LB->H mapping size:', mapping.size);

  // insects: 変換
  const outInsectsPub = applyInsects(insectsPub, mapping);
  const outInsectsNorm = applyInsects(insectsNorm, mapping);
  write(FILES.insectsPub, outInsectsPub);
  write(FILES.insectsNorm, outInsectsNorm);

  // hostplants/general_notes: 参照置換
  const hostsPub = parse(FILES.hostsPub);
  const hostsNorm = parse(FILES.hostsNorm);
  const notesPub = parse(FILES.notesPub);
  const notesNorm = parse(FILES.notesNorm);
  const hp1 = applyRefs(hostsPub, 'insect_id', mapping);
  const hp2 = applyRefs(hostsNorm, 'insect_id', mapping);
  const nt1 = applyRefs(notesPub, 'insect_id', mapping);
  const nt2 = applyRefs(notesNorm, 'insect_id', mapping);
  write(FILES.hostsPub, hostsPub);
  write(FILES.hostsNorm, hostsNorm);
  write(FILES.notesPub, notesPub);
  write(FILES.notesNorm, notesNorm);

  console.log(`Updated refs: hostplants pub=${hp1} norm=${hp2}, notes pub=${nt1} norm=${nt2}`);
}

run();

