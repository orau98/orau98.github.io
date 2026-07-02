#!/usr/bin/env node
// CSVデータ品質の全量監査ツール（依存パッケージ不要 / RFC4180準拠パーサ内蔵）
//
// 目的:
//   insects.csv / hostplants.csv / general_notes.csv / plant_profiles.csv を全量走査し、
//   データ品質上の問題を6カテゴリに分類して機械可読レポート + 人間向けMarkdown + JSONで出力する。
//
//   1. 表記ゆれ (variant spellings)   … 正規化キーが同一だが生の表記が複数ある植物名
//   2. 重複 (duplicates)              … 完全重複行 / 昆虫-植物ペア重複 / record_id重複 / insect_id重複 / ノート重複 / プロファイル重複
//   3. 無効植物名 (invalid names)     … 実在植物らしいがサイト基準(isValidPlantName)で落ちる名前
//   4. 科名不整合 (family conflicts)  … 同一植物に複数の科が付く / 実在しない科名
//   5. 非植物キー (non-plant keys)    … 菌類・動物質・曖昧総称など、植物ページに載せるべきでない記録
//   6. 参照整合性 (referential)       … hostplants/general_notes の insect_id が insects.csv に存在しない 等
//
// サイト表示との整合を保つため、判定ロジックは scripts/lib/dataLiteBuilders.mjs
// （= メタページ生成 generate-meta-pages.js と同基準）と YList (normalized_data/ylist-lite.json)
// を再利用する。YList はサイトの権威的分類データであり、科名衝突の裁定に用いる。
//
// 使い方:
//   node scripts/audit-csv-quality.mjs            # 監査してレポート出力（読み取り専用）
//   node scripts/audit-csv-quality.mjs --fix      # 高信頼の決定的修正を hostplants.csv に適用
//   node scripts/audit-csv-quality.mjs --json out.json  # 追加でJSONを別パスにも出力

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cleanString,
  isValidPlantName,
  isSuspiciousPlantName,
  isNonPlantResourceName,
  normalizePlantNameLite,
} from './lib/dataLiteBuilders.mjs';
import { parseCsv, serializeField, applyEdits, toObjects as toObjectsBase } from './lib/csvQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const REPORTS_DIR = path.join(ROOT, 'reports');
const OUT_DIR = path.join(REPORTS_DIR, 'csv-quality');

const args = process.argv.slice(2);
const APPLY_FIX = args.includes('--fix');
const jsonIdx = args.indexOf('--json');
const extraJsonPath = jsonIdx >= 0 ? args[jsonIdx + 1] : '';

// CSVパーサ（parseCsv/serializeField/applyEdits/toObjects）は ./lib/csvQuality.mjs を共有利用する。

// --------------------------------------------------------------------------
// 入出力ヘルパ
// --------------------------------------------------------------------------
const readText = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const rel = (p) => path.relative(ROOT, p);

const findFile = (name) => {
  for (const dir of ['public', 'normalized_data']) {
    const full = path.join(ROOT, dir, name);
    if (fs.existsSync(full)) return full;
  }
  return null;
};

const toObjects = (parsed) => toObjectsBase(parsed);

const csvEscape = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const writeReportCsv = (name, headers, rows) => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h] ?? '')).join(','));
  fs.writeFileSync(path.join(OUT_DIR, name), lines.join('\n') + '\n', 'utf8');
};

// --------------------------------------------------------------------------
// YList（権威的分類データ）ロード
// --------------------------------------------------------------------------
const ylist = (() => {
  const p = path.join(ROOT, 'normalized_data', 'ylist-lite.json');
  if (!fs.existsSync(p)) return { plants: {}, aliasToCanonical: {}, familiesMap: {} };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { plants: {}, aliasToCanonical: {}, familiesMap: {} };
  }
})();
const YL_PLANTS = ylist.plants || {};
const YL_ALIAS = ylist.aliasToCanonical || {};
const YL_FAMILIES = new Set(Object.keys(ylist.familiesMap || {}));

// 植物名から YList 権威の科名を引く（正規化・別名解決を含む）。無ければ null。
const ylistFamilyFor = (rawName) => {
  const name = cleanString(rawName);
  if (!name) return null;
  const candidates = [name, normalizePlantNameLite(name)].filter(Boolean);
  for (const c of candidates) {
    if (YL_PLANTS[c]) return { canonical: c, familyJp: YL_PLANTS[c].familyJp || '' };
    const alias = YL_ALIAS[c];
    if (alias && YL_PLANTS[alias]) return { canonical: alias, familyJp: YL_PLANTS[alias].familyJp || '' };
  }
  return null;
};

