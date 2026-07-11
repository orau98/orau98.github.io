#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, toObjects } from './lib/csvQuality.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST_PATH = path.join(ROOT, 'normalized_data/hostplants.csv');
const INSECT_PATH = path.join(ROOT, 'normalized_data/insects.csv');
const OUT_PATH = path.join(
  ROOT,
  'data/source_audits/flower-visiting-moths-comprehensive-audit-2026-07-12.json',
);

const SOURCE_REFERENCE = '花を訪れる蛾たち　知られざる姿を求めて';
const SOURCE_PDF_SHA256 = '59d32259aac9041d2d5497133dc33c7f1a220c148d2ce6a2ebe9e5c877540c6b';
const OCR_INDEX_SHA256 = '1a7dbe1de1b096edc8d693a80ef916dc86e8bf36ce48790f5c220d99421b3e27';

const splitPlants = (value) => value.split('|').filter(Boolean);

// 原本の全614見出しを通読し、従来抽出が丸ごと飛ばしていた4区間だけを
// 原本画像から人手転記した。source_ordinal は見出し単位（同一種の複数写真は1）。
const missingTaxa = [
  [222, 126, 24, 'Krananda latimarginaria', 'ツマジロエダシャク', 'species-3636', 'セイタカアワダチソウ'],
  [223, 126, 24, 'Luxiaria amasa amasa', 'トビカギバエダシャク', 'species-3625', 'トウネズミモチ'],
  [224, 126, 24, 'Milionia zonea pryeri', 'キオビエダシャク', 'species-3647', 'コスモス|セイタカアワダチソウ|ヒヨドリバナ|ソバ'],
  [225, 126, 24, 'Cystidia truncangulata', 'ヒロオビトンボエダシャク', 'species-3639', 'トウネズミモチ|アカメガシワ|クリ'],
  [226, 126, 24, 'Cystidia couaggaria couaggaria', 'ウメエダシャク', 'species-3640', 'アカメガシワ'],
  [227, 127, 24, 'Epobeidia tigrata leopardaria', 'キベリゴマフエダシャク', 'species-3637', 'リョウブ'],
  [228, 127, 24, 'Pogonopygia nigralbata nigralbata', 'クロフオオシロエダシャク', 'species-3644', 'リョウブ|アキグミ|タカオカエデ|フジ|ウツギ'],
  [229, 127, 24, 'Dilophodes elegans elegans', 'クロフシロエダシャク', 'species-3646', 'ノコンギク|シロヨメナ|セイタカアワダチソウ|イタドリ|アセビ|キブシ|ウツギ|ヒサカキ'],
  [230, 127, 24, 'Arichanna tetrica tetrica', 'キジマエダシャク', 'species-3652', 'アセビ|コバノミツバツツジ|キブシ|ヤマフジ|ナガバモミジイチゴ'],
  [231, 127, 24, 'Arichanna melanaria fraterna', 'キシタエダシャク', 'species-3653', 'ヤツガタケアザミ|クガイソウ|アカメガシワ|クリ'],
  [232, 128, 25, 'Arichanna gaschkevitchii gaschkevitchii', 'ヒョウモンエダシャク', 'species-3654', 'ヒヨドリバナ|マツムシソウ|クガイソウ|オカトラノオ|ヤナギラン|イタドリ|クサギ|リョウブ|アカメガシワ|クリ'],
  [233, 128, 25, 'Cleora insolita', 'ルリモンエダシャク', 'species-3673', 'アセビ|アキグミ|フジ'],
  [234, 128, 25, 'Cleora leucophaea', 'シロテンエダシャク', 'species-3674', 'アセビ|キブシ|アキグミ|ウメ|オオシマザクラ|ソメイヨシノ|ヒサカキ|ヤマヤナギ'],
  [235, 128, 25, 'Cleora minutaria', 'ヤクシマフトスジエダシャク', 'species-3676', 'セイタカアワダチソウ|ヘクソカズラ|シャシャンボ|オオシマザクラ'],
  [236, 128, 25, 'Alcis angulifera', 'ナカウスエダシャク', 'species-3655', 'ヤクシソウ|コウヤボウキ|ヒメアザミ|ヨシノアザミ|ツワブキ|アメリカセンダングサ|コセンダングサ|ヒメジョオン|ノコンギク|シロヨメナ|セイタカアワダチソウ|アキノキリンソウ|ヒヨドリバナ|オトコエシ|ミカエリソウ|アケボノソウ|シラネセンキュウ|シシウド|ヤマハギ|サラシナショウマ|イタドリ|ハコネウツギ|ガマズミ|イボタノキ|エゴノキ|ネジキ|ヤツデ|アキグミ|マユミ|ヌルデ|アカメガシワ|フジ|カマツカ|トベラ|ウツギ|サザンカ|クリ|スダジイ'],
  [237, 129, 25, 'Alcis medialbifera', 'ヒメナカウスエダシャク', 'species-3656', 'ヤツガタケアザミ|ヒヨドリバナ|クガイソウ|シシウド|ヤナギラン|イタドリ'],
  [238, 129, 25, 'Alcis picata', 'シロシタオビエダシャク', 'species-3659', 'ヤツガタケアザミ|ヒヨドリバナ|マツムシソウ|クガイソウ|フキ|ヤナギラン|クサボタン'],
  [239, 129, 25, 'Rikiosatoa grisea grisea', 'フタヤマエダシャク', 'species-3663', 'ノコンギク|セイタカアワダチソウ'],
  [240, 129, 25, 'Ramobia mediodivisa', 'ナカジロネグロエダシャク', 'species-3665', 'セイタカアワダチソウ'],
  [241, 130, 26, 'Deileptenia ribeata', 'マツオオエダシャク', 'species-3671', 'ヤツガタケアザミ|ヒヨドリバナ|シシウド|ヤナギラン|エゴノキ|ウツギ'],
  [242, 130, 26, 'Pseuderannis lomozemia', 'ウスバキエダシャク', 'species-3661', 'キブシ|ヒサカキ'],
  [243, 130, 26, 'Pseuderannis amplipennis', 'ウスバシロエダシャク', 'species-3662', 'キブシ'],
  [244, 130, 26, 'Hypomecis punctinalis conferenda', 'ウスバミスジエダシャク', 'species-3695', 'アキグミ|フジ|ウツギ'],
  [245, 130, 26, 'Ophthalmitis irrorataria', 'コヨツメエダシャク', 'species-3720', 'フジ|カマツカ'],
  [246, 130, 26, 'Paradarisa chloauges kurosawai', 'ヒロバウスアオエダシャク', 'species-3702', 'ヒメジョオン|シロヨメナ|セイタカアワダチソウ|オオマツヨイグサ|アカメガシワ|クリ'],
  [247, 131, 26, 'Paradarisa consonaria', 'シナトビスジエダシャク', 'species-3703', 'タカオカエデ|フジ|ヤマフジ|カマツカ'],
  [248, 131, 26, 'Heterarmia charon charon', 'ナミガタエダシャク', 'species-3708', 'シロツメクサ|ハコネウツギ|ガマズミ|イボタノキ|エゴノキ|ツルウメモドキ|マユミ|フジ|コガクウツギ|ウツギ|クリ'],
  [249, 131, 26, 'Ectropis crepuscularia', 'フトフタオビエダシャク', 'species-3687', 'キブシ|ソメイヨシノ'],
  [250, 131, 26, 'Ectropis obliqua', 'ウスジロエダシャク', 'species-3689', 'フジ'],
  [251, 131, 26, 'Ectropis excellens', 'オオトビスジエダシャク', 'species-3685', 'アキグミ|ヤマハゼ|フジ'],
  [252, 132, 27, 'Parectropis similaria japonica', 'シロモンキエダシャク', 'species-3721', 'フジ'],
  [253, 132, 27, 'Racotis boarmiaria japonica', 'ホシミスジエダシャク', 'species-3705', 'セイタカアワダチソウ|ツリガネニンジン|イタドリ|シャシャンボ|フジ|ウメ|ソメイヨシノ'],
  [254, 132, 27, 'Racotis petrosa', 'ナミスジエダシャク', 'species-3704', 'アセビ|キブシ|フジ|オオシマザクラ|クマイチゴ|ナガバモミジイチゴ'],
  [255, 132, 27, 'Aethalura ignobilis', 'ハンノトビスジエダシャク', 'species-3718', 'フジ'],
  [256, 132, 27, 'Myrioblephara cilicornaria', 'キバネトビスジエダシャク', 'species-3716', 'アセビ'],
  [257, 132, 27, 'Amblychia insueta', 'チャマダラエダシャク', 'species-3734', 'ヒメアザミ|オトコエシ|シシウド|イタドリ|クサギ|ヌルデ'],
  [258, 133, 27, 'Amblychia angeronaria', 'オオツバメエダシャク', 'species-3736', 'フジ'],
  [259, 133, 27, 'Scionomia mendica mendica', 'ソトキクロエダシャク', 'species-3741', 'ヒメアザミ|ヨシノアザミ|ヨモギ|オオアレチノギク|ノコンギク|シロヨメナ|セイタカアワダチソウ|ヒヨドリバナ|オトコエシ|アキチョウジ|ミカエリソウ|シシウド|ウド|ヤマハギ|サラシナショウマ|イタドリ|エゴノキ|ウツギ|クリ'],
  [260, 133, 27, 'Thinopteryx crocoptera striolata', 'キマダラツバメエダシャク', 'species-3742', 'ノアザミ|コセンダングサ|セイタカアワダチソウ|ヒヨドリバナ|オトコエシ|ヘクソカズラ|トウネズミモチ|エゴノキ|モチツツジ|アキグミ|ゴンズイ|ツルウメモドキ|ウンシュウミカン|フジ|ウツギ'],

  [297, 142, 32, 'Psychostrophia melanargia', 'キンモンガ', 'species-3510', 'ヒヨドリバナ|シシウド|イタドリ|ガマズミ|リョウブ|アキグミ|ツルウメモドキ|マユミ|イヌザンショウ|コガクウツギ|ノリウツギ|ウツギ|クリ'],
  [298, 142, 32, 'Dysaethria moza', 'クロホシフタオ', 'species-3516', 'シシウド'],
  [299, 142, 32, 'Pterodecta felderi', 'イカリモンガ', 'species-3433', 'ヒメアザミ|フキ|ノコンギク|シロヨメナ|セイタカアワダチソウ|ヤマルリソウ|オカトラノオ|イタドリ|リョウブ|クサイチゴ|ノリウツギ'],
  [300, 142, 32, 'Agrius convolvuli', 'エビガラスズメ', 'species-4479', 'オオマツヨイグサ|カワラナデシコ|ハナシュクシャ|ユウスゲ|クサギ|ハマゴウ'],
  [301, 143, 32, 'Psilogramma incretum', 'シモフリスズメ', 'species-4483', 'ユウスゲ|クサギ'],
  [302, 143, 32, 'Sphinx constricta', 'コエビガラスズメ', 'species-4485', 'オオマツヨイグサ|カワラナデシコ|ユウスゲ'],
  [303, 143, 32, 'Hemaris affinis', 'クロスキバホウジャク', 'species-4515', 'ノアザミ|セイヨウアブラナ|トウネズミモチ|セイヨウリンゴ'],
  [304, 143, 32, 'Cephonodes hylas hylas', 'オオスカシバ', 'species-4512', 'ノアザミ|ハナゾノツクバネウツギ|クサギ|ネズミモチ'],
  [305, 143, 32, 'Acosmeryx naga naga', 'ハネナガブドウスズメ', 'species-4519', 'オオマツヨイグサ|オオムラサキ|アキグミ'],
  [306, 144, 33, 'Acosmeryx castanea', 'ブドウスズメ', 'species-4520', 'オオマツヨイグサ'],
  [307, 144, 33, 'Neogurelca himachala sangaica', 'ホシヒメホウジャク', 'species-4521', 'ヨシノアザミ|ノコンギク|ヒヨドリバナ|イタドリ|ハナゾノツクバネウツギ|クサギ|ハマゴウ|ネズミモチ|ヤマツツジ|クサイチゴ|チャ'],
  [308, 144, 33, 'Macroglossum bombylans', 'ヒメクロホウジャク', 'species-4524', 'ヨシノアザミ|ツリフネソウ|ハコネウツギ'],
  [309, 144, 33, 'Macroglossum pyrrhosticta', 'ホシホウジャク', 'species-4532', 'ヤクシソウ|キクイモ|コウヤボウキ|ヨシノアザミ|ツワブキ|ノコンギク|コスモス|セイタカアワダチソウ|ヒヨドリバナ|ママコナ|シラネセンキュウ|ツリフネソウ|イタドリ|ホトトギス|ハナゾノツクバネウツギ|クサギ|トベラ|チャ|シリブカガシ'],
  [310, 145, 33, 'Macroglossum saga', 'クロホウジャク', 'species-4533', 'ヨシノアザミ|セイタカアワダチソウ|ヒヨドリバナ|オオマツヨイグサ|ツリフネソウ|ホウセンカ|ハナゾノツクバネウツギ|クサギ'],
  [311, 145, 33, 'Macroglossum passalus passalus', 'オキナワホウジャク', 'species-4529', 'タチアワユキセンダングサ'],
  [312, 145, 33, 'Deilephila elpenor lewisii', 'ベニスズメ', 'species-4537', 'オオマツヨイグサ|ハコネウツギ|オオムラサキ'],
  [313, 145, 33, 'Theretra nessus', 'キイロスズメ', 'species-4546', 'オオマツヨイグサ|ヤマユリ|ハナゾノツクバネウツギ|クサギ'],
  [314, 145, 33, 'Theretra japonica', 'コスズメ', 'species-4548', 'ノアザミ|コマツヨイグサ|オオマツヨイグサ|メマツヨイグサ|クララ|カワラナデシコ|サギソウ|ハナシュクシャ|ヤマユリ|ユウスゲ|スイカズラ|ハナゾノツクバネウツギ|クサギ|モチツツジ|オオムラサキ|リョウブ|ウンシュウミカン|シャリンバイ'],
  [315, 146, 34, 'Theretra oldenlandiae oldenlandiae', 'セスジスズメ', 'species-4547', 'オオマツヨイグサ'],
  [316, 146, 34, 'Rhagastis mongoliana', 'ビロードスズメ', 'species-4552', 'オオマツヨイグサ|ウツギ'],
  [317, 146, 34, 'Eilema deplana pavescens', 'ムジホソバ', 'species-4743', 'ネムノキ|クリ'],
  [318, 146, 34, 'Eilema aegrota', 'キシタホソバ', 'species-4740', 'コスモス|セイタカアワダチソウ|オオマツヨイグサ|イタドリ|リョウブ|フジ'],
  [319, 146, 34, 'Eilema cribrata', 'ヒメキホソバ', 'species-4754', 'オオマツヨイグサ|フジ'],
  [320, 147, 34, 'Ghoria collitoides', 'キマエクロホソバ', 'species-4763', 'エゴノキ|ネジキ|クリ'],
  [321, 147, 34, 'Macrobrochis staudingeri staudingeri', 'クビワウスグロホソバ', 'species-4762', 'オオマツヨイグサ|クリ'],
  [322, 147, 34, 'Agrisius fuliginosus japonicus', 'ゴマフオオホソバ', 'species-4761', 'ヤマハゼ|フジ|ウツギ|クリ'],
  [323, 147, 34, 'Cyana hamata hamata', 'アカスジシロコケガ', 'species-4768', 'コスモス|イタドリ|クサギ|リョウブ|クリ'],
  [324, 147, 34, 'Aemene altaica', 'ホシオビコケガ', 'species-4780', 'イタドリ|クサギ|アカメガシワ|クリ'],
  [325, 147, 34, 'Eugoa grisea', 'クロテンハイイロコケガ', 'species-4791', 'クリ'],
  [331, 149, 35, 'Nyctemera adversata', 'モンシロモドキ', 'species-4811', 'サンゴジュ|アカメガシワ'],
  [508, 182, 52, 'Macdunnoughia crassisigna', 'オオキクギンウワバ', 'species-5585', 'ツリガネニンジン|オオマツヨイグサ|フジ'],
].map(([sourceOrdinal, printedPage, pdfPage, sourceScientificName, sourceJapaneseName, insectId, plants]) => ({
  source_ordinal: sourceOrdinal,
  printed_page: printedPage,
  pdf_page: pdfPage,
  source_scientific_name: sourceScientificName,
  source_japanese_name: sourceJapaneseName,
  insect_id: insectId,
  plants: splitPlants(plants),
}));

