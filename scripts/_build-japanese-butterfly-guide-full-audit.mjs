import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Papa from 'papaparse';

const ROOT = path.resolve(import.meta.dirname, '..');

function resolveOcrPath() {
  if (process.env.BUTTERFLY_GUIDE_OCR_PATH) {
    return path.resolve(process.env.BUTTERFLY_GUIDE_OCR_PATH);
  }
  const candidates = [
    path.join(ROOT, 'data/ocr/japanese-butterfly-guide/ocr-boxes.jsonl'),
    '/private/tmp/butterfly-guide-audit/ocr-boxes.jsonl',
    path.join(os.tmpdir(), 'butterfly-guide-audit/ocr-boxes.jsonl'),
  ];
  const existing = candidates.find((candidate) => fs.existsSync(candidate));
  if (existing) return existing;
  throw new Error('Butterfly-guide OCR candidate index not found; set BUTTERFLY_GUIDE_OCR_PATH');
}

const OCR_PATH = resolveOcrPath();
const SOURCE_REFERENCE = '日本産蝶類標準図鑑';
const SOURCE_PDF_SHA256 = '910e84199b94a18ab81071d5c7019655b20c03589eb1e8fbd7d668414eba0c5c';
const OCR_SHA256 = '5a7d0cce9b60692773878948af3311895a8c9a721bdc07c32bc1172ed548125e';

function readCsv(relativePath) {
  return Papa.parse(
    fs.readFileSync(path.join(ROOT, relativePath), 'utf8').replace(/^\uFEFF/, ''),
    { header: true, skipEmptyLines: true },
  ).data;
}

function stripDiacritics(value) {
  return String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function latinWord(value) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z]/g, '');
}

function latinWords(value) {
  return stripDiacritics(value)
    .match(/[A-Za-z]+(?:-[A-Za-z]+)*/g)
    ?.map(latinWord)
    .filter(Boolean) ?? [];
}

function japaneseKey(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(/[\s・･()（）\[\]［］【】]/g, '')
    .replace(/チョワ/g, 'チョウ')
    .replace(/スジ/g, 'スジ');
}

function levenshtein(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  return 1 - (levenshtein(a, b) / Math.max(a.length, b.length));
}

function scienceSimilarity(a, b) {
  return (similarity(a.genus, b.genus) * 0.42) + (similarity(a.species, b.species) * 0.58);
}

function currentBinomial(row) {
  return { genus: latinWord(row.genus), species: latinWord(row.species) };
}

function sourceBinomial(value) {
  const words = latinWords(value);
  return { genus: words[0] ?? '', species: words[1] ?? '' };
}

function isJapaneseHeading(line) {
  const text = line.text.trim();
  return line.y < 0.94
    && line.height >= 0.0202
    && /[ァ-ヶぁ-ん一-龠]/u.test(text)
    && !/[［【〔\[\]］】〕]/u.test(text)
    && !/[。、「」]/u.test(text)
    && text.length >= 3
    && text.length <= 25
    && !/(図版|解説|亜種|食草|分布|生態|変異|型|ページ|前翅|後翅|本種|日本産|標本|写真)/u.test(text);
}

function isScientificHeading(line) {
  const words = latinWords(line.text);
  return line.y < 0.94
    && line.height >= 0.0182
    && words.length >= 2
    && words[0].length >= 4
    && words[1].length >= 2;
}

function parsePrintedPages(page) {
  const result = { left: '', right: '' };
  for (const line of page.lines.filter((item) => item.y > 0.94 && item.text.includes('解説'))) {
    const match = line.text.match(/解説\s*(\d+)/u);
    if (!match) continue;
    result[line.x < 0.5 ? 'left' : 'right'] = match[1];
  }
  return result;
}

function extractSourceAccounts(pages) {
  const accounts = [];
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pdfPage = pageIndex + 1;
    const page = pages[pageIndex];
    if (
      pdfPage < 11
      || pdfPage > 164
      || !page.lines.some((line) => line.y > 0.94 && line.text.includes('解説'))
    ) continue;
    const printedPages = parsePrintedPages(page);
    const japaneseHeadings = page.lines.filter(isJapaneseHeading);
    const scientificHeadings = page.lines.filter(isScientificHeading);
    for (const japanese of japaneseHeadings) {
      const half = japanese.x < 0.5 ? 'left' : 'right';
      const candidates = scientificHeadings.filter((scientific) => (
        (scientific.x < 0.5 ? 'left' : 'right') === half
        && scientific.y < japanese.y
        && japanese.y - scientific.y <= 0.075
      )).sort((a, b) => (japanese.y - a.y) - (japanese.y - b.y));
      const scientific = candidates[0];
      if (!scientific) continue;
      accounts.push({
        source_pdf_page: String(pdfPage),
        source_printed_page: printedPages[half],
        half,
        y: japanese.y,
        source_japanese_name_ocr: japanese.text,
        source_scientific_name_ocr: scientific.text,
        ...sourceBinomial(scientific.text),
      });
    }
  }
  accounts.sort((a, b) => (
    Number(a.source_pdf_page) - Number(b.source_pdf_page)
    || (a.half === b.half ? 0 : a.half === 'left' ? -1 : 1)
    || b.y - a.y
  ));
  return accounts.map((account, index) => ({
    source_account_id: `BTG-${String(index + 1).padStart(4, '0')}`,
    ...account,
  }));
}