const normVariantKey = (value) =>
  (normalizePlantNameLite(value) || cleanString(value))
    .replace(/[？?]+$/g, '')
    .replace(/\s+/g, '')
    .trim();

// 「科」ヘッダ的な名前か（植物個体名ではなく分類群名）
const isFamilyToken = (name) => /科$/.test(cleanString(name));
const isGenusToken = (name) => /属$/.test(cleanString(name));

// --------------------------------------------------------------------------
// 監査本体
// --------------------------------------------------------------------------
const findings = {
  generatedAt: new Date().toISOString(),
  files: {},
  summary: {},
  categories: {},
};

// ---- hostplants.csv ------------------------------------------------------
const hostPath = findFile('hostplants.csv');
const hostRaw = readText(hostPath);
const hostParsed = parseCsv(hostRaw);
const hostRows = toObjects(hostParsed);
findings.files.hostplants = { path: rel(hostPath), rows: hostRows.length };

// ---- insects.csv ---------------------------------------------------------
const insectPath = findFile('insects.csv');
const insectParsed = parseCsv(readText(insectPath));
const insectRows = toObjects(insectParsed);
const insectIds = new Set(insectRows.map((r) => cleanString(r.insect_id)).filter(Boolean));
findings.files.insects = { path: rel(insectPath), rows: insectRows.length };

// ---- general_notes.csv ---------------------------------------------------
const notesPath = findFile('general_notes.csv');
const notesParsed = parseCsv(readText(notesPath));
const noteRows = toObjects(notesParsed);
findings.files.general_notes = { path: rel(notesPath), rows: noteRows.length };

// ---- plant_profiles.csv --------------------------------------------------
const profilesPath = findFile('plant_profiles.csv');
const profilesParsed = profilesPath ? parseCsv(readText(profilesPath)) : { header: [], records: [] };
const profileRows = profilesPath ? toObjects(profilesParsed) : [];
findings.files.plant_profiles = { path: profilesPath ? rel(profilesPath) : null, rows: profileRows.length };

// ==========================================================================
// 1. 表記ゆれ（正規化キー同一・生表記が複数）
// ==========================================================================
const variantBuckets = new Map(); // key -> Map(rawName -> count)
for (const r of hostRows) {
  const raw = cleanString(r.plant_name);
  if (!raw) continue;
  if (isNonPlantResourceName(raw) || isSuspiciousPlantName(raw)) continue;
  const key = normVariantKey(raw);
  if (!key) continue;
  if (!variantBuckets.has(key)) variantBuckets.set(key, new Map());
  const m = variantBuckets.get(key);
  m.set(raw, (m.get(raw) || 0) + 1);
}
const variantFindings = [];
for (const [key, m] of variantBuckets) {
  if (m.size < 2) continue;
  const variants = Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  variantFindings.push({
    key,
    distinct: m.size,
    total: variants.reduce((s, [, c]) => s + c, 0),
    variants: variants.map(([name, count]) => `${name} (${count})`).join(' | '),
    ylist_canonical: ylistFamilyFor(key)?.canonical || '',
  });
}
variantFindings.sort((a, b) => b.total - a.total || a.key.localeCompare(b.key, 'ja'));

// ==========================================================================
// 2. 重複
// ==========================================================================
// 2a. 完全重複行（record_id以外の全列が一致）
const hostContentKey = (r) =>
  [r.insect_id, r.plant_name, r.plant_family, r.observation_type, r.plant_part, r.life_stage, r.reference, r.notes]
    .map(cleanString)
    .join('');
const exactDupMap = new Map();
for (const r of hostRows) {
  const k = hostContentKey(r);
  if (!exactDupMap.has(k)) exactDupMap.set(k, []);
  exactDupMap.get(k).push(r);
}
const exactDupGroups = Array.from(exactDupMap.values()).filter((g) => g.length > 1);
const exactDupFindings = exactDupGroups.map((g) => ({
  insect_id: cleanString(g[0].insect_id),
  plant_name: cleanString(g[0].plant_name),
  plant_family: cleanString(g[0].plant_family),
  reference: cleanString(g[0].reference),
  count: g.length,
  record_ids: g.map((r) => cleanString(r.record_id)).join(' | '),
}));