const rows = (filePath) => toObjects(parseCsv(fs.readFileSync(filePath, 'utf8')));
const hostRows = rows(HOST_PATH);
const insects = rows(INSECT_PATH);
const insectById = new Map(insects.map((row) => [row.insect_id, row]));

const sourceRows = hostRows.filter((row) => row.reference === SOURCE_REFERENCE);
const relationshipKeys = new Set(hostRows.map((row) => `${row.insect_id}\u0000${row.plant_name}`));
const sourceKeys = new Set(sourceRows.map((row) => `${row.insect_id}\u0000${row.plant_name}`));

const familyByPlant = new Map();
for (const row of hostRows) {
  if (row.plant_name && row.plant_family && !familyByPlant.has(row.plant_name)) {
    familyByPlant.set(row.plant_name, row.plant_family);
  }
}
familyByPlant.set('コマツヨイグサ', 'アカバナ科');

for (const taxon of missingTaxa) {
  const current = insectById.get(taxon.insect_id);
  if (!current) throw new Error(`missing current insect: ${taxon.insect_id}`);
  taxon.current_japanese_name = current.japanese_name;
  taxon.current_scientific_name = current.scientific_name;
  for (const plant of taxon.plants) {
    if (!familyByPlant.get(plant)) throw new Error(`missing plant family: ${plant}`);
  }
}