const insects = readCsv('normalized_data/insects.csv').filter((row) => {
  const numericId = Number(row.insect_id.replace(/^species-/, ''));
  return numericId >= 20167 && numericId <= 20436;
});
const hostplants = readCsv('normalized_data/hostplants.csv')
  .filter((row) => row.reference === SOURCE_REFERENCE);
const generalNotes = readCsv('normalized_data/general_notes.csv')
  .filter((row) => row.reference === SOURCE_REFERENCE);
const pages = fs.readFileSync(OCR_PATH, 'utf8').trim().split('\n').map(JSON.parse);
const accounts = extractSourceAccounts(pages);

const matches = insects.map((insect) => {
  const binomial = currentBinomial(insect);
  const rankedByScience = accounts.map((account) => ({
    account,
    score: scienceSimilarity(binomial, account),
  })).sort((a, b) => b.score - a.score);
  const rankedByJapanese = accounts.map((account) => ({
    account,
    score: similarity(japaneseKey(insect.japanese_name), japaneseKey(account.source_japanese_name_ocr)),
  })).sort((a, b) => b.score - a.score);
  return {
    insect,
    binomial,
    science: rankedByScience[0],
    scienceSecond: rankedByScience[1],
    japanese: rankedByJapanese[0],
    japaneseSecond: rankedByJapanese[1],
    hostCount: hostplants.filter((row) => row.insect_id === insect.insect_id).length,
    noteCount: generalNotes.filter((row) => row.insect_id === insect.insect_id).length,
  };
});

const japaneseEdges = [];
for (const insect of insects) {
  for (const account of accounts) {
    japaneseEdges.push({
      insect,
      account,
      score: similarity(japaneseKey(insect.japanese_name), japaneseKey(account.source_japanese_name_ocr)),
    });
  }
}
japaneseEdges.sort((a, b) => b.score - a.score);
const assignedInsects = new Set();
const assignedAccounts = new Set();
const japaneseAssignments = [];
for (const edge of japaneseEdges) {
  if (assignedInsects.has(edge.insect.insect_id) || assignedAccounts.has(edge.account.source_account_id)) continue;
  assignedInsects.add(edge.insect.insect_id);
  assignedAccounts.add(edge.account.source_account_id);
  japaneseAssignments.push(edge);
}
const unmatchedSourceAccounts = accounts.filter((account) => !assignedAccounts.has(account.source_account_id));

const nameCorrections = [
  ['species-20171', 'ヒメウスバアゲハ', 'ヒメウスバアゲハ'],
  ['species-20172', 'キイロウスバアゲハ', 'キイロウスバアゲハ'],
  ['species-20327', 'コヒョウモン', 'コヒョウモン'],
  ['species-20329', 'カラフトヒョウモン', 'カラフトヒョウモン'],
  ['species-20344', 'ホシミスジ', 'ホシミスジ'],
  ['species-20346', 'オオミスジ', 'オオミスジ'],
  ['species-20347', 'コミスジ', 'コミスジ'],
  ['species-20348', 'リュウキュウミスジ', 'リュウキュウミスジ'],
  ['species-20350', 'ミスジチョウ', 'ミスジチョウ'],
  ['species-20373', 'ツマジロウラジャノメ', 'ツマジロウラジャノメ'],
  ['species-20380', 'ヒカゲチョウ', 'ヒカゲチョワ'],
  ['species-20382', 'クロヒカゲモドキ', 'クロヒカゲモドキ'],
  ['species-20389', 'タイワンアサギマダラ', 'タイワンアサギマダラ'],
  ['species-20395', 'ガランピマダラ', 'ガランピマダラ'],
  ['species-20397', 'ツマムラサキマダラ', 'ツマムラサキマダラ'],
  ['species-20400', 'ルリマダラ', 'ルリマダラ'],
  ['species-20401', 'タイワンアオバセセリ', 'タイワンアオバセセリ'],
  ['species-20419', 'ヒメキマダラセセリ', 'ヒメキマダラセセリ'],
  ['species-20431', 'ヒメイチモンジセセリ', 'ヒメイチモンジセセリ'],
  ['species-20432', 'イチモンジセセリ', 'イチモンジセセリ'],
  ['species-20434', 'ミヤマチャバネセセリ', 'ミヤマチャバネセセリ'],
];