// 2b. 昆虫-植物ペア重複（正規化キーで同一、行内容が違っても）
const pairMap = new Map();
for (const r of hostRows) {
  const raw = cleanString(r.plant_name);
  if (!raw) continue;
  const k = `${cleanString(r.insect_id)}${normVariantKey(raw)}`;
  if (!pairMap.has(k)) pairMap.set(k, []);
  pairMap.get(k).push(r);
}
const pairDupFindings = Array.from(pairMap.entries())
  .filter(([, g]) => g.length > 1)
  .map(([, g]) => ({
    insect_id: cleanString(g[0].insect_id),
    normalized_plant: normVariantKey(cleanString(g[0].plant_name)),
    count: g.length,
    plant_names: Array.from(new Set(g.map((r) => cleanString(r.plant_name)))).join(' | '),
    record_ids: g.map((r) => cleanString(r.record_id)).join(' | '),
  }))
  .sort((a, b) => b.count - a.count);

// 2c. record_id 重複（本来ユニークであるべき）
const recIdCount = new Map();
for (const r of hostRows) {
  const id = cleanString(r.record_id);
  if (!id) continue;
  recIdCount.set(id, (recIdCount.get(id) || 0) + 1);
}
const dupRecordIds = Array.from(recIdCount.entries())
  .filter(([, c]) => c > 1)
  .map(([record_id, count]) => ({ record_id, count }));

// 2d. insect_id 重複（insects.csv）
const insectIdCount = new Map();
for (const r of insectRows) {
  const id = cleanString(r.insect_id);
  if (!id) continue;
  insectIdCount.set(id, (insectIdCount.get(id) || 0) + 1);
}
const dupInsectIds = Array.from(insectIdCount.entries())
  .filter(([, c]) => c > 1)
  .map(([insect_id, count]) => ({ insect_id, count }));

// 2e. general_notes 重複（insect_id + note_type + content）
const noteKeyCount = new Map();
for (const r of noteRows) {
  const k = [r.insect_id, r.note_type, r.content].map(cleanString).join('');
  if (!cleanString(r.content)) continue;
  if (!noteKeyCount.has(k)) noteKeyCount.set(k, []);
  noteKeyCount.get(k).push(cleanString(r.record_id));
}
const dupNotes = Array.from(noteKeyCount.entries())
  .filter(([, g]) => g.length > 1)
  .map(([k, g]) => {
    const [insect_id, note_type, content] = k.split('');
    return { insect_id, note_type, content: content.slice(0, 60), count: g.length, record_ids: g.join(' | ') };
  })
  .sort((a, b) => b.count - a.count);

// 2f. plant_profiles 重複（plant_name）
const profNameCount = new Map();
for (const r of profileRows) {
  const nm = cleanString(r.plant_name);
  if (!nm) continue;
  profNameCount.set(nm, (profNameCount.get(nm) || 0) + 1);
}
const dupProfiles = Array.from(profNameCount.entries())
  .filter(([, c]) => c > 1)
  .map(([plant_name, count]) => ({ plant_name, count }))
  .sort((a, b) => b.count - a.count);

// ==========================================================================
// 3. 無効植物名（実在植物らしいがサイト基準で落ちる）
// ==========================================================================
// サイトは「科/属を含む」または isValidPlantName を通る名前のみ表示する。
// それ以外（=落ちる）かつ非植物資源でもない → 静かに消える無効名。
const invalidNameFindings = [];
const invalidSeen = new Map();
for (const r of hostRows) {
  const raw = cleanString(r.plant_name);
  if (!raw) continue;
  if (isNonPlantResourceName(raw) || isSuspiciousPlantName(raw)) continue; // 5で扱う
  const shown = raw.includes('科') || raw.includes('属') || isValidPlantName(raw);
  if (shown) continue;
  const norm = normalizePlantNameLite(raw);
  const normShown = norm && (norm.includes('科') || norm.includes('属') || isValidPlantName(norm));
  const key = raw;
  if (!invalidSeen.has(key)) {
    invalidSeen.set(key, {
      plant_name: raw,
      normalized: norm,
      normalized_would_show: normShown ? 'yes' : 'no',
      count: 0,
      sample_record_id: cleanString(r.record_id),
      sample_insect_id: cleanString(r.insect_id),
      reference: cleanString(r.reference),
    });
  }
  invalidSeen.get(key).count += 1;
}
invalidNameFindings.push(...Array.from(invalidSeen.values()).sort((a, b) => b.count - a.count));