const actions = [
  {
    action_id: 'FVM-REASSIGN-001',
    action: 'reassign_insect',
    record_id: 'hostplant-902802',
    expected_before: { insect_id: 'species-3216', plant_name: 'セイタカアワダチソウ' },
    after: { insect_id: 'species-2897' },
    source_ordinal: 26,
    printed_page: 85,
    pdf_page: 3,
    evidence: '原本見出し Glaucocharis exsectella シロエグリツトガの訪花植物欄を画像確認',
  },
  {
    action_id: 'FVM-REASSIGN-002',
    action: 'reassign_insect',
    record_id: 'hostplant-902803',
    expected_before: { insect_id: 'species-3216', plant_name: 'ヒヨドリバナ' },
    after: { insect_id: 'species-2897' },
    source_ordinal: 26,
    printed_page: 85,
    pdf_page: 3,
    evidence: '原本見出し Glaucocharis exsectella シロエグリツトガの訪花植物欄を画像確認',
  },
  {
    action_id: 'FVM-REASSIGN-003',
    action: 'reassign_insect',
    record_id: 'hostplant-902804',
    expected_before: { insect_id: 'species-3216', plant_name: 'クリ' },
    after: { insect_id: 'species-2897' },
    source_ordinal: 26,
    printed_page: 85,
    pdf_page: 3,
    evidence: '原本見出し Glaucocharis exsectella シロエグリツトガの訪花植物欄を画像確認',
  },
  {
    action_id: 'FVM-DELETE-001',
    action: 'delete_invalid_placeholder',
    record_id: 'hostplant-903548',
    expected_before: { insect_id: 'species-4185', plant_name: '（リスト無し）' },
    source_ordinal: 171,
    printed_page: '114-115',
    pdf_page: 18,
    evidence: '原本では改頁先にヤクシソウ・ヒメアザミ・ヨシノアザミ・クリを列記しており、プレースホルダーは植物名ではない',
  },
  {
    action_id: 'FVM-REPLACE-001',
    action: 'replace_plant_name',
    record_id: 'hostplant-903065',
    expected_before: { insect_id: 'species-3327', plant_name: 'ヤマタケタケアザミ' },
    after: { plant_name: 'ヤツガタケアザミ', plant_family: 'キク科' },
    source_ordinal: 75,
    printed_page: 95,
    pdf_page: 8,
    evidence: '原本の Cirsium nipponicum yatsugatakense ヤツガタケアザミを画像確認',
  },
  {
    action_id: 'FVM-FAMILY-001',
    action: 'set_plant_family',
    record_id: 'hostplant-902809',
    expected_before: { insect_id: 'species-2951', plant_name: 'ツリガネニンジン', plant_family: '' },
    after: { plant_family: 'キキョウ科' },
    source_ordinal: 28,
    printed_page: 86,
    pdf_page: 4,
    evidence: '植物名を原本で確認し、既存同名植物の正規化科名へ統一',
  },
];