const insectById = new Map(insects.map((row) => [row.insect_id, row]));
const accountByOcrJapanese = new Map(accounts.map((account) => [account.source_japanese_name_ocr, account]));
const nameActionById = new Map();
const nameActions = nameCorrections.map(([insectId, correctedName, accountOcrName]) => {
  const before = insectById.get(insectId);
  const account = accountByOcrJapanese.get(accountOcrName);
  if (!before || !account) throw new Error(`Missing name-action source: ${insectId} / ${accountOcrName}`);
  const after = { ...before, japanese_name: correctedName };
  const action = {
    action_id: `BTG-NAME-${insectId.replace('species-', '')}`,
    action: 'update_insect_japanese_name',
    before,
    after,
    source: {
      reference: SOURCE_REFERENCE,
      pdf_page: Number(account.source_pdf_page),
      printed_page: account.source_printed_page ? Number(account.source_printed_page) : null,
      source_account_id: account.source_account_id,
      source_japanese_name: correctedName,
      source_scientific_name_ocr: account.source_scientific_name_ocr,
      pdf_sha256: SOURCE_PDF_SHA256,
    },
    verification_status: 'original_image_verified',
    decision: 'The source heading pairs this Japanese name with the current row scientific name.',
  };
  nameActionById.set(insectId, action);
  return action;
});

const insectColumns = Object.keys(insects[0]);
function emptyInsectRow(values) {
  return Object.fromEntries(insectColumns.map((column) => [column, values[column] ?? '']));
}

const newTaxonSpecs = [
  {
    insect_id: 'species-BTG-001', family: 'Nymphalidae', family_jp: 'タテハチョウ科',
    subfamily: 'Limenitidinae', subfamily_jp: 'イチモンジチョウ亜科', genus: 'Athyma',
    species: 'selenophora', author: 'Kollar', year: '1844', japanese_name: 'ヤエヤマイチモンジ',
    scientific_name: 'Athyma selenophora (Kollar, 1844)', source_name: 'ヤエヤマイチモンジ', pdf_page: 118,
  },
  {
    insect_id: 'species-BTG-002', family: 'Nymphalidae', family_jp: 'タテハチョウ科',
    subfamily: 'Danainae', subfamily_jp: 'マダラチョウ亜科', genus: 'Danaus',
    species: 'melanippus', author: 'Cramer', year: '1777', japanese_name: 'スジグロシロマダラ',
    scientific_name: 'Danaus melanippus (Cramer, 1777)', source_name: 'スジグロシロマダラ', pdf_page: 145,
  },
  {
    insect_id: 'species-BTG-003', family: 'Nymphalidae', family_jp: 'タテハチョウ科',
    subfamily: 'Danainae', subfamily_jp: 'マダラチョウ亜科', genus: 'Euploea',
    species: 'midamus', author: 'Linnaeus', year: '1758', japanese_name: 'ミダムスルリマダラ',
    scientific_name: 'Euploea midamus (Linnaeus, 1758)', source_name: 'ミダムスルリマダラ', pdf_page: 145,
  },
  {
    insect_id: 'species-BTG-004', family: 'Hesperiidae', family_jp: 'セセリチョウ科',
    subfamily: 'Hesperiinae', subfamily_jp: 'セセリチョウ亜科', genus: 'Suastus',
    species: 'gremius', author: 'Fabricius', year: '1798', japanese_name: 'クロボシセセリ',
    scientific_name: 'Suastus gremius (Fabricius, 1798)', source_name: 'クロボシセセリ', pdf_page: 155,
  },
];

for (const spec of newTaxonSpecs) {
  if (insectById.has(spec.insect_id)) throw new Error(`New taxon ID collision: ${spec.insect_id}`);
  if (insects.some((row) => latinWord(row.genus) === latinWord(spec.genus) && latinWord(row.species) === latinWord(spec.species))) {
    throw new Error(`New taxon scientific-name collision: ${spec.scientific_name}`);
  }
}

const newTaxonActions = newTaxonSpecs.map((spec) => {
  const account = accountByOcrJapanese.get(spec.source_name);
  return {
    action_id: `BTG-NEW-${spec.insect_id.replace('species-', '')}`,
    action: 'add_insect_taxon',
    before: null,
    after: emptyInsectRow(spec),
    source: {
      reference: SOURCE_REFERENCE,
      pdf_page: spec.pdf_page,
      printed_page: account?.source_printed_page ? Number(account.source_printed_page) : null,
      source_account_id: account?.source_account_id ?? null,
      pdf_sha256: SOURCE_PDF_SHA256,
    },
    verification_status: 'original_image_verified',
    collision_check: { insect_id: 0, scientific_binomial: 0 },
  };
});