// ==========================================================================
// 4. 科名不整合
// ==========================================================================
// 4a. 同一植物名に複数の科（非空）
const familyByPlant = new Map();
for (const r of hostRows) {
  const nm = cleanString(r.plant_name);
  const fam = cleanString(r.plant_family);
  if (!nm || !fam) continue;
  if (!familyByPlant.has(nm)) familyByPlant.set(nm, new Set());
  familyByPlant.get(nm).add(fam);
}
const familyConflictFindings = [];
for (const [nm, fams] of familyByPlant) {
  if (fams.size < 2) continue;
  const yl = ylistFamilyFor(nm);
  const famArr = Array.from(fams);
  const ylFam = yl?.familyJp || '';
  const realFams = famArr.filter((f) => YL_FAMILIES.has(f));
  const fakeFams = famArr.filter((f) => !YL_FAMILIES.has(f) && !isGenusToken(f));
  let resolution = 'ambiguous';
  let suggested = '';
  if (ylFam) {
    resolution = 'ylist_authoritative';
    suggested = ylFam;
  } else if (fakeFams.length && realFams.length === 1) {
    resolution = 'typo_to_real_family';
    suggested = realFams[0];
  }
  familyConflictFindings.push({
    plant_name: nm,
    families: famArr.join(' | '),
    family_count: fams.size,
    ylist_family: ylFam,
    non_standard_families: fakeFams.join(' | '),
    resolution,
    suggested_family: suggested,
  });
}
familyConflictFindings.sort((a, b) => b.family_count - a.family_count || a.plant_name.localeCompare(b.plant_name, 'ja'));

// 4b. 実在しない科名（172正規科セットに無い / 「科」で終わらない・説明的）
const badFamilyRows = [];
const badFamilySeen = new Map();
for (const r of hostRows) {
  const fam = cleanString(r.plant_family);
  if (!fam) continue;
  if (YL_FAMILIES.has(fam)) continue;
  // 単純な「◯◯科」で正規セットに無いもの、または科で終わらない値（説明混入）
  const suspicious = !/^[぀-ヿ㐀-鿿]+科$/.test(fam);
  const notInSet = true; // 上でYL_FAMILIESに無いことは確定
  if (!suspicious && !notInSet) continue;
  const key = fam;
  if (!badFamilySeen.has(key)) {
    const yl = ylistFamilyFor(cleanString(r.plant_name));
    badFamilySeen.set(key, {
      plant_family: fam,
      ends_with_ka: /科$/.test(fam) ? 'yes' : 'no',
      count: 0,
      sample_plant: cleanString(r.plant_name),
      sample_ylist_family: yl?.familyJp || '',
      sample_record_id: cleanString(r.record_id),
    });
  }
  badFamilySeen.get(key).count += 1;
}
badFamilyRows.push(...Array.from(badFamilySeen.values()).sort((a, b) => b.count - a.count));

// ==========================================================================
// 5. 非植物キー（植物ページに載せるべきでない記録）
// ==========================================================================
const nonPlantFindings = [];
const nonPlantSeen = new Map();
for (const r of hostRows) {
  const raw = cleanString(r.plant_name);
  if (!raw) continue;
  const isResource = isNonPlantResourceName(raw);
  const isSuspicious = isSuspiciousPlantName(raw);
  if (!isResource && !isSuspicious) continue;
  if (!nonPlantSeen.has(raw)) {
    nonPlantSeen.set(raw, {
      plant_name: raw,
      kind: isResource ? 'substrate/resource' : 'suspicious/ambiguous',
      count: 0,
      sample_insect_id: cleanString(r.insect_id),
      reference: cleanString(r.reference),
    });
  }
  nonPlantSeen.get(raw).count += 1;
}
nonPlantFindings.push(...Array.from(nonPlantSeen.values()).sort((a, b) => b.count - a.count));

