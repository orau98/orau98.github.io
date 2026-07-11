#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Papa from 'papaparse';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_ROOT = process.env.HAMUSHI6_DATA_ROOT ? path.resolve(process.env.HAMUSHI6_DATA_ROOT) : ROOT;
const SOURCE = '日本産ハムシ科生態覚書 (6)';
const YEAR = '2012';

function resolveSourceInput(envName, candidates, label, required = true) {
  if (process.env[envName]) return path.resolve(process.env[envName]);
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (existing) return existing;
  if (!required) return candidates[0];
  throw new Error(`${label} not found; set ${envName}`);
}

const TEXT_PATH = resolveSourceInput(
  'HAMUSHI6_TEXT_PATH',
  [
    path.join(ROOT, 'data/ocr/japanese-leaf-beetle-ecology-notes-6/article.txt'),
    '/private/tmp/hamushi6-article.txt',
    path.join(os.tmpdir(), 'hamushi6-article.txt'),
  ],
  'Leaf-beetle article text',
);
const PDF_PATH = resolveSourceInput(
  'HAMUSHI6_PDF_PATH',
  [
    path.join(ROOT, 'data/sources/kanagawa-chuho-177.pdf'),
    '/private/tmp/kanagawa-chuho-177.pdf',
    path.join(os.tmpdir(), 'kanagawa-chuho-177.pdf'),
  ],
  'Leaf-beetle source PDF',
  false,
);
const PDF_SHA256 = 'b16c29ef9ad7f9e017a0d1349c7907c013b7a6e5f53d8beae2d175230262f544';
const OUTPUT_DATE = '2026-07-12';
const CURRENT_CATALOG_URL = 'https://japanesebeetles.jimdofree.com/目録/134-ハムシ科/134-2-ヒゲナガハムシ亜科/';
const CHAETOCNEMA_REVISION_URL = 'https://stevelingafelter.com/wp-content/uploads/2018/02/040-LingafelterChaetocnema-Chrysomelidae-2011.pdf';
const OSIMAENSIS_DESCRIPTION_URL = 'https://coleoptera.sakura.ne.jp/ElytraNS/5-1_233.pdf';
const OSIMAENSIS_REVIEW_URL = 'https://kmkjournals.com/upload/PDF/EEJ/23/23_6_344_346_Sergeev.pdf';

const ACCOUNT_LEDGER_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-leaf-beetle-ecology-notes-6-all-accounts-2026-07-12.csv',
);
const ACTION_LEDGER_PATH = path.join(
  ROOT,
  'data/source_audits/japanese-leaf-beetle-ecology-notes-6-integrity-actions-2026-07-12.json',
);
const REPORT_PATH = path.join(
  ROOT,
  'reports/japanese-leaf-beetle-ecology-notes-6-full-audit-2026-07-12.md',
);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const compact = (value) => String(value ?? '')
  .normalize('NFKC')
  .replace(/[ \t\u3000]+/gu, ' ')
  .replace(/\s*([，,])\s*/gu, '、')
  .replace(/\s*([;；])\s*/gu, '；')
  .replace(/\s*([。])\s*/gu, '。')
  .replace(/[–—−~～]/gu, '〜')
  .replace(/\s*〜\s*/gu, '〜')
  .replace(/\s+月/gu, '月')
  .replace(/(?<=[ぁ-んァ-ヶ一-龯0-9])\s+(?=[ぁ-んァ-ヶ一-龯0-9])/gu, '')
  .trim();
const japaneseKey = (value) => compact(value)
  .replace(/[\s・･、,()（）\[\]［］【】?？〜~\-]/gu, '')
  .replace(/新称/gu, '');
const latinWord = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/gu, '')
  .toLowerCase()
  .replace(/[^a-z]/gu, '');
const scientificKey = (genus, species, subspecies = '') => [genus, species, subspecies]
  .map(latinWord)
  .filter(Boolean)
  .join(' ');

function readCsv(relativePath) {
  return Papa.parse(
    fs.readFileSync(path.join(DATA_ROOT, relativePath), 'utf8').replace(/^\uFEFF/u, ''),
    { header: true, skipEmptyLines: true },
  ).data;
}

function isAccountHeading(line) {
  const text = line.trim();
  return /[ぁ-んァ-ヶ一-龯]/u.test(text)
    && /[A-Z][a-z]+\s+[a-z]{2,}/u.test(text)
    && !/^\s*(備考|食草|分布|棲息地|成虫出現期|幼生期|文献):?/u.test(text)
    && !text.startsWith('思われる。');
}

function parseHeading(text) {
  const match = text.trim().match(/^(.*?)\s+([A-Z][a-z]+\s+[a-z]+(?:\s+[a-z]+)?(?:\s+.*)?)$/u);
  if (!match) throw new Error(`Unparseable account heading: ${text}`);
  const latin = match[2].match(/[A-Z][a-z]+|[a-z]+/gu) || [];
  return {
    source_japanese_name: compact(match[1]).replace(/\s*\(新称\)$/u, ''),
    source_scientific_name: compact(match[2]),
    genus: latin[0] || '',
    species: latin[1] || '',
    subspecies: /^[a-z]+$/u.test(latin[2] || '') ? latin[2] : '',
  };
}

