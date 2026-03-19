#!/usr/bin/env node
/**
 * 日本産カミキリムシの寄主植物一覧テキストから食草データを抽出するスクリプト。
 *
 * OCRテキスト 18650行目〜21076行目（寄主植物一覧セクション）を解析し、
 * - normalized_data/insects.csv で和名→insect_id を解決（曖昧マッチ含む）
 * - hostplants.csv の既存「日本産カミキリムシ」データとの重複を除外
 * - 結果を reports/kamikiri_hostplant_list.json に出力
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = path.resolve(__dirname, '..');

const OCR_FILE    = path.join(BASE, 'pdfs/kamikiri-ocr/日本産カミキリムシ_compressed.txt');
const INSECTS_CSV = path.join(BASE, 'normalized_data/insects.csv');
const HOSTS_CSV   = path.join(BASE, 'normalized_data/hostplants.csv');
const OUT_JSON    = path.join(BASE, 'reports/kamikiri_hostplant_list.json');

// ===================================================================
// ユーティリティ
// ===================================================================

function normalize(s) {
  if (!s) return '';
  return s.normalize('NFKC').replace(/[\s\u3000]/g, '').trim();
}

/** Jaro-Winkler類似度 */
function jaroWinkler(s1, s2) {
  if (s1 === s2) return 1.0;
  const l1 = s1.length, l2 = s2.length;
  if (!l1 || !l2) return 0.0;
  const matchDist = Math.max(Math.floor(Math.max(l1, l2) / 2) - 1, 0);
  const s1m = new Array(l1).fill(false);
  const s2m = new Array(l2).fill(false);
  let matches = 0, transpositions = 0;
  for (let i = 0; i < l1; i++) {
    const lo = Math.max(0, i - matchDist);
    const hi = Math.min(i + matchDist + 1, l2);
    for (let j = lo; j < hi; j++) {
      if (s2m[j] || s1[i] !== s2[j]) continue;
      s1m[i] = s2m[j] = true; matches++; break;
    }
  }
  if (!matches) return 0.0;
  const a = [], b = [];
  for (let i = 0; i < l1; i++) if (s1m[i]) a.push(s1[i]);
  for (let j = 0; j < l2; j++) if (s2m[j]) b.push(s2[j]);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) transpositions++;
  const jaro = (matches/l1 + matches/l2 + (matches - transpositions/2)/matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, l1, l2); i++) {
    if (s1[i] === s2[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function getClosestMatch(word, possibilities, cutoff = 0.80) {
  let best = null, bestScore = 0;
  for (const p of possibilities) {
    const sc = jaroWinkler(word, p);
    if (sc >= cutoff && sc > bestScore) { best = p; bestScore = sc; }
  }
  return best ? { key: best, score: bestScore } : null;
}

// ===================================================================
// 1. insects.csv からカミキリムシ辞書を構築
// ===================================================================
const INSECTS_TEXT = fs.readFileSync(INSECTS_CSV, 'utf8');
const insectsParsed = Papa.parse(INSECTS_TEXT, { header: true, skipEmptyLines: true });

const kamikiriByNorm = new Map();  // 正規化和名 -> { iid, jname }

for (const row of insectsParsed.data) {
  if (!row || row.family !== 'Cerambycidae') continue;
  const iid   = (row.insect_id   || '').trim();
  const jname = (row.japanese_name || '').trim();
  if (!iid || !jname) continue;

  const n = normalize(jname);
  if (n && !kamikiriByNorm.has(n)) kamikiriByNorm.set(n, { iid, jname });

  // 亜種行: "ルリボシカミキリ 基亜種" → "ルリボシカミキリ"
  const base = jname.replace(/\s+(基亜種|亜種\d*|[A-Z].+亜種).*/u, '').trim();
  const nb = normalize(base);
  if (nb && nb !== n && !kamikiriByNorm.has(nb)) kamikiriByNorm.set(nb, { iid, jname });

  for (const col of ['old_japanese_name', 'alternative_name', 'other_names']) {
    for (const alt of (row[col] || '').split(/[;；、,，]/)) {
      const na = normalize(alt.trim());
      if (na && !kamikiriByNorm.has(na)) kamikiriByNorm.set(na, { iid, jname });
    }
  }
}

const allNormKeys = [...kamikiriByNorm.keys()];
console.log(`カミキリムシ登録エントリ数: ${kamikiriByNorm.size} (別名・亜種含む)`);

// ===================================================================
// 2. OCRテキスト読み込み (行18650〜21076, 0-indexed: 18649〜21075)
// ===================================================================
const ocrText  = fs.readFileSync(OCR_FILE, 'utf8');
const allLines = ocrText.split('\n');
// 18650行目から21076行目まで（1-indexed）
const rawLines = allLines.slice(18649, 21076).map(l => l.replace(/\r$/, ''));
console.log(`OCR対象行数: ${rawLines.length}`);

// ===================================================================
// 3. 前処理
//    - ページヘッダ・ページ番号・区切り行を除去
//    - 行連結してセグメント化
//    - 「カ ミキリ」など途中に空白が混入したカミキリ名を修正
// ===================================================================
const SKIP_RE = /^(---|寄主植物一覧|寄上植物一覧|寄王植物一覧|寺主植物一覧|\d{3,4})(\s|$)/;

// 空行で区切ってセグメント化
const segments = [];
let buf = [];
for (const line of rawLines.map(l => l.trim())) {
  if (SKIP_RE.test(line) || line.startsWith('--- ページ')) continue;
  if (line === '') {
    if (buf.length > 0) { segments.push(buf.join(' ')); buf = []; }
  } else {
    buf.push(line);
  }
}
if (buf.length > 0) segments.push(buf.join(' '));

// セグメント内の「カ ミキリ」「カミキ リ」などの空白混入を修正
function fixKamikiri(s) {
  // 「〇〇カ ミキリ」「〇〇カミキ リ」「〇〇カミキリ リ」等を結合
  s = s.replace(/カ\s+ミキリ/g, 'カミキリ');
  s = s.replace(/カミキ\s+リ/g, 'カミキリ');
  s = s.replace(/カミキリ\s+リ/g, 'カミキリリ');  // 誤字
  // 「ハナカミキ\nリ」→「ハナカミキリ」
  s = s.replace(/([ァ-ヶー一-龠]+カミキ)\s+([リ])/g, '$1$2');
  return s;
}

const fixedSegments = segments.map(fixKamikiri);
console.log(`セグメント数: ${fixedSegments.length}`);
console.log('先頭セグメントサンプル:');
fixedSegments.slice(0, 3).forEach(s => console.log(`  ${s.slice(0, 100)}`));

// ===================================================================
// 4. セグメントを解析して (科名, 植物名, カミキリ名リスト) を構築
// ===================================================================

// カミキリムシ和名: 5文字以上のカタカナ・漢字で「カミキリ」で終わるトークン
// Unicode ranges: ぁ-ん (3041-3096), ァ-ヶ (30A1-30F6), ー (30FC), 一-龠 (4E00-9FA0)
const RE_KAMIKIRI = /([ぁ-ん\u30A0-\u30FFー一-龠\uFF10-\uFF19\uFF21-\uFF5a]{2,60}?カミキリ)/gu;

function extractKamikiriNames(text) {
  const results = [];
  let m;
  RE_KAMIKIRI.lastIndex = 0;
  while ((m = RE_KAMIKIRI.exec(text)) !== null) {
    let c = m[1].trim();
    if (c.length < 5) continue;
    if (/植物|一覧|植栽/.test(c)) continue;
    // OCRゴミ除去: 先頭の数字や記号
    c = c.replace(/^[\d\uff10-\uff19\s]+/, '').trim();
    if (c.length >= 5) results.push(c);
  }
  return results;
}

function extractPlantName(seg) {
  if (/カミキリ/.test(seg)) return null;
  if (/^植栽/.test(seg)) return null;
  if (/^植根/.test(seg)) return null;   // OCR誤字「植根」

  // 先頭が日本語で始まる
  if (/^[ぁ-ん\u30A0-\u30FFー一-龠]/u.test(seg)) {
    // 「植物名 (別名) ラテン名 植栽...」パターン
    // 先頭の日本語・括弧・スペース部分を抽出（ラテン大文字の前まで）
    const m = seg.match(
      /^((?:[ぁ-ん\u30A0-\u30FFー一-龠\uff10-\uff19a-z]+)(?:[（(（][^）)）]*[）)）])?(?:\s*[ぁ-ん\u30A0-\u30FFー一-龠]+(?:[（(（][^）)）]*[）)）])?)*)/u
    );
    if (m && m[1].length >= 2) {
      const plant = m[1].trim();
      // 括弧内別名を除去して主名のみ
      const main = plant.replace(/[（(][^）)]*[）)]/gu, '').trim();
      return (main.length >= 2 ? main : plant);
    }
    return seg.split(/[\s（(A-Z]/)[0].trim() || null;
  }

  // ラテン語のみの行（Cotoneaster bullata など）
  if (/^[A-Z][a-z]+\s+[a-z×]/.test(seg)) {
    const m = seg.match(/^([A-Z][a-z]+(?:\s+[a-z×][a-z.]+)*)/);
    return m ? m[1].trim() : null;
  }

  return null;
}

function isFamily(seg) {
  // 科名行: 日本語科名(末尾「科」か「料」) + 半角空白 + ラテン科名(大文字始まり)
  const m = seg.match(/^([ぁ-ん\u30A0-\u30FFー一-龠a-zA-Z]{2,20}?[科料])\s+[A-Z][A-Za-z]/u);
  if (m) return m[1].replace('料', '科').trim();
  return null;
}

// ===================================================================
// 4b. 同一セグメント内に「植物名 学名 カミキリ名1 学名1，...」が
//     混在する場合の植物名を先頭から取り出す
// ===================================================================
function extractPlantFromMixed(seg) {
  // 「日本語（別名）ラテン名 カミキリ名...」のパターン
  // 先頭の日本語部分を取り出す
  const m = seg.match(
    /^([ぁ-ん\u30A0-\u30FFー一-龠\uff10-\uff19a-z][ぁ-ん\u30A0-\u30FFー一-龠\uff10-\uff19（()）]*?)\s+[A-Z×]/u
  );
  if (m && m[1].length >= 2) {
    const plant = m[1].trim();
    const main = plant.replace(/[（(][^）)]*[）)]/gu, '').trim();
    return main.length >= 2 ? main : plant;
  }
  return null;
}