// ==========================================================================
// 6. 参照整合性
// ==========================================================================
const orphanHost = [];
const orphanHostSeen = new Set();
for (const r of hostRows) {
  const id = cleanString(r.insect_id);
  if (!id || insectIds.has(id)) continue;
  if (orphanHostSeen.has(id)) continue;
  orphanHostSeen.add(id);
  orphanHost.push({ source: 'hostplants', insect_id: id, sample_record_id: cleanString(r.record_id), plant_name: cleanString(r.plant_name) });
}
const orphanNotes = [];
const orphanNotesSeen = new Set();
for (const r of noteRows) {
  const id = cleanString(r.insect_id);
  if (!id || insectIds.has(id)) continue;
  if (orphanNotesSeen.has(id)) continue;
  orphanNotesSeen.add(id);
  orphanNotes.push({ source: 'general_notes', insect_id: id, sample_record_id: cleanString(r.record_id), note_type: cleanString(r.note_type) });
}

// 列数不整合（想定列数と異なる行）
const expectedCols = hostParsed.header.length;
const malformedRows = [];
hostParsed.records.slice(1).forEach((rec, idx) => {
  if (rec.fields.length !== expectedCols) {
    malformedRows.push({ record_index: idx + 1, got_cols: rec.fields.length, expected_cols: expectedCols, first_field: cleanString(rec.fields[0]) });
  }
});

// ==========================================================================
// レポート出力
// ==========================================================================
findings.categories = {
  variant_spellings: variantFindings,
  duplicates: {
    exact_rows: exactDupFindings,
    insect_plant_pairs: pairDupFindings,
    duplicate_record_ids: dupRecordIds,
    duplicate_insect_ids: dupInsectIds,
    duplicate_notes: dupNotes,
    duplicate_profiles: dupProfiles,
  },
  invalid_plant_names: invalidNameFindings,
  family_conflicts: familyConflictFindings,
  non_standard_families: badFamilyRows,
  non_plant_keys: nonPlantFindings,
  referential: { orphan_hostplants: orphanHost, orphan_notes: orphanNotes, malformed_rows: malformedRows },
};

findings.summary = {
  hostplant_rows: hostRows.length,
  variant_buckets: variantFindings.length,
  exact_duplicate_groups: exactDupFindings.length,
  insect_plant_pair_dups: pairDupFindings.length,
  duplicate_record_ids: dupRecordIds.length,
  duplicate_insect_ids: dupInsectIds.length,
  duplicate_notes: dupNotes.length,
  duplicate_profiles: dupProfiles.length,
  invalid_plant_names: invalidNameFindings.length,
  family_conflicts: familyConflictFindings.length,
  family_conflicts_ylist_resolvable: familyConflictFindings.filter((f) => f.resolution === 'ylist_authoritative').length,
  family_conflicts_typo: familyConflictFindings.filter((f) => f.resolution === 'typo_to_real_family').length,
  family_conflicts_ambiguous: familyConflictFindings.filter((f) => f.resolution === 'ambiguous').length,
  non_standard_families: badFamilyRows.length,
  non_plant_keys: nonPlantFindings.length,
  orphan_hostplants: orphanHost.length,
  orphan_notes: orphanNotes.length,
  malformed_rows: malformedRows.length,
};

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

writeReportCsv('variant_spellings.csv', ['key', 'distinct', 'total', 'variants', 'ylist_canonical'], variantFindings);
writeReportCsv('duplicate_exact_rows.csv', ['insect_id', 'plant_name', 'plant_family', 'reference', 'count', 'record_ids'], exactDupFindings);
writeReportCsv('duplicate_insect_plant_pairs.csv', ['insect_id', 'normalized_plant', 'count', 'plant_names', 'record_ids'], pairDupFindings);
writeReportCsv('duplicate_record_ids.csv', ['record_id', 'count'], dupRecordIds);
writeReportCsv('duplicate_insect_ids.csv', ['insect_id', 'count'], dupInsectIds);
writeReportCsv('duplicate_notes.csv', ['insect_id', 'note_type', 'content', 'count', 'record_ids'], dupNotes);
writeReportCsv('duplicate_profiles.csv', ['plant_name', 'count'], dupProfiles);
writeReportCsv('invalid_plant_names.csv', ['plant_name', 'normalized', 'normalized_would_show', 'count', 'sample_record_id', 'sample_insect_id', 'reference'], invalidNameFindings);
writeReportCsv('family_conflicts.csv', ['plant_name', 'families', 'family_count', 'ylist_family', 'non_standard_families', 'resolution', 'suggested_family'], familyConflictFindings);
writeReportCsv('non_standard_families.csv', ['plant_family', 'ends_with_ka', 'count', 'sample_plant', 'sample_ylist_family', 'sample_record_id'], badFamilyRows);
writeReportCsv('non_plant_keys.csv', ['plant_name', 'kind', 'count', 'sample_insect_id', 'reference'], nonPlantFindings);
writeReportCsv('referential_orphans.csv', ['source', 'insect_id', 'sample_record_id', 'plant_name'], [...orphanHost, ...orphanNotes.map((o) => ({ ...o, plant_name: o.note_type }))]);