const hostById = new Map(hostplants.map((row) => [row.record_id, row]));
const HOST_FAMILY_BY_PLANT = new Map([
  ...['ユキヤナギ', 'シモツケ', 'シジミバナ', 'コデマリ', 'イワガサ', 'ミツバイワガサ', 'ホザキシモツケ', 'イワシモツケ', 'アイヅシモツケ', 'イブキシモツケ']
    .map((plantName) => [plantName, 'バラ科']),
  ['シバザクラ', 'ハナシノブ科'],
  ...['ススキ', 'オオアブラススキ', 'チガヤ', 'アシ', 'ヒメノガリヤス', 'トダシバ', 'イヌムギ', 'クサヨシ', 'エノコログサ', 'オヒシバ', 'イヌビエ', 'シバ', 'ネザサ', 'アズマネザサ', 'ハチク', 'メダケ', 'リュウキュウチク', 'サトウキビ']
    .map((plantName) => [plantName, 'イネ科']),
  ['シラスゲ', 'カヤツリグサ科'],
  ...['アカミズキ', 'ヤエヤマコンロンカ', 'コンロンカ']
    .map((plantName) => [plantName, 'アカネ科']),
  ...['シュロチク', 'シンノウヤシ', 'ワシントンヤシ', 'カナリーヤシ', 'トックリヤシモドキ', 'トックリヤシ', 'カンノンチク', 'ヤハズヤシ', 'ビロウ']
    .map((plantName) => [plantName, 'ヤシ科']),
]);
let newHostCounter = 1;
function nextHostId() {
  const id = `hostplant-btg-full-audit-20260712-${String(newHostCounter).padStart(4, '0')}`;
  newHostCounter += 1;
  return id;
}

function sourceEvidence(pdfPage, evidence, sourceAccountName) {
  const account = sourceAccountName ? accountByOcrJapanese.get(sourceAccountName) : null;
  return {
    reference: SOURCE_REFERENCE,
    pdf_page: pdfPage,
    printed_page: account?.source_printed_page ? Number(account.source_printed_page) : null,
    source_account_id: account?.source_account_id ?? null,
    pdf_sha256: SOURCE_PDF_SHA256,
    evidence,
  };
}

function addHost(insectId, plantName, pdfPage, sourceAccountName, notes = '') {
  const plantFamily = HOST_FAMILY_BY_PLANT.get(plantName);
  if (!plantFamily) throw new Error(`Missing plant family for added host: ${plantName}`);
  const after = {
    record_id: nextHostId(), insect_id: insectId, plant_name: plantName, plant_family: plantFamily,
    observation_type: '文献', plant_part: '', life_stage: '幼虫', reference: SOURCE_REFERENCE, notes,
  };
  return {
    action_id: `BTG-HOST-ADD-${after.record_id}`,
    action: 'add_hostplant', before: null, after,
    source: sourceEvidence(pdfPage, `原本の［食草］欄に ${plantName} を明記。`, sourceAccountName),
    verification_status: 'original_image_verified',
  };
}

function updateHost(recordId, afterPatch, action, pdfPage, evidence, sourceAccountName) {
  const before = hostById.get(recordId);
  if (!before) throw new Error(`Missing host row: ${recordId}`);
  return {
    action_id: `BTG-HOST-${action.toUpperCase()}-${recordId}`,
    action, before, after: afterPatch ? { ...before, ...afterPatch } : null,
    source: sourceEvidence(pdfPage, evidence, sourceAccountName),
    verification_status: 'original_image_verified',
  };
}

const hostActions = [
  updateHost(
    'hostplant-006120', null, 'delete_unsupported_hold', 118,
    'リュウキュウフジはヤエヤマイチモンジの原本食草欄にも、Neptis pryeri の原本食草欄にもない。旧行は監査台帳に保持し、公開正規化から隔離する。',
    'ヤエヤマイチモンジ',
  ),
  updateHost(
    'hostplant-006352', null, 'merge_duplicate', 164,
    'ヨシは Parnara guttata の「アシ（ヨシ）」に対応するが、移動先 species-20432 に同一行 hostplant-909156 がある。',
    'イチモンジセセリ',
  ),
  updateHost(
    'hostplant-006353', null, 'delete_unsupported_hold', 163,
    'マコモは Parnara bada の原本食草欄に明記されず、移動先候補 Parnara guttata の原本食草欄にもない。',
    'ヒメイチモンジセセリ',
  ),
  updateHost(
    'hostplant-006354', { insect_id: 'species-20432' }, 'move_hostplant', 164,
    'アシボソは Parnara guttata の原本食草欄に明記。', 'イチモンジセセリ',
  ),
  updateHost(
    'hostplant-006366', { insect_id: 'species-20432' }, 'move_hostplant', 164,
    'メヒシバは Pelopidas jansonis の原本食草欄にはなく、Parnara guttata の原本食草欄に明記。',
    'イチモンジセセリ',
  ),
  updateHost(
    'hostplant-909158', null, 'delete_unsupported_hold', 164,
    'マコモは Parnara guttata の原本食草欄に明記されない。旧行は監査台帳に保持し、公開正規化から隔離する。',
    'イチモンジセセリ',
  ),
];