const candidateRelations = [
  {
    source_ordinal: 171,
    printed_page: '114-115',
    pdf_page: 18,
    source_scientific_name: 'Triphosa sericata sericata',
    source_japanese_name: 'マエモンオオナミシャク',
    insect_id: 'species-4185',
    current_japanese_name: insectById.get('species-4185')?.japanese_name,
    current_scientific_name: insectById.get('species-4185')?.scientific_name,
    plants: ['ヤクシソウ', 'ヒメアザミ', 'ヨシノアザミ', 'クリ'],
  },
  ...missingTaxa,
];

const verifiedExistingRelationships = [];
let addSequence = 0;
for (const taxon of candidateRelations) {
  for (const [plantIndex, plantName] of taxon.plants.entries()) {
    const key = `${taxon.insect_id}\u0000${plantName}`;
    const family = familyByPlant.get(plantName);
    if (!family) throw new Error(`missing plant family: ${plantName}`);

    if (relationshipKeys.has(key)) {
      const matches = hostRows.filter(
        (row) => row.insect_id === taxon.insect_id && row.plant_name === plantName,
      );
      verifiedExistingRelationships.push({
        source_ordinal: taxon.source_ordinal,
        printed_page: taxon.printed_page,
        pdf_page: taxon.pdf_page,
        insect_id: taxon.insect_id,
        plant_name: plantName,
        existing_record_ids: matches.map((row) => row.record_id),
        existing_references: [...new Set(matches.map((row) => row.reference))],
        status: sourceKeys.has(key)
          ? 'already_present_from_source'
          : 'relationship_already_present_from_other_source',
      });
      continue;
    }

    addSequence += 1;
    actions.push({
      action_id: `FVM-ADD-${String(addSequence).padStart(3, '0')}`,
      action: 'add_relationship',
      record_id: `host-flower-moths-audit-${String(taxon.source_ordinal).padStart(3, '0')}-${String(plantIndex + 1).padStart(3, '0')}`,
      after: {
        insect_id: taxon.insect_id,
        plant_name: plantName,
        plant_family: family,
        observation_type: '野外（国内）',
        plant_part: '花',
        life_stage: '成虫',
        reference: SOURCE_REFERENCE,
        notes: '',
      },
      source_ordinal: taxon.source_ordinal,
      printed_page: taxon.printed_page,
      pdf_page: taxon.pdf_page,
      source_scientific_name: taxon.source_scientific_name,
      source_japanese_name: taxon.source_japanese_name,
      current_japanese_name: taxon.current_japanese_name,
      current_scientific_name: taxon.current_scientific_name,
      source_scope: 'source_taxon_account; current target fixed by scientific/Japanese-name reconciliation',
      evidence: '原本PDF画像の対象見出し・訪花植物欄を目視確認',
    });
    relationshipKeys.add(key);
    sourceKeys.add(key);
  }
}