// 状態機械でセグメントを走査
let currentFamily = '';
let currentPlant  = '';
const records = [];  // { plant, family, kamikiriNames }

for (const seg of fixedSegments) {
  const s = seg.trim();
  if (!s) continue;

  // --- 科名チェック ---
  const fam = isFamily(s);
  if (fam) {
    currentFamily = fam;
    // 科名行に続くカミキリ名があれば取得
    const names = extractKamikiriNames(s);
    if (names.length > 0 && currentPlant) {
      records.push({ plant: currentPlant, family: currentFamily, kamikiriNames: names });
    }
    continue;
  }

  // --- カミキリ名を含む行 ---
  const names = extractKamikiriNames(s);
  if (names.length > 0) {
    // 同一セグメント内に植物名も混在しているか確認
    // 例: 「アオキ Awcuba japonica コゲチャサビカミキリ Mimectatina...」
    const mixedPlant = extractPlantFromMixed(s);
    if (mixedPlant && mixedPlant !== currentPlant) {
      // 先に前の植物との紐付けを保存（もしあれば）
      // そして新しい植物として更新
      currentPlant = mixedPlant;
    }
    if (currentPlant) {
      records.push({ plant: currentPlant, family: currentFamily, kamikiriNames: names });
    }
    // else: 植物名を見逃した（OCR破損等）→ スキップ
    continue;
  }

  // --- 植物名行チェック ---
  const plant = extractPlantName(s);
  if (plant) {
    currentPlant = plant;
    continue;
  }
  // それ以外（OCR誤字・不明行）はスキップ
}