for (const plant of ['ユキヤナギ', 'シモツケ', 'シジミバナ', 'コデマリ', 'イワガサ', 'ミツバイワガサ', 'シバザクラ', 'ホザキシモツケ', 'イワシモツケ', 'アイヅシモツケ', 'イブキシモツケ']) {
  const notes = plant === 'ミツバイワガサ' ? '原文：ミツバイワガサ（タンゴイワガサ）' : '';
  hostActions.push(addHost('species-20344', plant, 119, 'ホシミスジ', notes));
}
hostActions.push(addHost('species-20431', 'ススキ', 163, 'ヒメイチモンジセセリ'));
for (const plant of ['オオアブラススキ', 'チガヤ', 'アシ', 'ヒメノガリヤス', 'トダシバ']) {
  const notes = plant === 'アシ' ? '原文：アシ（ヨシ）' : '';
  hostActions.push(addHost('species-20434', plant, 162, 'ミヤマチャバネセセリ', notes));
}
for (const plant of ['イヌムギ', 'クサヨシ', 'エノコログサ', 'オヒシバ', 'イヌビエ', 'チガヤ', 'シバ', 'ネザサ', 'アズマネザサ', 'ハチク', 'メダケ', 'リュウキュウチク', 'サトウキビ', 'シラスゲ']) {
  const notes = plant === 'イヌビエ' ? '原文：イヌビエ（ノビエ）' : plant === 'シラスゲ' ? 'カヤツリグサ科' : '';
  hostActions.push(addHost('species-20432', plant, 164, 'イチモンジセセリ', notes));
}
for (const plant of ['アカミズキ', 'ヤエヤマコンロンカ', 'コンロンカ']) {
  hostActions.push(addHost('species-BTG-001', plant, 118, 'ヤエヤマイチモンジ'));
}
for (const [plant, notes] of [
  ['シュロチク', 'ヤシ科'], ['シンノウヤシ', 'ヤシ科'], ['ワシントンヤシ', 'ヤシ科'],
  ['カナリーヤシ', '原文：カナリーヤシ（フェニックス）'], ['トックリヤシモドキ', 'ヤシ科'],
  ['トックリヤシ', 'ヤシ科'], ['カンノンチク', 'ヤシ科'],
  ['ヤハズヤシ', '原文：ヤハズヤシ（コモチケンチャ）'], ['ビロウ', '原文：ビロウ（クバ）'],
]) {
  hostActions.push(addHost('species-BTG-004', plant, 155, 'クロボシセセリ', notes));
}

const correctedIds = new Set(nameCorrections.map(([insectId]) => insectId));
const hostReviews = hostplants
  .filter((row) => correctedIds.has(row.insect_id))
  .map((row) => {
    const change = hostActions.find((action) => action.before?.record_id === row.record_id);
    return {
      record_id: row.record_id,
      insect_id: row.insect_id,
      plant_name: row.plant_name,
      decision: change?.action ?? 'keep_source_scientific_account_supported',
      action_id: change?.action_id ?? '',
    };
  });

const noteById = new Map(generalNotes.map((row) => [row.record_id, row]));
function noteAction(recordId, action, patch, pdfPage, sourceAccountName, decision) {
  const before = noteById.get(recordId);
  if (!before) throw new Error(`Missing note row: ${recordId}`);
  return {
    action_id: `BTG-NOTE-${action.toUpperCase()}-${recordId}`,
    action,
    before,
    after: patch ? { ...before, ...patch } : null,
    source: sourceEvidence(pdfPage, decision, sourceAccountName),
    verification_status: 'original_image_verified',
    decision,
  };
}

let newNoteCounter = 1;
function addNote(insectId, noteType, content, pdfPage, sourceAccountName) {
  const after = {
    record_id: `note-btg-full-audit-20260712-${String(newNoteCounter).padStart(4, '0')}`,
    insect_id: insectId, note_type: noteType, content, reference: SOURCE_REFERENCE,
    page: String(pdfPage), year: '',
  };
  newNoteCounter += 1;
  return {
    action_id: `BTG-NOTE-ADD-${after.record_id}`,
    action: 'add_general_note', before: null, after,
    source: sourceEvidence(pdfPage, '原本の生態欄に明記。', sourceAccountName),
    verification_status: 'original_image_verified',
  };
}