function parseFields(block) {
  const cleaned = block
    .filter(({ line }) => {
      const text = line.trim();
      return text
        && !/^\d+$/u.test(text)
        && !/^日本産ハムシ科生態覚書/u.test(text)
        && !/^神奈川虫報第/u.test(text);
    })
    .map(({ line }) => line.trim())
    .join(' ')
    .replace(/\s+文献\s+[\s\S]*$/u, '');
  const fields = {};
  const matches = [...cleaned.matchAll(/(分布|棲息地|食草|成虫出現期|幼生期|備考):\s*/gu)];
  for (let index = 0; index < matches.length; index += 1) {
    fields[matches[index][1]] = compact(cleaned.slice(
      matches[index].index + matches[index][0].length,
      matches[index + 1]?.index ?? cleaned.length,
    ));
  }
  return fields;
}

function parseAccounts(text) {
  const lines = [];
  text.split('\f').forEach((page, pageIndex) => {
    page.split(/\r?\n/u).forEach((line) => lines.push({ printed_page: 33 + pageIndex, line }));
  });
  const headingIndexes = lines.flatMap(({ line }, index) => (isAccountHeading(line) ? [index] : []));
  const accounts = headingIndexes.map((start, index) => {
    const end = headingIndexes[index + 1] ?? lines.length;
    return {
      source_account_id: `H6-${String(index + 1).padStart(3, '0')}`,
      source_order: index + 1,
      source_printed_page: lines[start].printed_page,
      source_pdf_page: lines[start].printed_page + 2,
      ...parseHeading(lines[start].line),
      fields: parseFields(lines.slice(start + 1, end)),
    };
  });
  if (accounts.length !== 112) throw new Error(`Expected 112 source accounts, got ${accounts.length}`);
  return accounts;
}

const mappingOverrides = new Map([
  ['altica coerulea', 'species-H002'],
  ['altica sanguinosorbae', 'species-H015'],
  ['altica cyanea', 'species-H001'],
  ['amphimeloides bistripunctatus', 'species-H096'],
  ['aphthona opaca', 'species-H019'],
  ['aphthonomorpha collaris', 'species-H044'],
  ['argopistes coccinelliformis', 'species-H032'],
  ['chaetocnema basalis', 'species-H048'],
  ['chaetocnema discreta', 'species-H063'],
  ['chaetocnema formosensis', 'species-H064'],
  ['chaetocnema mandschurica', 'species-H817'],
  ['chaetocnema picipes', 'species-H056'],
  ['clitea metallica', 'species-H017'],
  ['hemipyxis plagioderoides', 'species-H089'],
  ['longitarsus succineus', 'species-H137'],
  ['longitarsus tabidus', 'species-H133'],
]);

function insectJapaneseAliases(row) {
  return [row.japanese_name, row.old_japanese_name, row.alternative_name, row.other_names]
    .flatMap((value) => String(value ?? '').split(/[;；/]/u))
    .map(japaneseKey)
    .filter(Boolean);
}

function mapAccount(account, insects) {
  const fullKey = scientificKey(account.genus, account.species, account.subspecies);
  const binomialKey = scientificKey(account.genus, account.species);
  if (mappingOverrides.has(fullKey)) {
    const insectId = mappingOverrides.get(fullKey);
    return insectId
      ? { status: 'mapped_override', insect_ids: [insectId] }
      : { status: 'hold_source_taxon_absent', insect_ids: [] };
  }
  if (mappingOverrides.has(binomialKey)) {
    const insectId = mappingOverrides.get(binomialKey);
    return insectId
      ? { status: 'mapped_override', insect_ids: [insectId] }
      : { status: 'hold_source_taxon_absent', insect_ids: [] };
  }
  const scientificCandidates = insects.filter((row) => (
    latinWord(row.genus) === latinWord(account.genus)
    && latinWord(row.species) === latinWord(account.species)
  ));
  if (scientificCandidates.length) {
    const exactSubspecies = account.subspecies
      ? scientificCandidates.find((row) => latinWord(row.subspecies) === latinWord(account.subspecies))
      : scientificCandidates.find((row) => !row.subspecies);
    const chosen = exactSubspecies || scientificCandidates[0];
    return { status: 'mapped_scientific', insect_ids: [chosen.insect_id] };
  }
  const sourceJapaneseKey = japaneseKey(account.source_japanese_name);
  const japaneseCandidates = insects.filter((row) => insectJapaneseAliases(row).includes(sourceJapaneseKey));
  if (japaneseCandidates.length === 1) {
    return { status: 'mapped_japanese', insect_ids: [japaneseCandidates[0].insect_id] };
  }
  return { status: 'hold_unresolved_mapping', insect_ids: [] };
}

const plantNameAliases = new Map([
  ['アザミ類', 'アザミ'],
  ['タデ類', 'タデ'],
  ['ゲンノショウコ類', 'ゲンノショウコ'],
  ['ヤナギ類', 'ヤナギ'],
  ['サクラ類', 'サクラ'],
  ['キイチゴ類', 'キイチゴ'],
  ['アケビ類', 'アケビ'],
  ['アヤメ類', 'アヤメ'],
  ['イボタ類', 'イボタ'],
  ['ネズミモチ類', 'ネズミモチ'],
  ['カエデ類', 'カエデ'],
  ['ギボウシ類', 'ギボウシ'],
  ['トリカブト類', 'トリカブト'],
  ['ムラサキシキブ類', 'ムラサキシキブ'],
  ['オオバコ類', 'オオバコ'],
  ['イヌノフグリ類', 'イヌノフグリ'],
  ['温室メロン', 'メロン'],
  ['ホウノキ', 'ホオノキ'],
  ['ヒメジオン', 'ヒメジョオン'],
]);