// findings JSON
fs.writeFileSync(path.join(REPORTS_DIR, 'csv-quality-findings.json'), JSON.stringify(findings, null, 2), 'utf8');
if (extraJsonPath) fs.writeFileSync(path.resolve(ROOT, extraJsonPath), JSON.stringify(findings, null, 2), 'utf8');

// Markdown レポート
const top = (arr, n = 20) => arr.slice(0, n);
const mdTable = (headers, rows) =>
  [`| ${headers.join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${headers.map((h) => String(r[h] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`)].join('\n');

const s = findings.summary;
const md = [
  '# CSVデータ品質 全量監査レポート',
  '',
  `生成日時: ${findings.generatedAt}`,
  '',
  '本レポートは `scripts/audit-csv-quality.mjs` により自動生成される。判定基準はサイト表示ロジック',
  '（`scripts/lib/dataLiteBuilders.mjs` = メタページ生成と同基準）および YList（`normalized_data/ylist-lite.json`,',
  'サイトの権威的分類データ）を再利用しており、監査結果とサイトの実表示が一致する。',
  '',
  '## サマリ',
  '',
  mdTable(['指標', '件数'], [
    ['hostplants 行数', s.hostplant_rows],
    ['表記ゆれバケット', s.variant_buckets],
    ['完全重複グループ', s.exact_duplicate_groups],
    ['昆虫-植物ペア重複', s.insect_plant_pair_dups],
    ['record_id 重複', s.duplicate_record_ids],
    ['insect_id 重複', s.duplicate_insect_ids],
    ['ノート重複', s.duplicate_notes],
    ['プロファイル重複', s.duplicate_profiles],
    ['無効植物名（種類数）', s.invalid_plant_names],
    ['科名不整合（植物数）', s.family_conflicts],
    ['　└ YListで裁定可', s.family_conflicts_ylist_resolvable],
    ['　└ 誤記(実在科へ)', s.family_conflicts_typo],
    ['　└ 要判断', s.family_conflicts_ambiguous],
    ['非標準の科名（種類数）', s.non_standard_families],
    ['非植物キー（種類数）', s.non_plant_keys],
    ['孤立 hostplants(insect_id欠落)', s.orphan_hostplants],
    ['孤立 notes(insect_id欠落)', s.orphan_notes],
    ['列数不整合行', s.malformed_rows],
  ].map(([k, v]) => ({ 指標: k, 件数: v }))),
  '',
  '各カテゴリの全件は `reports/csv-quality/*.csv`、機械可読な全データは `reports/csv-quality-findings.json` を参照。',
  '',
  '## 1. 表記ゆれ（正規化キー同一・生表記が複数） 上位',
  '',
  variantFindings.length ? mdTable(['key', 'distinct', 'total', 'variants'], top(variantFindings)) : '- なし',
  '',
  '## 2. 重複',
  '',
  `### 完全重複行（record_id以外一致）: ${exactDupFindings.length}グループ`,
  exactDupFindings.length ? mdTable(['plant_name', 'plant_family', 'count', 'record_ids'], top(exactDupFindings)) : '- なし',
  '',
  `### 昆虫-植物ペア重複: ${pairDupFindings.length}`,
  pairDupFindings.length ? mdTable(['insect_id', 'normalized_plant', 'count', 'plant_names'], top(pairDupFindings)) : '- なし',
  '',
  `### record_id 重複: ${dupRecordIds.length} / insect_id 重複: ${dupInsectIds.length}`,
  '',
  '## 3. 無効植物名（サイトに表示されず静かに欠落する名前） 上位',
  '',
  invalidNameFindings.length ? mdTable(['plant_name', 'normalized', 'normalized_would_show', 'count'], top(invalidNameFindings)) : '- なし',
  '',
  '## 4. 科名不整合',
  '',
  `合計 ${familyConflictFindings.length} 植物。うち YList権威で裁定可 ${s.family_conflicts_ylist_resolvable}、誤記→実在科 ${s.family_conflicts_typo}、要判断 ${s.family_conflicts_ambiguous}。`,
  '',
  familyConflictFindings.length ? mdTable(['plant_name', 'families', 'ylist_family', 'resolution', 'suggested_family'], top(familyConflictFindings, 40)) : '- なし',
  '',
  `### 非標準の科名（YList-lite の科集合に無い値）: ${badFamilyRows.length}`,
  '注: YList-lite は収録植物に現れる科のみを持つ部分集合のため、この一覧には',
  '(a) OCR誤記・説明混入等の真の異常値（例「，ナス科」「キネ科」「クリノキ科（推定）」）と、',
  '(b) 部分集合外の正当な科（例「キキョウ科」「キジカクシ科」）や菌類・地衣類・非植物ホストの科（例「サルノコシカケ科」「多孔菌科」「セミ科」）が混在する。',
  '`--fix` は植物名からYListで権威科が引ける行のみ補正し、これらの正当な非植物科・部分集合外科は変更しない。',
  badFamilyRows.length ? mdTable(['plant_family', 'ends_with_ka', 'count', 'sample_plant', 'sample_ylist_family'], top(badFamilyRows)) : '- なし',
  '',
  '## 5. 非植物キー（植物ページに載せるべきでない記録） 上位',
  '',
  nonPlantFindings.length ? mdTable(['plant_name', 'kind', 'count'], top(nonPlantFindings)) : '- なし',
  '',
  '## 6. 参照整合性',
  '',
  `孤立 hostplants: ${orphanHost.length} / 孤立 notes: ${orphanNotes.length} / 列数不整合: ${malformedRows.length}`,
  orphanHost.length ? mdTable(['insect_id', 'sample_record_id', 'plant_name'], top(orphanHost)) : '',
  '',
].join('\n');