const noteActions = [
  noteAction('note-1004935', 'move_general_note', { insect_id: 'species-20204' }, 33, 'ヤマトスジグロシロチョウ', '本文位置はヤマトスジグロシロチョウの生態欄。'),
  noteAction('note-1004947', 'delete_duplicate_spill', null, 120, 'イチモンジチョウ', 'イチモンジチョウの既存注記に含まれる別分類群への重複流入。'),
  noteAction('note-1004984', 'delete_duplicate_spill', null, 110, 'ミドリヒョウモン', '同一内容の正規行 note-1005163 がある。'),
  noteAction('note-1004999', 'move_general_note', { insect_id: 'species-20367' }, 130, 'リュウキュウウラナミジャノメ', '本文位置はリュウキュウウラナミジャノメの生態欄。'),
  noteAction('note-1005027', 'delete_duplicate_spill', null, 163, 'チャバネセセリ', 'Pelopidas jansonis の注記ではなく、同一誤内容が別行にもある。'),
  noteAction('note-1005047', 'delete_duplicate_spill', null, 38, 'ヤマキチョウ', '同一内容の正規行 note-1004939 がある。'),
  noteAction('note-1005048', 'delete_duplicate_spill', null, 35, 'ツマグロキチョウ', 'ツマグロキチョウの既存注記に含まれる別分類群への流入。'),
  noteAction('note-1005051', 'delete_duplicate_spill', null, 74, 'ゴイシツバメシジミ', '同一内容の正規行 note-1004962 がある。'),
  noteAction('note-1005061', 'delete_duplicate_spill', null, 58, 'オオミドリシジミ', '同一内容の正規行 note-1004952 がある。'),
  noteAction('note-1005071', 'delete_duplicate_spill', null, 76, 'リュウキュウウラボシシジミ', '同一内容の正規行 note-1004963 がある。'),
  noteAction('note-1005080', 'delete_duplicate_spill', null, 84, 'ヒメシジミ', '同一内容の正規行 note-1005159 がある。'),
  noteAction('note-1005087', 'update_general_note_page', { page: '94' }, 94, 'サカハチチョウ', 'ページ6は誤記。原本のサカハチチョウ解説はPDF94頁。'),
  noteAction('note-1005088', 'move_general_note', { insect_id: 'species-20315' }, 97, 'クジャクチョウ', '本文位置はクジャクチョウの生態欄。'),
  noteAction('note-1005090', 'delete_duplicate_spill', null, 93, 'テングチョウ', '同一内容の正規行 note-1004969 がある。'),
  noteAction('note-1005096', 'delete_duplicate_spill', null, 102, 'リュウキュウムラサキ', '同一内容の正規行 note-1004978 がある。'),
  noteAction('note-1005098', 'move_general_note', { insect_id: 'species-20332', content: '6月下旬、7月上旬～11月下旬、7月上旬～9月、10月' }, 109, 'オオウラギンスジヒョウモン', '本文位置はオオウラギンスジヒョウモンの生態欄。OCRで欠落した「11月下旬」も原本画像から復元。'),
  noteAction('note-1005099', 'move_general_note', { insect_id: 'species-20331' }, 108, 'ウラギンスジヒョウモン', '本文位置はウラギンスジヒョウモンの生態欄。'),
  noteAction('note-1005162', 'move_general_note', { insect_id: 'species-20329' }, 107, 'カラフトヒョウモン', '本文位置はカラフトヒョウモンの生態欄。'),
  noteAction('note-1005097', 'move_general_note', { insect_id: 'species-20327' }, 108, 'コヒョウモン', '本文位置はコヒョウモンの生態欄。'),
  noteAction('note-1005104', 'move_general_note', { insect_id: 'species-20350' }, 118, 'ミスジチョウ', '本文位置はミスジチョウの生態欄。'),
  noteAction('note-1004990', 'move_general_note', { insect_id: 'species-20344' }, 119, 'ホシミスジ', '本文位置はホシミスジの生態欄。'),
  noteAction('note-1005003', 'delete_unsupported_hold', null, 133, 'ウラジャノメ', 'Lopinga achine の現行受容先は追加資料なしで断定しない。現行 species-20373 への誤帰属は原本で確認できるため、旧行を台帳に保持して公開正規化から隔離する。'),
  noteAction('note-1005166', 'delete_duplicate_spill', null, 139, 'ヒカゲチョウ', '同一内容の正規行 note-1005008 があり、Lethe marginalis の注記ではない。'),
  noteAction('note-1005122', 'delete_unsupported_hold', null, 146, 'シロオビマダラ', 'Euploea camaralzeman の現行受容先は追加資料なしで断定しない。現行 species-20397 への誤帰属は原本で確認できるため、旧行を台帳に保持して公開正規化から隔離する。'),
  noteAction('note-1005123', 'delete_non_biological_date_spill', null, 146, 'ガランピマダラ', '採集記録の月だけを出現時期として切り出した行。'),
  noteAction('note-1005017', 'delete_unsupported_hold', null, 150, 'アオバセセリ', 'Choaspes benjaminii の現行受容先は追加資料なしで断定しない。現行 species-20401 への誤帰属は原本で確認できるため、旧行を台帳に保持して公開正規化から隔離する。'),
  noteAction('note-1005137', 'delete_unsupported_hold', null, 163, 'チャバネセセリ', 'Parnara bada の生態欄に対応しない月列。旧行を台帳に保持して公開正規化から隔離する。'),
  noteAction('note-1005138', 'replace_general_note', { page: '164', content: noteById.get('note-1005139')?.content ?? '' }, 164, 'イチモンジセセリ', '同一学名の既存 source-backed 行 note-1005139 の内容で置換。'),
  noteAction('note-1005105', 'delete_unsupported_hold', null, 119, 'コミスジ', '同頁複数アカウントの月列が混合しており、一意な原文復元前は適用しない。旧行を台帳に保持して公開正規化から隔離する。'),
  noteAction('note-1005110', 'delete_unsupported_hold', null, 125, 'ベニヒカゲ', 'Erebia ligea の開始頁と一致せず、本文位置を一意に確定できない。旧行を台帳に保持して公開正規化から隔離する。'),
  noteAction('note-000248', 'update_general_note_page', { page: '78' }, 78, 'ルリシジミ', '空欄だったページを原本の当該種解説開始頁に補完。'),
  noteAction('note-000249', 'update_general_note_page', { page: '87' }, 87, 'オオゴマシジミ', '空欄だったページを原本の当該種解説開始頁に補完。'),
  noteAction('note-1005175', 'replace_general_note', { content: '1月～11月' }, 163, 'ユウレイセセリ', 'OCRで両端が同じ数字になった月範囲を原本画像から復元。'),
  addNote('species-20232', '出現時期', '6月中旬～下旬、7月', 51, 'カシワアカシジミ'),
  addNote('species-BTG-001', '出現時期', '多化性。成虫は2～12月に採集記録があり、とくに7～8月の記録が多い。', 118, 'ヤエヤマイチモンジ'),
  addNote('species-BTG-002', '生態情報', '日本では八重山諸島からの記録のみで、生態的知見はほとんど報告されていない。訪花中の個体が採集されている。日本での幼虫食草は未確認。', 145, 'スジグロシロマダラ'),
  addNote('species-BTG-003', '生態情報', '国内での発生記録はない。国外食草の記述には産卵・摂食を否定する例や蛹のみの発見例が含まれるため、確定した食草関係としては登録しない。', 145, 'ミダムスルリマダラ'),
  addNote('species-BTG-004', '生態情報', 'ヤシ類の生える開けた市街地や海岸付近に生息する。飛翔は非常に敏速で、シロバナセンダングサなどに訪花する。卵はヤシ科植物の葉に1個ずつ産みつけられる。', 155, 'クロボシセセリ'),
];