const sourceTaxonIds = new Set(sourceRows.map((row) => row.insect_id));
const audit = {
  schema_version: 1,
  generated_at: '2026-07-12',
  source: {
    title: SOURCE_REFERENCE,
    local_file_name: '花を訪れる蛾たち　知られざる姿を求めて.pdf',
    sha256: SOURCE_PDF_SHA256,
    physical_pdf_pages_readable: 63,
    printed_pages_audited: '81-204',
    source_taxon_accounts_audited: 614,
    ocr_index_sha256: OCR_INDEX_SHA256,
    evidence_policy: 'OCRは索引候補のみ。採用・修正対象は原本PDF画像で見出しと訪花植物欄を確認。',
  },
  before: {
    source_rows: sourceRows.length,
    source_taxa: sourceTaxonIds.size,
    invalid_placeholder_rows: sourceRows.filter((row) => row.plant_name === '（リスト無し）').length,
    blank_plant_family_rows: sourceRows.filter((row) => !row.plant_family).length,
  },
  coverage: {
    existing_source_rows_screened: sourceRows.length,
    source_taxon_accounts_screened: 614,
    wholly_missing_source_taxa_found: missingTaxa.length,
    page_break_taxa_recovered: 1,
    misattributed_rows_found: 3,
    spelling_or_family_repairs_found: 2,
    unresolved_holds: 0,
  },
  source_taxa_recovered: missingTaxa,
  verified_existing_relationships: verifiedExistingRelationships,
  actions,
  action_summary: Object.fromEntries(
    Object.entries(Object.groupBy(actions, (action) => action.action))
      .map(([key, values]) => [key, values.length]),
  ),
  invariants: {
    added_observation_type: '野外（国内）',
    added_plant_part: '花',
    added_life_stage: '成虫',
    exact_source_reference: SOURCE_REFERENCE,
    duplicate_key: 'insect_id + plant_name (all references)',
    subspecies_policy: '種レベル記載は現行亜種へ共有可能。ただし本資料の70欠落分類群には現行の同種別亜種行がなく、地域・島・亜種限定情報の横展開は0件。',
  },
};

fs.writeFileSync(OUT_PATH, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  output: path.relative(ROOT, OUT_PATH),
  before: audit.before,
  coverage: audit.coverage,
  action_summary: audit.action_summary,
  verified_existing_relationships: verifiedExistingRelationships.length,
}, null, 2));