const specialPlants = new Map([
  ['species-H021', []],
  ['species-H019', []],
  ['species-H063', ['ホウロクイチゴ', 'ナワシロイチゴ', 'フユイチゴ']],
  ['species-H058', ['イヌタデ', 'ミゾソバ']],
  ['species-H074', ['ジャガイモ', 'ナス', 'ホウズキ']],
  ['species-H094', []],
  ['species-H119', ['イボタ']],
  ['species-H082', ['ムラサキシキブ']],
]);

function normalizePlantName(value) {
  let name = compact(value)
    .replace(/(?<=[ぁ-んァ-ヶ一-龯])\s+(?=[ぁ-んァ-ヶ一-龯])/gu, '')
    .replace(/[。.]+$/gu, '')
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/など$/u, '')
    .trim();
  name = plantNameAliases.get(name) || name;
  return name;
}

function plantsForAccount(account, insectId) {
  if (specialPlants.has(insectId)) return specialPlants.get(insectId);
  const food = account.fields['食草'] || '';
  if (!food || /^不明/u.test(food) || /可能性/u.test(food) || /と思われ/u.test(food)) return [];
  const firstClause = food.split(/[;；:：]/u)[0]
    .replace(/\s*\([^)]*\)/gu, '')
    .replace(/などのナス科作物.*$/u, '');
  return [...new Set(firstClause.split(/[、，,]/u)
    .map(normalizePlantName)
    .filter((name) => name && name !== '草本' && name !== 'ナス科作物'))];
}

const manualPlantFamilies = new Map([
  ['アザミ', 'キク科'], ['タデ', 'タデ科'], ['ゲンノショウコ', 'フウロソウ科'],
  ['ヤナギ', 'ヤナギ科'], ['サクラ', 'バラ科'], ['キイチゴ', 'バラ科'],
  ['アケビ', 'アケビ科'], ['アヤメ', 'アヤメ科'], ['イボタ', 'モクセイ科'],
  ['ネズミモチ', 'モクセイ科'], ['カエデ', 'ムクロジ科'], ['ギボウシ', 'クサスギカズラ科'],
  ['トリカブト', 'キンポウゲ科'], ['ムラサキシキブ', 'シソ科'],
  ['オオバコ', 'オオバコ科'], ['イヌノフグリ', 'オオバコ科'],
  ['イネ科雑草', 'イネ科'], ['ホオノキ', 'モクレン科'], ['ミツマタ', 'ジンチョウゲ科'],
  ['ボタンズル', 'キンポウゲ科'], ['オカボ', 'イネ科'], ['タニソバ', 'タデ科'],
  ['ホウズキ', 'ナス科'], ['ハマベンケイソウ', 'ムラサキ科'],
  ['オオキバムカシヨモギ', 'キク科'], ['ヒメジオン', 'キク科'],
]);

function plantFamilyMap(allHosts) {
  const counts = new Map();
  for (const row of allHosts) {
    if (!row.plant_name || !row.plant_family) continue;
    const name = normalizePlantName(row.plant_name);
    if (!counts.has(name)) counts.set(name, new Map());
    const families = counts.get(name);
    families.set(row.plant_family, (families.get(row.plant_family) || 0) + 1);
  }
  const result = new Map(manualPlantFamilies);
  for (const [name, families] of counts) {
    if (result.has(name)) continue;
    const ranked = [...families.entries()].sort((left, right) => right[1] - left[1]);
    if (ranked[0]) result.set(name, ranked[0][0]);
  }
  return result;
}

const preciseHostUse = new Map([
  ['species-H003\u0000エノキグサ', ['葉', '幼虫・卵']],
  ['species-H031\u0000トネリコ', ['葉', '幼虫・卵']],
  ['species-H031\u0000イボタ', ['葉', '幼虫・卵']],
  ['species-H031\u0000ハシドイ', ['葉', '幼虫・卵']],
  ['species-H037\u0000ボタンズル', ['葉', '幼虫・卵']],
  ['species-H051\u0000イネ', ['茎', '幼虫・卵']],
  ['species-H056\u0000テンサイ', ['根', '幼虫']],
  ['species-H017\u0000ヒラミレモン', ['葉', '幼虫・卵']],
  ['species-H072\u0000イヌゴマ', ['葉', '幼虫']],
  ['species-H083\u0000クサギ', ['葉', '幼虫・卵']],
  ['species-H083\u0000オオバコ', ['葉', '幼虫・卵']],
  ['species-H083\u0000ツワブキ', ['葉', '幼虫・卵']],
  ['species-H084\u0000クサギ', ['葉', '幼虫・卵']],
  ['species-H084\u0000オオバコ', ['葉', '幼虫・卵']],
  ['species-H084\u0000ツワブキ', ['葉', '幼虫・卵']],
  ['species-H089\u0000オオバコ', ['葉', '幼虫・卵']],
  ['species-H089\u0000クサギ', ['葉', '幼虫・卵']],
  ['species-H089\u0000オドリコソウ', ['葉', '幼虫・卵']],
  ['species-H089\u0000テンニンソウ', ['葉', '幼虫・卵']],
  ['species-H103\u0000ホオノキ', ['葉', '幼虫・卵']],
  ['species-H113\u0000ギボウシ', ['根', '幼虫']],
  ['species-H134\u0000ムラサキシキブ', ['花', '成虫']],
  ['species-H134\u0000オオムラサキシキブ', ['花', '成虫']],
  ['species-H136\u0000オオバコ', ['根', '幼虫']],
]);