const candidateNoteIds = new Set(noteActions.flatMap((action) => action.before ? [action.before.record_id] : []));
const noteHolds = generalNotes
  .filter((row) => {
    const match = matches.find((candidate) => candidate.insect.insect_id === row.insect_id);
    return match && match.science.score >= 0.82 && row.page && String(row.page) !== String(match.science.account.source_pdf_page);
  })
  .filter((row) => !candidateNoteIds.has(row.record_id))
  .map((row) => ({
    action_id: `BTG-NOTE-HOLD-${row.record_id}`,
    action: 'keep_or_continuation_reviewed', before: row, after: row,
    source: { reference: SOURCE_REFERENCE, pdf_page: Number(row.page), pdf_sha256: SOURCE_PDF_SHA256 },
    verification_status: 'page_layout_reviewed',
    decision: '開始頁との差は次頁継続または本文位置として説明でき、誤帰属の根拠がない。',
  }));

const taxonLedger = matches.map((match) => {
  const correction = nameActionById.get(match.insect.insect_id);
  const account = correction
    ? accounts.find((candidate) => candidate.source_account_id === correction.source.source_account_id)
    : match.science.score >= 0.82 ? match.science.account : match.japanese.account;
  return {
    insect_id: match.insect.insect_id,
    current_japanese_name: match.insect.japanese_name,
    current_scientific_name: match.insect.scientific_name,
    source_account_id: account.source_account_id,
    source_pdf_page: account.source_pdf_page,
    source_printed_page: account.source_printed_page,
    source_japanese_name_ocr: account.source_japanese_name_ocr,
    source_scientific_name_ocr: account.source_scientific_name_ocr,
    match_axis: correction ? 'manual_scientific_original_image' : match.science.score >= 0.82 ? 'scientific_fuzzy' : 'japanese_hold',
    science_score: match.science.score.toFixed(4),
    name_action: correction?.action_id ?? '',
    name_decision: correction ? 'update' : match.science.score >= 0.82 ? 'keep' : 'hold_alias_review',
    host_row_ids: hostplants.filter((row) => row.insect_id === match.insect.insect_id).map((row) => row.record_id).join('|'),
    host_action_ids: hostActions.filter((action) => action.before?.insect_id === match.insect.insect_id || action.after?.insect_id === match.insect.insect_id).map((action) => action.action_id).join('|'),
    note_row_ids: generalNotes.filter((row) => row.insect_id === match.insect.insect_id).map((row) => row.record_id).join('|'),
    note_action_ids: noteActions.filter((action) => action.before?.insect_id === match.insect.insect_id || action.after?.insect_id === match.insect.insect_id).map((action) => action.action_id).join('|'),
    verification_status: correction ? 'original_image_verified' : 'ocr_candidate_plus_structural_match',
    evidence_note: correction ? '原本見出しの和名と学名を画像で照合。' : '全274見出し台帳との構造照合。低信頼別属名はhold。',
  };
});