fs.writeFileSync(path.join(REPORTS_DIR, 'csv-quality-audit.md'), md + '\n', 'utf8');

console.log('[audit-csv-quality] summary:', JSON.stringify(s, null, 2));
console.log(`[audit-csv-quality] wrote ${rel(path.join(REPORTS_DIR, 'csv-quality-audit.md'))}, ${rel(path.join(REPORTS_DIR, 'csv-quality-findings.json'))}, ${rel(OUT_DIR)}/*.csv`);

// ==========================================================================
// --fix : 高信頼の決定的修正を適用（ヘルパ定義は下部。末尾で呼び出す）
// ==========================================================================

// YList 直接正準（別名を経由しない）から科名を引く
const ylistDirectFamily = (name) => {
  for (const c of [cleanString(name), normalizePlantNameLite(name)].filter(Boolean)) {
    if (YL_PLANTS[c]) return YL_PLANTS[c].familyJp || '';
  }
  return '';
};

// Tier3: 説明的な接頭辞/接尾辞を落として基底植物名にする
const descriptiveStrip = (name) => {
  let s = cleanString(name);
  s = s.replace(/^栽培種の/, '').replace(/^栽培/, '');
  s = s.replace(/と思われるが$/, '').replace(/と思われる$/, '');
  return s.trim();
};

// 任意の承認/除外/上書きリスト（workflow検証結果）。存在すれば反映する。
//   excludeFamilyFix : 科名整列から除外する植物名（同名異物リスク等）
//   approveDescriptive: Tier3説明的正規化を許可する生名（null=明確なもの全て）
//   familyOverrides   : YList非収録だが検証済みの科名（例 サクラ→バラ科）
const loadDecisions = () => {
  const p = path.join(OUT_DIR, 'fix-decisions.json');
  if (!fs.existsSync(p)) return { excludeFamilyFix: new Set(), approveDescriptive: null, familyOverrides: {} };
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      excludeFamilyFix: new Set(d.excludeFamilyFix || []),
      approveDescriptive: d.approveDescriptive ? new Set(d.approveDescriptive) : null,
      familyOverrides: d.familyOverrides || {},
    };
  } catch {
    return { excludeFamilyFix: new Set(), approveDescriptive: null, familyOverrides: {} };
  }
};