function hostUse(insectId, plantName) {
  return preciseHostUse.get(`${insectId}\u0000${plantName}`) || ['', ''];
}

const collectionMonths = new Map([
  ['species-H806', '11月に採集記録'],
  ['species-H039', '7月に採集記録'],
  ['species-H041', '5月に採集記録'],
  ['species-H052', '8月に採集記録'],
  ['species-H059', '7月に採集記録'],
  ['species-H085', '2月に採集記録'],
  ['species-H091', '3月に採集記録'],
  ['species-H116', '5月に採集記録'],
  ['species-H140', '4月に採集記録'],
]);

function emergenceContent(account, insectId) {
  const field = compact(account.fields['成虫出現期'] || '');
  if (!field) return collectionMonths.get(insectId) || '';
  const first = field.split('；')[0].replace(/[。.]+$/gu, '').trim();
  if (/^採集例は/u.test(first)) {
    return first.replace(/^採集例は\s*/u, '').replace(/である$/u, '').replace(/の採集例がある$/u, '')
      + 'に採集記録';
  }
  return first.replace(/の採集例がある$/u, 'に採集記録').replace(/[，,]\s*/gu, '・');
}

function cleanHabitat(value) {
  return compact(value || '')
    .replace(/[。.]+$/gu, '')
    .replace(/；/gu, '；')
    .trim();
}

const alticaLarvalBase = '葉面に卵塊を産み、表面に糞を塗る。幼虫は葉を食べ、3齢で老熟すると地中で蛹化する';
const tentouLarvalBase = '葉面に1卵ずつ埋め込むように産卵し、孵化幼虫は葉肉内に潜入する。幼虫は地中で蛹化する';
const clarkiLarvalBase = '葉面に産卵し、幼虫は葉肉内に潜入し、老熟すると地中で蛹化する';

function objectiveLarvalContent(account, insectId) {
  const value = compact(account.fields['幼生期'] || '');
  if (!value || /^不明[。.]?$/u.test(value)) return '';
  if (['species-H083', 'species-H084'].includes(insectId)) {
    return '葉面に産卵し、幼虫は葉を食べる。野外で幼虫が確認されることは少ない';
  }
  if (insectId === 'species-H103') return '室内ではホオノキの葉脈沿いに産卵し、幼虫が孵化した';
  if (insectId === 'species-H072') return '潜葉性である';
  if (/^ヒメカミナリハムシと同様/u.test(value)) {
    const suffix = value.replace(/^ヒメカミナリハムシと同様(?:であるが|で)?[、，]?/u, '').replace(/[。.]+$/u, '');
    return suffix ? `${alticaLarvalBase}；${suffix}` : alticaLarvalBase;
  }
  if (/^テントウノミハムシと同様/u.test(value)) {
    const suffix = value.replace(/^テントウノミハムシと同様[、，;；]?/u, '').replace(/[。.]+$/u, '');
    return suffix ? `${tentouLarvalBase}；${suffix}` : tentouLarvalBase;
  }
  if (/^クラークマルノミハムシと同様/u.test(value)) {
    const suffix = value.replace(/^クラークマルノミハムシと同様[、，;；]?/u, '').replace(/[。.]+$/u, '');
    return suffix ? `${clarkiLarvalBase}；${suffix}` : clarkiLarvalBase;
  }
  const parts = value.split(/[。；]/u).map((part) => part.trim()).filter(Boolean);
  const safe = parts.filter((part) => (
    !/不明|思われ|可能性|とされる|一般には|シベリアの/u.test(part)
  ));
  return safe.join('；');
}

const extraEcology = new Map([
  ['species-H011', '冬季に多数の個体が集まり、集団で越冬する例がある'],
  ['species-H014', 'オオマツヨイグサで普通にみられる'],
  ['species-H024', 'アヤメ類の園芸害虫となっている'],
  ['species-H032', '都会では個体数が増え、生垣や庭木などの園芸害虫となっている'],
  ['species-H057', 'サツマイモの害虫である'],
  ['species-H072', '河川敷や庭先などで多数みられることがある'],
  ['species-H074', '北米原産のタバコの重要害虫である'],
  ['species-H115', '市街地の植込みなどにも多くみられる'],
  ['species-H134', '成虫はムラサキシキブ類の花によく集まる'],
  ['species-H139', '青森県車力村では海岸付近のヨシ湿地で晩秋に多数の未熟個体がみられた'],
]);

function ecologyContent(account, insectId) {
  const parts = [];
  const habitat = cleanHabitat(account.fields['棲息地']);
  if (habitat && habitat !== '不明') parts.push(`生息地：${habitat}`);
  const larval = objectiveLarvalContent(account, insectId);
  if (larval) parts.push(`幼生期：${larval}`);
  if (extraEcology.has(insectId)) parts.push(extraEcology.get(insectId));
  return parts.length ? `${parts.join('。')}。` : '';
}

const textBytes = fs.readFileSync(TEXT_PATH);
const text = textBytes.toString('utf8');
if (fs.existsSync(PDF_PATH)) {
  const actualPdfHash = sha256(fs.readFileSync(PDF_PATH));
  if (actualPdfHash !== PDF_SHA256) throw new Error(`Unexpected source PDF SHA-256: ${actualPdfHash}`);
}