console.log(`\n抽出レコード数: ${records.length}`);
console.log('レコードサンプル (先頭10件):');
records.slice(0, 10).forEach(({ plant, family, kamikiriNames }) => {
  console.log(`  [${family}] ${plant}: ${kamikiriNames.join(' / ')}`);
});

// ===================================================================
// 5. カミキリムシ和名 → insect_id の曖昧マッチング
// ===================================================================
function findInsectId(rawName) {
  const n = normalize(rawName);
  if (!n) return { iid: null, jname: null, score: 0 };

  // 完全一致
  if (kamikiriByNorm.has(n)) {
    const { iid, jname } = kamikiriByNorm.get(n);
    return { iid, jname, score: 1.0 };
  }

  // 末尾ゴミ除去して再試行
  const n2 = n.replace(/(様|類|型|類似)$/, '');
  if (n2 !== n && kamikiriByNorm.has(n2)) {
    const { iid, jname } = kamikiriByNorm.get(n2);
    return { iid, jname, score: 0.95 };
  }

  // 部分一致（短い側が長い側に含まれる）
  let bestIid = null, bestJname = null, bestScore = 0;
  for (const [reg, { iid, jname }] of kamikiriByNorm) {
    let score = 0;
    if (n.includes(reg) && reg.length >= 5) {
      score = reg.length / n.length;
    } else if (reg.includes(n) && n.length >= 5) {
      score = n.length / reg.length;
    }
    if (score >= 0.75 && score > bestScore) {
      bestScore = score; bestIid = iid; bestJname = jname;
    }
  }
  if (bestScore >= 0.75) return { iid: bestIid, jname: bestJname, score: bestScore };

  // Jaro-Winkler 曖昧マッチ
  const hit = getClosestMatch(n, allNormKeys, 0.82);
  if (hit) {
    const { iid, jname } = kamikiriByNorm.get(hit.key);
    return { iid, jname, score: Math.round(hit.score * 1000) / 1000 };
  }

  return { iid: null, jname: null, score: 0 };
}