function applyFixes() {
  console.log('\n[audit-csv-quality] --fix: 高信頼の決定的修正を適用します');
  const decisions = loadDecisions();
  const excludeFamily = decisions.excludeFamilyFix instanceof Set ? decisions.excludeFamilyFix : new Set();
  const approveDescriptive = decisions.approveDescriptive; // null = 明確なもの全て許可
  const familyOverrides = decisions.familyOverrides || {};

  // 対象: hostplants.csv（public / normalized_data の両方に同一規則を適用）
  const targets = ['public/hostplants.csv', 'normalized_data/hostplants.csv']
    .map((p) => path.join(ROOT, p))
    .filter((p) => fs.existsSync(p));

  const fixLog = [];
  for (const file of targets) {
    const isPrimary = file === targets[0];
    const text = readText(file);
    const parsed = parseCsv(text);
    const rows = toObjects(parsed);
    const edits = [];
    const colIndex = {};
    parsed.header.forEach((h, i) => (colIndex[h] = i));

    for (const r of rows) {
      const recordIndex = r.__recordIndex;
      const rawName = cleanString(r.plant_name);
      const rawFam = cleanString(r.plant_family);
      let name = rawName;

      // --- Tier2/Tier3: 植物名の正規化（表示キーに寄せる） ---
      if (rawName) {
        const stripped = descriptiveStrip(rawName); // Tier3
        const canon = normalizePlantNameLite(rawName); // Tier2（括弧注記除去）
        const shown = (v) => v && (v.includes('科') || v.includes('属') || isValidPlantName(v));
        if (stripped !== rawName && isValidPlantName(stripped) && (!approveDescriptive || approveDescriptive.has(rawName))) {
          name = stripped;
          if (isPrimary) fixLog.push({ type: 'name_descriptive_strip', record_id: cleanString(r.record_id), plant_name: rawName, from: rawName, to: name });
        } else if (canon && canon !== rawName && shown(canon)) {
          name = canon;
          if (isPrimary) fixLog.push({ type: 'name_paren_canonicalize', record_id: cleanString(r.record_id), plant_name: rawName, from: rawName, to: name });
        }
        if (name !== rawName) {
          edits.push({ recordIndex, fieldIndex: colIndex.plant_name, newValue: name });
        }
      }

      // --- 検証済み手動裁定（YList非収録の植物）---
      if (familyOverrides[name] && rawFam && !isGenusToken(rawFam) && rawFam !== familyOverrides[name]) {
        edits.push({ recordIndex, fieldIndex: colIndex.plant_family, newValue: familyOverrides[name] });
        if (isPrimary) fixLog.push({ type: 'family_verified_override', record_id: cleanString(r.record_id), plant_name: name, from: rawFam, to: familyOverrides[name] });
      // --- Tier1: 科名を YList 権威値に合わせる（サイト表示は元々YList基準＝表示不変） ---
      } else if (rawFam && !isGenusToken(rawFam) && !excludeFamily.has(name)) {
        const directFam = ylistDirectFamily(name); // Tier1A: 直接正準
        if (directFam && directFam !== rawFam) {
          edits.push({ recordIndex, fieldIndex: colIndex.plant_family, newValue: directFam });
          if (isPrimary) fixLog.push({ type: 'family_align_ylist', record_id: cleanString(r.record_id), plant_name: name, from: rawFam, to: directFam });
        } else if (!directFam && !YL_FAMILIES.has(rawFam)) {
          const yl = ylistFamilyFor(name); // Tier1B: 別名経由（非標準科名のみ）
          if (yl && yl.familyJp && yl.familyJp !== rawFam) {
            edits.push({ recordIndex, fieldIndex: colIndex.plant_family, newValue: yl.familyJp });
            if (isPrimary) fixLog.push({ type: 'family_nonstandard_to_ylist', record_id: cleanString(r.record_id), plant_name: name, from: rawFam, to: yl.familyJp });
          }
        }
      }
    }

    if (edits.length) {
      const out = applyEdits(text, parsed.records, edits);
      fs.writeFileSync(file, out, 'utf8');
      console.log(`[audit-csv-quality] ${rel(file)}: ${edits.length}セル修正`);
    } else {
      console.log(`[audit-csv-quality] ${rel(file)}: 修正対象なし`);
    }
  }

  const byType = fixLog.reduce((m, f) => ((m[f.type] = (m[f.type] || 0) + 1), m), {});
  writeReportCsv('applied_fixes.csv', ['type', 'record_id', 'plant_name', 'from', 'to'], fixLog);
  console.log(`[audit-csv-quality] 修正ログ: ${rel(path.join(OUT_DIR, 'applied_fixes.csv'))} (${fixLog.length}件)`, JSON.stringify(byType));
}

if (APPLY_FIX) {
  applyFixes();
}