const insects = readCsv('normalized_data/insects.csv').filter((row) => row.insect_id.startsWith('species-H'));
const insectsById = new Map(insects.map((row) => [row.insect_id, row]));
const allHosts = readCsv('normalized_data/hostplants.csv');
const allNotes = readCsv('normalized_data/general_notes.csv');
const families = plantFamilyMap(allHosts);
const accounts = parseAccounts(text).map((account) => ({ ...account, mapping: mapAccount(account, insects) }));

for (const account of accounts) {
  for (const insectId of account.mapping.insect_ids) {
    if (!insectsById.has(insectId)) throw new Error(`${account.source_account_id}: missing mapped insect ${insectId}`);
  }
}
const unresolved = accounts.filter((account) => account.mapping.status === 'hold_unresolved_mapping');
if (unresolved.length) throw new Error(`Unresolved safe mappings: ${unresolved.map((a) => a.source_scientific_name).join(', ')}`);
if (accounts.filter((account) => account.mapping.status.startsWith('hold_')).length !== 0) {
  throw new Error('Every source account must resolve to a current canonical taxon');
}

const accountByTargetId = new Map();
for (const account of accounts) {
  for (const insectId of account.mapping.insect_ids) accountByTargetId.set(insectId, account);
}
const cinctipennis = accounts.find((account) => scientificKey(account.genus, account.species) === 'hemipyxis cinctipennis');
if (!cinctipennis || cinctipennis.subspecies) throw new Error('Missing unqualified Hemipyxis cinctipennis account');
cinctipennis.mapping.insect_ids.push('species-H084');
accountByTargetId.set('species-H084', cinctipennis);

const desiredHosts = [];
for (const account of accounts) {
  for (const insectId of account.mapping.insect_ids) {
    const plants = plantsForAccount(account, insectId);
    for (const plantName of plants) {
      const plantFamily = families.get(plantName) || '';
      const [plantPart, lifeStage] = hostUse(insectId, plantName);
      desiredHosts.push({
        insect_id: insectId,
        plant_name: plantName,
        plant_family: plantFamily,
        observation_type: ['species-H002', 'species-H082', 'species-H119'].includes(insectId)
          ? '国外'
          : '野外（国内）',
        plant_part: plantPart,
        life_stage: lifeStage,
        reference: SOURCE,
        notes: '',
        account,
      });
    }
  }
}
const missingPlantFamilies = [...new Set(desiredHosts.filter((row) => !row.plant_family).map((row) => row.plant_name))];
if (missingPlantFamilies.length) throw new Error(`Unknown plant families: ${missingPlantFamilies.join(', ')}`);
const desiredHostByPair = new Map();
for (const desired of desiredHosts) {
  const key = `${desired.insect_id}\u0000${desired.plant_name}`;
  if (desiredHostByPair.has(key)) throw new Error(`Duplicate desired host pair: ${key}`);
  desiredHostByPair.set(key, desired);
}
if (desiredHosts.length !== 206) throw new Error(`Expected 206 approved host facts, got ${desiredHosts.length}`);

const desiredNotes = [];
for (const account of accounts) {
  for (const insectId of account.mapping.insect_ids) {
    const emergence = emergenceContent(account, insectId);
    if (emergence) desiredNotes.push({ insect_id: insectId, note_type: '出現時期', content: emergence, account });
    const ecology = ecologyContent(account, insectId);
    if (ecology) desiredNotes.push({ insect_id: insectId, note_type: '生態情報', content: ecology, account });
  }
}
if (desiredNotes.filter((note) => note.note_type === '出現時期').length !== 103) {
  throw new Error(`Expected 103 emergence notes, got ${desiredNotes.filter((n) => n.note_type === '出現時期').length}`);
}
if (desiredNotes.filter((note) => note.note_type === '生態情報').length !== 95) {
  throw new Error(`Expected 95 ecology notes, got ${desiredNotes.filter((n) => n.note_type === '生態情報').length}`);
}

const referenceParts = (value) => String(value || '').split(/\s*;\s*/u).filter(Boolean);
const hasReference = (value, reference) => referenceParts(value).includes(reference);
const withReference = (value, reference) => [...new Set([...referenceParts(value), reference])].join('; ');
const withoutReference = (value, reference) => referenceParts(value).filter((part) => part !== reference).join('; ');
const wrongInsectMap = new Map([['species-H676', 'species-H089']]);
const effectiveHostKey = (row) => `${wrongInsectMap.get(row.insect_id) || row.insect_id}\u0000${normalizePlantName(row.plant_name)}`;
const currentSourceHosts = allHosts.filter((row) => hasReference(row.reference, SOURCE));
const availableSourceRows = new Map();
for (const row of currentSourceHosts) {
  const key = effectiveHostKey(row);
  if (!availableSourceRows.has(key)) availableSourceRows.set(key, []);
  availableSourceRows.get(key).push(row);
}
const globalRowsByPair = new Map();
for (const row of allHosts) {
  const key = `${row.insect_id}\u0000${normalizePlantName(row.plant_name)}`;
  if (!globalRowsByPair.has(key)) globalRowsByPair.set(key, []);
  globalRowsByPair.get(key).push(row);
}