// ===================================================================
// 6. 既存 hostplants.csv の (insect_id, 正規化植物名) セットを構築
// ===================================================================
const hostsText   = fs.readFileSync(HOSTS_CSV, 'utf8');
const hostsParsed = Papa.parse(hostsText, { header: true, skipEmptyLines: true });
const existing    = new Set();
for (const row of hostsParsed.data) {
  if (!row) continue;
  const ref = row.reference || '';
  if (ref.includes('カミキリムシ')) {
    existing.add(`${row.insect_id}||${normalize(row.plant_name)}`);
  }
}
console.log(`\n既存カミキリムシ食草ペア数: ${existing.size}`);

// ===================================================================
// 7. 結果を組み立て
// ===================================================================
const results = [];
const stats   = { exact: 0, fuzzy: 0, no_match: 0 };

for (const { plant, family, kamikiriNames } of records) {
  const plantNorm = normalize(plant);
  for (const rawName of kamikiriNames) {
    const { iid, jname, score } = findInsectId(rawName);

    if (!iid) {
      stats.no_match++;
      results.push({
        insect_id:    null,
        insect_name:  rawName,
        matched_name: null,
        match_score:  0,
        plant_name:   plant,
        plant_family: family,
        is_new:       false,
        note:         'no_match'
      });
      continue;
    }

    if (score >= 0.99) stats.exact++;
    else stats.fuzzy++;

    const isNew = !existing.has(`${iid}||${plantNorm}`);

    results.push({
      insect_id:    iid,
      insect_name:  jname,
      matched_name: normalize(rawName) !== normalize(jname) ? rawName : null,
      match_score:  score,
      plant_name:   plant,
      plant_family: family,
      is_new:       isNew,
      note:         score < 0.99 ? 'fuzzy_match' : ''
    });
  }
}

const newCount  = results.filter(r => r.is_new).length;
const matchedCount = results.filter(r => r.insect_id).length;
console.log(`\nマッチ統計: 完全=${stats.exact}, 曖昧=${stats.fuzzy}, 未マッチ=${stats.no_match}`);
console.log(`総レコード数: ${results.length}`);
console.log(`新規 (is_new=true): ${newCount}`);
console.log(`既存 (is_new=false): ${matchedCount - newCount}`);

// ===================================================================
// 8. JSON 出力
// ===================================================================
fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(results, null, 2), 'utf8');
console.log(`\n出力完了: ${OUT_JSON}`);
console.log(`  総エントリ数: ${results.length}`);
console.log(`  新規 (is_new=true): ${newCount}`);

// --- サンプル表示 ---
console.log('\n--- 新規エントリ (is_new=true) サンプル ---');
results.filter(r => r.is_new && r.insect_id).slice(0, 15).forEach(r => {
  const fuzzy = r.matched_name ? ` (OCR:"${r.matched_name}")` : '';
  console.log(`  ${r.insect_id} ${r.insect_name}${fuzzy} / ${r.plant_name} (${r.plant_family}) sc=${r.match_score}`);
});

console.log('\n--- 未マッチ サンプル ---');
results.filter(r => r.note === 'no_match').slice(0, 15).forEach(r => {
  console.log(`  "${r.insect_name}" / ${r.plant_name}`);
});

console.log('\n--- 曖昧マッチ サンプル ---');
results.filter(r => r.note === 'fuzzy_match').slice(0, 15).forEach(r => {
  console.log(`  OCR:"${r.matched_name}" → ${r.insect_name} sc=${r.match_score} / ${r.plant_name}`);
});