const accountLedger = accounts.map((account) => {
  const scienceTargets = matches.filter((match) => match.science.score >= 0.82 && match.science.account.source_account_id === account.source_account_id);
  const newTarget = newTaxonSpecs.find((spec) => spec.source_name === account.source_japanese_name_ocr);
  return {
    source_account_id: account.source_account_id,
    source_pdf_page: account.source_pdf_page,
    source_printed_page: account.source_printed_page,
    source_japanese_name_ocr: account.source_japanese_name_ocr,
    source_scientific_name_ocr: account.source_scientific_name_ocr,
    matched_current_ids: scienceTargets.map((match) => match.insect.insect_id).join('|'),
    new_taxon_id: newTarget?.insect_id ?? '',
    coverage_status: newTarget ? 'new_taxon_original_verified' : scienceTargets.length ? 'scientific_match' : 'alias_or_missing_target_hold',
  };
});

const actionBundle = {
  schema_version: 1,
  generated_at: '2026-07-12',
  source: {
    reference: SOURCE_REFERENCE,
    pdf_pages: 170,
    audited_main_account_pdf_pages: '11-164',
    pdf_sha256: SOURCE_PDF_SHA256,
    ocr_sha256: OCR_SHA256,
    evidence_policy: 'OCR generates candidates; every changed public fact in this bundle was checked against the original page image.',
  },
  counts: {
    source_accounts: accounts.length,
    current_taxa: insects.length,
    name_actions: nameActions.length,
    new_taxon_actions: newTaxonActions.length,
    host_rows_reviewed_for_renamed_taxa: hostReviews.length,
    host_actions: hostActions.length,
    note_actions: noteActions.length,
    note_continuation_or_keep_reviews: noteHolds.length,
  },
  name_actions: nameActions,
  new_taxon_actions: newTaxonActions,
  host_reviews: hostReviews,
  host_actions: hostActions,
  note_actions: noteActions,
  note_keep_reviews: noteHolds,
};

const auditDir = path.join(ROOT, 'data/source_audits');
fs.mkdirSync(auditDir, { recursive: true });
fs.writeFileSync(
  path.join(auditDir, 'japanese-butterfly-guide-all-taxa-2026-07-12.csv'),
  Papa.unparse(taxonLedger, { newline: '\n' }) + '\n',
);
fs.writeFileSync(
  path.join(auditDir, 'japanese-butterfly-guide-all-accounts-2026-07-12.csv'),
  Papa.unparse(accountLedger, { newline: '\n' }) + '\n',
);
fs.writeFileSync(
  path.join(auditDir, 'japanese-butterfly-guide-integrity-actions-2026-07-12.json'),
  JSON.stringify(actionBundle, null, 2) + '\n',
);

console.log(JSON.stringify({
  summary: {
    source_accounts: accounts.length,
    current_taxa: insects.length,
    host_rows: hostplants.length,
    general_note_rows: generalNotes.length,
    science_auto_matches: matches.filter((match) => match.science.score >= 0.82).length,
    science_name_mismatches: matches.filter((match) => (
      match.science.score >= 0.82
      && similarity(
        japaneseKey(match.insect.japanese_name),
        japaneseKey(match.science.account.source_japanese_name_ocr),
      ) < 0.82
    )).length,
    japanese_assignment_min_score: Math.min(...japaneseAssignments.map((assignment) => assignment.score)),
    unmatched_source_accounts: unmatchedSourceAccounts.length,
  },
  unmatched_source_accounts: unmatchedSourceAccounts,
  accounts,
  matches: matches.map((match) => ({
    insect_id: match.insect.insect_id,
    current_japanese_name: match.insect.japanese_name,
    current_scientific_name: match.insect.scientific_name,
    host_count: match.hostCount,
    note_count: match.noteCount,
    science_score: match.science.score,
    science_margin: match.science.score - match.scienceSecond.score,
    science_source_account_id: match.science.account.source_account_id,
    science_source_pdf_page: match.science.account.source_pdf_page,
    science_source_printed_page: match.science.account.source_printed_page,
    science_source_japanese_name_ocr: match.science.account.source_japanese_name_ocr,
    science_source_scientific_name_ocr: match.science.account.source_scientific_name_ocr,
    japanese_score: match.japanese.score,
    japanese_source_account_id: match.japanese.account.source_account_id,
    japanese_source_pdf_page: match.japanese.account.source_pdf_page,
    japanese_source_japanese_name_ocr: match.japanese.account.source_japanese_name_ocr,
    japanese_source_scientific_name_ocr: match.japanese.account.source_scientific_name_ocr,
  })),
}, null, 2));