const hostActions = [];
let hostSequence = 0;
const hostAction = (action, before, after, desired, reason) => {
  hostSequence += 1;
  hostActions.push({
    action_id: `H6-HOST-${String(hostSequence).padStart(4, '0')}`,
    action,
    before,
    after,
    reason,
    verification_status: 'original_pdf_page_verified',
    source: {
      reference: SOURCE,
      account_id: desired?.account?.source_account_id || '',
      printed_page: desired?.account?.source_printed_page || null,
      pdf_page: desired?.account?.source_pdf_page || null,
      pdf_sha256: PDF_SHA256,
    },
  });
};

const usedHostIds = new Set();
let addedHostIndex = 0;
for (const [key, desired] of [...desiredHostByPair.entries()].sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))) {
  const sourceCandidates = (availableSourceRows.get(key) || []).filter((row) => !usedHostIds.has(row.record_id));
  const sourceCandidate = sourceCandidates.find((row) => row.insect_id === desired.insect_id);
  if (sourceCandidate) {
    usedHostIds.add(sourceCandidate.record_id);
    const after = {
      ...sourceCandidate,
      insect_id: desired.insect_id,
      plant_name: desired.plant_name,
      plant_family: desired.plant_family,
      observation_type: desired.observation_type,
      plant_part: desired.plant_part,
      life_stage: desired.life_stage,
      reference: withReference(sourceCandidate.reference, SOURCE),
      notes: '',
    };
    if (JSON.stringify(sourceCandidate) !== JSON.stringify(after)) {
      hostAction(
        sourceCandidate.insect_id !== after.insect_id ? 'move_hostplant' : 'update_hostplant',
        sourceCandidate,
        after,
        desired,
        '原本の分類群・植物名・利用部位・生活段階・出典・公開注記へ正規化',
      );
    }
    continue;
  }
  const reusable = (globalRowsByPair.get(key) || []).find((row) => !hasReference(row.reference, SOURCE));
  if (reusable) {
    const after = { ...reusable, reference: withReference(reusable.reference, SOURCE) };
    hostAction('append_source_reference', reusable, after, desired, '同一の昆虫－植物関係へ原本出典を追記し重複行を作らない');
    continue;
  }
  const movedSourceCandidate = sourceCandidates[0];
  if (movedSourceCandidate) {
    usedHostIds.add(movedSourceCandidate.record_id);
    const after = {
      ...movedSourceCandidate,
      insect_id: desired.insect_id,
      plant_name: desired.plant_name,
      plant_family: desired.plant_family,
      observation_type: desired.observation_type,
      plant_part: desired.plant_part,
      life_stage: desired.life_stage,
      reference: withReference(movedSourceCandidate.reference, SOURCE),
      notes: '',
    };
    hostAction(
      'move_hostplant',
      movedSourceCandidate,
      after,
      desired,
      '誤帰属行を原本と現行目録で確認した正準分類群へ移動',
    );
    continue;
  }
  addedHostIndex += 1;
  const after = {
    record_id: `hostplant-hamushi6-audit-20260712-${String(addedHostIndex).padStart(4, '0')}`,
    insect_id: desired.insect_id,
    plant_name: desired.plant_name,
    plant_family: desired.plant_family,
    observation_type: desired.observation_type,
    plant_part: desired.plant_part,
    life_stage: desired.life_stage,
    reference: SOURCE,
    notes: '',
  };
  hostAction('add_hostplant', null, after, desired, '原本で明示された食草を追加');
}

for (const row of currentSourceHosts) {
  if (usedHostIds.has(row.record_id)) continue;
  const remainingReference = withoutReference(row.reference, SOURCE);
  const after = remainingReference ? { ...row, reference: remainingReference } : null;
  const effectiveKey = effectiveHostKey(row);
  const desired = desiredHostByPair.get(effectiveKey) || { account: accountByTargetId.get(wrongInsectMap.get(row.insect_id) || row.insect_id) };
  hostAction(
    after ? 'remove_source_reference' : 'delete_unsupported_or_misattributed',
    row,
    after,
    desired,
    desiredHostByPair.has(effectiveKey)
      ? '同一関係を別の既存行へ統合'
      : '原本で疑問視・推測・非特定、または当該記事にない誤帰属',
  );
}

const currentSourceNotes = allNotes.filter((row) => hasReference(row.reference, SOURCE));
const effectiveNoteInsect = (row) => wrongInsectMap.get(row.insect_id) || row.insect_id;
const notesByKey = new Map();
for (const row of currentSourceNotes) {
  const key = `${effectiveNoteInsect(row)}\u0000${row.note_type}`;
  if (!notesByKey.has(key)) notesByKey.set(key, []);
  notesByKey.get(key).push(row);
}

const noteActions = [];
let noteSequence = 0;
const noteAction = (action, before, after, desired, reason) => {
  noteSequence += 1;
  noteActions.push({
    action_id: `H6-NOTE-${String(noteSequence).padStart(4, '0')}`,
    action,
    before,
    after,
    reason,
    verification_status: 'original_pdf_page_verified',
    source: {
      reference: SOURCE,
      account_id: desired?.account?.source_account_id || '',
      printed_page: desired?.account?.source_printed_page || null,
      pdf_page: desired?.account?.source_pdf_page || null,
      pdf_sha256: PDF_SHA256,
    },
  });
};

const usedNoteIds = new Set();
let addedNoteIndex = 0;
for (const desired of desiredNotes.sort((left, right) => (
  left.insect_id.localeCompare(right.insect_id, 'en', { numeric: true })
  || left.note_type.localeCompare(right.note_type, 'ja')
))) {
  const key = `${desired.insect_id}\u0000${desired.note_type}`;
  const candidate = (notesByKey.get(key) || []).find((row) => !usedNoteIds.has(row.record_id));
  if (candidate) {
    usedNoteIds.add(candidate.record_id);
    const after = {
      ...candidate,
      insect_id: desired.insect_id,
      note_type: desired.note_type,
      content: desired.content,
      reference: withReference(candidate.reference, SOURCE),
      page: String(desired.account.source_printed_page),
      year: YEAR,
    };
    if (JSON.stringify(candidate) !== JSON.stringify(after)) {
      noteAction(
        candidate.insect_id !== after.insect_id ? 'move_general_note' : 'replace_general_note',
        candidate,
        after,
        desired,
        '推測・評論を除外し、原本の客観的な生息地・幼生期・出現時期へ置換',
      );
    }
    continue;
  }
  addedNoteIndex += 1;
  const after = {
    record_id: `note-hamushi6-audit-20260712-${String(addedNoteIndex).padStart(4, '0')}`,
    insect_id: desired.insect_id,
    note_type: desired.note_type,
    content: desired.content,
    reference: SOURCE,
    page: String(desired.account.source_printed_page),
    year: YEAR,
  };
  noteAction('add_general_note', null, after, desired, '原本で確認した客観的情報を追加');
}

for (const row of currentSourceNotes) {
  if (usedNoteIds.has(row.record_id)) continue;
  const remainingReference = withoutReference(row.reference, SOURCE);
  const after = remainingReference ? { ...row, reference: remainingReference } : null;
  const desired = { account: accountByTargetId.get(effectiveNoteInsect(row)) };
  noteAction(
    after ? 'remove_source_reference' : 'delete_unsupported_or_duplicate',
    row,
    after,
    desired,
    '原本の安全な一般注記集合に含まれない推測・情報なし記述、または重複',
  );
}

const insectActions = [];

const sourceHostMembershipAfter = desiredHosts.length;
const sourceNoteMembershipAfter = desiredNotes.length;
const hostActionCounts = Object.fromEntries([...new Set(hostActions.map((action) => action.action))]
  .map((action) => [action, hostActions.filter((item) => item.action === action).length]));
const noteActionCounts = Object.fromEntries([...new Set(noteActions.map((action) => action.action))]
  .map((action) => [action, noteActions.filter((item) => item.action === action).length]));

const actionLedger = {
  schema_version: 1,
  generated_at: OUTPUT_DATE,
  source: {
    reference: SOURCE,
    citation: 'Takizawa, H. 2012. Kanagawa-Chûhô 177: 33–51.',
    pdf_path_hint: path.basename(PDF_PATH),
    pdf_sha256: PDF_SHA256,
    article_printed_pages: '33-51',
    article_pdf_pages: '35-53',
    evidence_policy: 'OCR/text extraction was used only as an index; every account and accepted fact was checked against the original PDF page image. Speculation, editorial taxonomy, collector advice, and uncertain food records are excluded.',
    subspecies_policy: 'An unqualified species-level account is shared to a represented subspecies only when the source does not restrict the fact by subspecies, island, or region. Explicit subspecies accounts are not spread.',
    taxonomy_references: [
      {
        title: '日本列島の甲虫全種目録（ハムシ科・ヒゲナガハムシ亜科）',
        url: CURRENT_CATALOG_URL,
        use: '旧学名・異名から現行canonical taxonへの対応',
      },
      {
        title: 'Takizawa 2015, Description of New Taxa of Chrysomelidae from Japan',
        url: OSIMAENSIS_DESCRIPTION_URL,
        use: '2012年の日本産Longitarsus tabidus概念をL. osimaensisへ対応',
      },
      {
        title: 'Konstantinov et al. 2011, Revision of the Palaearctic Chaetocnema Species',
        url: CHAETOCNEMA_REVISION_URL,
        use: 'C. mandschuricaをC. majorとは別の独立種として確認',
      },
      {
        title: 'Sergeev 2024, Longitarsus osimaensis from the continental Far East',
        url: OSIMAENSIS_REVIEW_URL,
        use: 'L. osimaensisと欧州L. tabidusの区別をダブルチェック',
      },
    ],
  },
  counts: {
    source_accounts: accounts.length,
    mapped_source_accounts: accounts.filter((account) => account.mapping.insect_ids.length).length,
    held_source_accounts: accounts.filter((account) => !account.mapping.insect_ids.length).length,
    approved_host_memberships_after: sourceHostMembershipAfter,
    approved_emergence_note_memberships_after: desiredNotes.filter((note) => note.note_type === '出現時期').length,
    approved_ecology_note_memberships_after: desiredNotes.filter((note) => note.note_type === '生態情報').length,
    approved_note_memberships_after: sourceNoteMembershipAfter,
    insect_actions: insectActions.length,
    host_actions: hostActions.length,
    note_actions: noteActions.length,
  },
  action_counts: {
    insects: {},
    hosts: hostActionCounts,
    notes: noteActionCounts,
  },
  insect_actions: insectActions,
  host_actions: hostActions,
  note_actions: noteActions,
};

const actionCountsByAccount = new Map();
for (const action of [...insectActions, ...hostActions, ...noteActions]) {
  const id = action.source.account_id;
  if (!id) continue;
  actionCountsByAccount.set(id, (actionCountsByAccount.get(id) || 0) + 1);
}
const accountRows = accounts.map((account) => {
  const acceptedPlants = account.mapping.insect_ids.flatMap((insectId) => (
    desiredHosts.filter((row) => row.account.source_account_id === account.source_account_id && row.insect_id === insectId)
      .map((row) => `${insectId}:${row.plant_name}`)
  ));
  const notes = desiredNotes.filter((row) => row.account.source_account_id === account.source_account_id);
  return {
    source_account_id: account.source_account_id,
    printed_page: account.source_printed_page,
    pdf_page: account.source_pdf_page,
    source_japanese_name: account.source_japanese_name,
    source_scientific_name: account.source_scientific_name,
    mapping_status: account.mapping.status,
    mapping_evidence: account.mapping.status === 'mapped_override'
      ? (scientificKey(account.genus, account.species) === 'chaetocnema mandschurica'
        ? 'Konstantinov et al. 2011の独立種再確認と現行目録'
        : scientificKey(account.genus, account.species) === 'longitarsus tabidus'
        ? 'Takizawa 2015原記載・現行目録・Sergeev 2024再検討'
        : '現行日本列島の甲虫全種目録の旧学名・異名欄')
      : account.mapping.status === 'mapped_scientific'
        ? '現行学名の属名・種小名・明示亜種の一致'
        : '原本和名と現行和名・別名の一意一致',
    current_insect_ids: account.mapping.insect_ids.join(';'),
    source_food_text: account.fields['食草'] || '',
    accepted_host_memberships: acceptedPlants.join(';'),
    source_emergence_text: account.fields['成虫出現期'] || '',
    approved_emergence_notes: notes.filter((row) => row.note_type === '出現時期')
      .map((row) => `${row.insect_id}:${row.content}`).join(';'),
    source_habitat_text: account.fields['棲息地'] || '',
    source_larval_text: account.fields['幼生期'] || '',
    approved_ecology_notes: notes.filter((row) => row.note_type === '生態情報')
      .map((row) => `${row.insect_id}:${row.content}`).join(';'),
    mutation_count: actionCountsByAccount.get(account.source_account_id) || 0,
    verification_status: 'original_pdf_page_verified',
  };
});

fs.writeFileSync(ACCOUNT_LEDGER_PATH, `\ufeff${Papa.unparse(accountRows, { newline: '\r\n' })}\r\n`, 'utf8');
fs.writeFileSync(ACTION_LEDGER_PATH, `${JSON.stringify(actionLedger, null, 2)}\n`, 'utf8');
const ledgerHash = sha256(fs.readFileSync(ACTION_LEDGER_PATH));
const report = `# 日本産ハムシ科生態覚書 (6) 全アカウント原本監査（2026-07-12）

## 結論

- 原著 PDF の掲載19ページ（印刷頁33–51、PDF頁35–53）を目視し、全112種アカウントを台帳化した。
- 現行目録の異名欄まで照合し、全112アカウントを現行の正準分類群へ対応させた。
- 食草は206件、出現時期は103件、生態情報は95件を原本確認済みの公開対象とした。
- 亜種名のない Hemipyxis cinctipennis の種レベル情報だけを沖縄本島亜種へ共有し、明示亜種・島嶼限定記録は広げなかった。

## 原本と証拠

- 書誌: Takizawa, H. (2012), Kanagawa-Chûhô 177: 33–51
- 原本 SHA-256: \`${PDF_SHA256}\`
- action ledger SHA-256: \`${ledgerHash}\`
- OCR・抽出テキストは索引にのみ使い、採否は原PDFページ画像で決定した。
- 旧学名対応は[現行日本列島の甲虫全種目録](${CURRENT_CATALOG_URL})で確認した。
- \`Chaetocnema mandschurica\` は[2011年再検討](${CHAETOCNEMA_REVISION_URL})で独立種と確認し、\`C. major\`へ統合していない。
- p50の日本産 \`Longitarsus tabidus\` は[2015年原記載](${OSIMAENSIS_DESCRIPTION_URL})と[2024年再検討](${OSIMAENSIS_REVIEW_URL})も照合し、\`L. osimaensis\`へ対応した。

## 修正の要点

- 食草: 最終206件。疑問視された記録、推測食草、非特定の「草本」、記事にない誤帰属を除外した。
- 出現時期: 現行0件から103件へ。月範囲と客観的な採集月だけを採用した。
- 生態: 95件。明示生息地と観察された幼生期のみを採用し、「と思われる」「可能性」「不明」だけの説明を公開文から除いた。
- 分類対応: 現行目録の異名欄を使い、旧学名を重複取込側ではなく正準分類群へ対応させた。Hemipyxis plagioderoides の誤帰属は正準行へ統合した。

## 再現性

- 全アカウント台帳: \`${path.relative(ROOT, ACCOUNT_LEDGER_PATH)}\`
- exact action ledger: \`${path.relative(ROOT, ACTION_LEDGER_PATH)}\`
- build script: \`scripts/_build-japanese-leaf-beetle-ecology-notes-6-audit.mjs\`
`;
fs.writeFileSync(REPORT_PATH, report, 'utf8');

console.log(JSON.stringify({
  accounts: accounts.length,
  holds: accounts.filter((account) => !account.mapping.insect_ids.length).length,
  approved_host_memberships: sourceHostMembershipAfter,
  approved_note_memberships: sourceNoteMembershipAfter,
  insect_actions: insectActions.length,
  host_actions: hostActions.length,
  note_actions: noteActions.length,
  action_counts: actionLedger.action_counts,
  action_ledger_sha256: ledgerHash,
}, null, 2));
