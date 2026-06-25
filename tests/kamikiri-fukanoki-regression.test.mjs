import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import Papa from 'papaparse';

const readCsv = (path) => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const hostplants = Papa.parse(readCsv('normalized_data/hostplants.csv'), {
  header: true,
  skipEmptyLines: true,
}).data;

const insects = Papa.parse(readCsv('normalized_data/insects.csv'), {
  header: true,
  skipEmptyLines: true,
}).data;

const insectNameById = new Map(insects.map((row) => [row.insect_id, row.japanese_name]));

const buildHostPlantNameMap = () => {
  const map = {};
  for (const row of hostplants) {
    const plantName = row.plant_name;
    const insectName = insectNameById.get(row.insect_id);
    if (!plantName || !insectName) continue;
    if (!map[plantName]) map[plantName] = [];
    if (!map[plantName].includes(insectName)) {
      map[plantName].push(insectName);
    }
  }
  return map;
};

const hostPlantNameMap = buildHostPlantNameMap();
const generatedHostplantsPath = 'public/assets/data-lite/hostplants.json';
const generatedHostplants = fs.existsSync(generatedHostplantsPath)
  ? JSON.parse(fs.readFileSync(generatedHostplantsPath, 'utf8'))
  : null;

const hasPair = (insectId, plantName) =>
  hostplants.some((row) => row.insect_id === insectId && row.plant_name === plantName);

const hasKamikiriPair = (insectId, plantName) =>
  hostplants.some((row) =>
    row.insect_id === insectId &&
    row.plant_name === plantName &&
    row.reference === '日本産カミキリムシ'
  );

const expectedFukanokiPairs = [
  ['species-22110', 'リュウキュウヒメアメイロカミキリ'],
  ['species-22743', 'オキナワセンノカミキリ'],
  ['species-22754', 'キンケビロウドカミキリ 八重山諸島亜種'],
  ['species-22753', 'キンケビロウドカミキリ 沖縄亜種'],
  ['species-22847', 'アマミコブヒゲカミキリ'],
];

test('フカノキ includes the longhorn beetles recovered from 日本産カミキリムシ OCR', () => {
  for (const [insectId, label] of expectedFukanokiPairs) {
    assert.equal(hasPair(insectId, 'フカノキ'), true, `${label} should be linked to フカノキ`);
  }
});

test('known false fuzzy matches from the same OCR section stay removed', () => {
  const falsePairs = [
    ['species-22110', 'ハスノハギリ'],
    ['species-22753', 'イスノキ'],
    ['species-22743', 'カラスザンショウ'],
    ['species-22743', 'マメガキ'],
    ['species-22743', 'シロバイ'],
    ['species-22847', 'ショウベンノキ'],
    ['species-22847', 'シロバイ'],
  ];

  for (const [insectId, plantName] of falsePairs) {
    assert.equal(hasPair(insectId, plantName), false, `${insectId} should not be linked to ${plantName}`);
  }
});

test('catalog names include OCR source aliases used by 日本産カミキリムシ', () => {
  const byId = new Map(insects.map((row) => [row.insect_id, row]));

  assert.match(byId.get('species-22743')?.alternative_name || '', /オキナワセンノキカミキリ/);
  assert.match(byId.get('species-22753')?.alternative_name || '', /オキナワキンケビロウドカミキリ/);
  assert.match(byId.get('species-22040')?.alternative_name || '', /アマミトラカミキリ/);
  assert.match(byId.get('species-22311')?.alternative_name || '', /ホンドアオバホソハナカミキリ/);
  assert.match(byId.get('species-22520')?.alternative_name || '', /ヤエヤマクロオビトゲムネカミキリ/);
  assert.match(byId.get('species-22746')?.alternative_name || '', /センノキカミキリ/);
  assert.match(byId.get('species-22877')?.alternative_name || '', /オキナワコウノゴマフカミキリ/);
  assert.match(byId.get('species-22078')?.alternative_name || '', /アオヒメコバネカミキリ/);
  assert.match(byId.get('species-22894')?.alternative_name || '', /トカラオキナワゴマフカミキリ/);
  assert.match(byId.get('species-22945')?.alternative_name || '', /オキナワコブバネサビカミキリ/);
  assert.match(byId.get('species-22919')?.alternative_name || '', /アマミノブオケシカミキリ/);
  assert.match(byId.get('species-21914')?.alternative_name || '', /ニホンチャイロヒメカミキリ/);
  assert.match(byId.get('species-22592')?.alternative_name || '', /トカラハネナシチビカミキリ/);
  assert.match(byId.get('species-22728')?.alternative_name || '', /アマミビロウドカミキリ/);
  assert.match(byId.get('species-22686')?.alternative_name || '', /イズドイカミキリ/);
  assert.match(byId.get('species-22684')?.alternative_name || '', /アマミドイカミキリ/);
  assert.match(byId.get('species-22687')?.alternative_name || '', /ヤエヤマドイカミキリ/);
});

test('public source フカノキ data includes recovered longhorn beetles', () => {
  const fukanokiInsects = new Set(hostPlantNameMap['フカノキ'] || []);

  for (const [, label] of expectedFukanokiPairs) {
    assert.equal(fukanokiInsects.has(label), true, `public source data should include ${label}`);
  }
});

test('generated public フカノキ data and meta pages include recovered longhorn beetles when present', () => {
  if (!generatedHostplants) return;

  const fukanokiInsects = new Set(generatedHostplants['フカノキ'] || []);

  for (const [, label] of expectedFukanokiPairs) {
    assert.equal(fukanokiInsects.has(label), true, `generated public data should include ${label}`);
  }

  for (const page of ['public/meta/plant/フカノキ(ウコギ科).html', 'public/meta/plant/フカノキ.html']) {
    if (!fs.existsSync(page)) continue;
    const html = fs.readFileSync(page, 'utf8');
    for (const [, label] of expectedFukanokiPairs) {
      assert.match(html, new RegExp(label), `${page} should include ${label}`);
    }
  }
});

test('representative 日本産カミキリムシ index gaps are filled from OCR plant blocks', () => {
  const expectedPairs = [
    ['species-22064', 'アカメガシワ', 'イエカミキリ'],
    ['species-22110', 'アカメガシワ', 'リュウキュウヒメアメイロカミキリ'],
    ['species-22764', 'アカメガシワ', 'ゴマダラカミキリ'],
    ['species-22065', 'フジ', 'マルクビケマダラカミキリ'],
    ['species-21894', 'フジ', 'アカネカミキリ'],
    ['species-23023', 'フジ', 'ヒメリンゴカミキリ'],
    ['species-22155', 'イタヤカエデ', 'ルリボシカミキリ'],
    ['species-22775', 'イタヤカエデ', 'イタヤカミキリ'],
    ['species-22985', 'イタヤカエデ', 'セミスジニセリンゴカミキリ'],
  ];

  for (const [insectId, plantName, label] of expectedPairs) {
    assert.equal(hasPair(insectId, plantName), true, `${label} should be linked to ${plantName}`);
  }
});

test('confirmed spillover rows from short OCR plant blocks stay removed', () => {
  const falsePairs = [
    ['species-22746', 'シャクヤク'],
    ['species-21894', 'シャクヤク'],
    ['species-23066', 'シャクヤク'],
    ['species-22296', 'シロバイ'],
    ['species-22064', 'シロバイ'],
    ['species-22463', 'シロバイ'],
  ];

  for (const [insectId, plantName] of falsePairs) {
    assert.equal(hasPair(insectId, plantName), false, `${insectId} should not be linked to ${plantName}`);
  }

  assert.equal(hasPair('species-22065', 'シャクヤク'), true, 'the verified シャクヤク record should remain');
  assert.equal(hasPair('species-22102', 'シロバイ'), true, 'the verified シロバイ record should remain');
});

test('additional verified short-block spillovers stay removed without deleting source-supported rows', () => {
  const falsePairs = [
    ['species-22176', 'ヤマモミジ'],
    ['species-21894', 'ハマナス'],
    ['species-21973', 'ショウベンノキ'],
    ['species-21916', 'シラキ'],
    ['species-22848', 'ハスノハギリ'],
    ['species-22064', 'マメガキ'],
    ['species-22177', 'ハチク'],
    ['species-23020', 'レチンギク'],
    ['species-22833', 'カクレミノ'],
  ];

  for (const [insectId, plantName] of falsePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), false, `${insectId} should not be linked to ${plantName}`);
  }

  const truePairs = [
    ['species-21973', 'ヤマモミジ'],
    ['species-22586', 'ハマナス'],
    ['species-22064', 'ショウベンノキ'],
    ['species-22861', 'シラキ'],
    ['species-21998', 'ハスノハギリ'],
    ['species-22065', 'マメガキ'],
    ['species-21952', 'ハチク'],
    ['species-23048', 'レチンギク'],
    ['species-22832', 'カクレミノ'],
  ];

  for (const [insectId, plantName] of truePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), true, `${insectId} should remain linked to ${plantName}`);
  }
});

test('curated short OCR plant blocks keep only source-supported longhorn rows', () => {
  const truePairs = [
    ['species-22786', 'ウメ'],
    ['species-22755', 'ウメ'],
    ['species-22978', 'ウメ'],
    ['species-21933', 'キリ'],
    ['species-22047', 'キリ'],
    ['species-22927', 'キリ'],
    ['species-21976', 'ヤチダモ'],
    ['species-22755', 'ヤチダモ'],
    ['species-22040', 'リュウキュウガキ'],
    ['species-22877', 'リュウキュウガキ'],
    ['species-22746', 'カクレミノ'],
    ['species-22520', 'カクレミノ'],
    ['species-22755', 'ヤツデ'],
    ['species-22972', 'ヤツデ'],
    ['species-22933', 'ホテイチク'],
    ['species-22229', 'トネリコ'],
    ['species-22311', 'コバノトネリコ'],
    ['species-22703', 'クマノミズキ'],
  ];

  for (const [insectId, plantName] of truePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), true, `${insectId} should be linked to ${plantName}`);
  }

  const falsePairs = [
    ['species-22779', 'ウメ'],
    ['species-22735', 'ウメ'],
    ['species-22179', 'ウメ'],
    ['1-1', 'ウメ'],
    ['species-22064', 'キリ'],
    ['species-22832', 'キリ'],
    ['species-22764', 'キリ'],
    ['species-22867', 'ヤチダモ'],
    ['species-22947', 'ヤチダモ'],
    ['species-21992', 'リュウキュウガキ'],
    ['species-21995', 'リュウキュウガキ'],
    ['species-22833', 'カクレミノ'],
    ['species-22736', 'ヤツデ'],
    ['species-22833', 'ヤツデ'],
    ['species-21952', 'ホテイチク'],
    ['species-22064', 'トネリコ'],
    ['species-22642', 'コバノトネリコ'],
    ['species-22867', 'クマノミズキ'],
  ];

  for (const [insectId, plantName] of falsePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), false, `${insectId} should not be linked to ${plantName}`);
  }
});

test('curated long OCR plant blocks keep source-supported longhorn rows', () => {
  const truePairs = [
    ['10-1', 'イスノキ'],
    ['7-1', 'イスノキ'],
    ['species-21842', 'イスノキ'],
    ['species-22311', 'イスノキ'],
    ['species-22139', 'イスノキ'],
    ['species-22078', 'イスノキ'],
    ['species-22945', 'イスノキ'],
    ['species-22946', 'イスノキ'],
    ['species-22780', 'イスノキ'],
    ['species-22767', 'イスノキ'],
    ['species-22919', 'イスノキ'],
    ['species-21914', 'カラスザンショウ'],
    ['species-22085', 'カラスザンショウ'],
    ['species-22592', 'カラスザンショウ'],
    ['species-22950', 'カラスザンショウ'],
    ['species-22728', 'カラスザンショウ'],
    ['species-22686', 'カラスザンショウ'],
    ['species-22684', 'カラスザンショウ'],
    ['species-22687', 'カラスザンショウ'],
    ['species-22696', 'カラスザンショウ'],
  ];

  for (const [insectId, plantName] of truePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), true, `${insectId} should be linked to ${plantName}`);
  }
});

test('curated long OCR plant blocks remove adjacent-block spillovers and wrong fuzzy matches', () => {
  const falsePairs = [
    ['3-5', 'イスノキ'],
    ['species-22310', 'イスノキ'],
    ['species-21921', 'イスノキ'],
    ['species-21885', 'イスノキ'],
    ['species-22704', 'イスノキ'],
    ['species-22072', 'イスノキ'],
    ['species-22176', 'イスノキ'],
    ['species-21973', 'イスノキ'],
    ['species-22764', 'イスノキ'],
    ['species-22832', 'イスノキ'],
    ['species-21913', 'カラスザンショウ'],
    ['species-22609', 'カラスザンショウ'],
    ['species-22463', 'カラスザンショウ'],
    ['species-22735', 'カラスザンショウ'],
    ['species-22682', 'カラスザンショウ'],
    ['species-22144', 'カラスザンショウ'],
    ['species-22731', 'カラスザンショウ'],
    ['species-22866', 'カラスザンショウ'],
    ['species-22057', 'カラスザンショウ'],
    ['species-22058', 'カラスザンショウ'],
  ];

  for (const [insectId, plantName] of falsePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), false, `${insectId} should not be linked to ${plantName}`);
  }
});

test('high-confidence OCR residual false positives stay removed', () => {
  const falsePairs = [
    ['species-22515', 'キブシ'],
    ['species-22932', 'キブシ'],
    ['species-22927', 'キブシ'],
    ['species-23043', 'キブシ'],
    ['species-23013', 'ハリギリ'],
    ['species-22910', 'ハリギリ'],
    ['species-22676', 'ハリギリ'],
    ['species-22927', 'ミズキ'],
    ['species-22970', 'ハイノキ'],
    ['species-22512', 'アマシバ'],
    ['species-21952', 'リュウキュウチク'],
    ['species-22933', 'メダケ'],
  ];

  for (const [insectId, plantName] of falsePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), false, `${insectId} should not be linked to ${plantName}`);
  }
});

test('OCR-garbled but source-supported residual rows stay present', () => {
  const truePairs = [
    ['species-21916', 'アオギリ'],
    ['species-22222', 'アセビ'],
    ['species-22169', 'イイギリ'],
    ['species-23031', 'イケマ'],
    ['species-21938', 'イスノキ'],
    ['species-22004', 'イスノキ'],
    ['species-22540', 'キブシ'],
    ['species-22669', 'キブシ'],
    ['species-21933', 'キリ'],
    ['species-22739', 'クサギ'],
    ['species-22241', 'クロキ'],
    ['species-22313', 'サワフタギ'],
    ['species-22664', 'シオジ'],
    ['species-22025', 'タカノツメ'],
    ['species-22283', 'ハイノキ類'],
    ['species-22661', 'ハクウンボク'],
    ['species-22980', 'ハリギリ'],
    ['species-22755', 'ミズキ'],
    ['species-22540', 'ムラサキシキブ'],
    ['species-21916', 'ヤツデ'],
    ['species-21990', 'リュウキュウガキ'],
    ['species-23048', 'レチンギク'],
  ];

  for (const [insectId, plantName] of truePairs) {
    assert.equal(hasKamikiriPair(insectId, plantName), true, `${insectId} should remain linked to ${plantName}`);
  }
});

test('public source data reflects representative broad kamikiri corrections', () => {
  const hostplantsJson = hostPlantNameMap;

  assert.match((hostplantsJson['アカメガシワ'] || []).join('\n'), /イエカミキリ/);
  assert.match((hostplantsJson['アカメガシワ'] || []).join('\n'), /ゴマダラカミキリ/);
  assert.match((hostplantsJson['フジ'] || []).join('\n'), /ヒメリンゴカミキリ/);
  assert.match((hostplantsJson['イタヤカエデ'] || []).join('\n'), /イタヤカミキリ/);
  assert.doesNotMatch((hostplantsJson['シャクヤク'] || []).join('\n'), /アカネカミキリ/);
  assert.doesNotMatch((hostplantsJson['シロバイ'] || []).join('\n'), /ヘリウスハナカミキリ/);

  assert.match((hostplantsJson['ヤマモミジ'] || []).join('\n'), /キンケトラカミキリ/);
  assert.doesNotMatch((hostplantsJson['ヤマモミジ'] || []).join('\n'), /ヘリグロベニカミキリ/);
  assert.match((hostplantsJson['ハマナス'] || []).join('\n'), /ヒシカミキリ/);
  assert.doesNotMatch((hostplantsJson['ハマナス'] || []).join('\n'), /アカネカミキリ/);
  assert.match((hostplantsJson['ショウベンノキ'] || []).join('\n'), /イエカミキリ/);
  assert.doesNotMatch((hostplantsJson['ショウベンノキ'] || []).join('\n'), /キンケトラカミキリ/);
  assert.match((hostplantsJson['シラキ'] || []).join('\n'), /チャボヒゲナガカミキリ/);
  assert.doesNotMatch((hostplantsJson['シラキ'] || []).join('\n'), /テツイロヒメカミキリ/);
  assert.match((hostplantsJson['マメガキ'] || []).join('\n'), /マルクビケマダラカミキリ/);
  assert.doesNotMatch((hostplantsJson['マメガキ'] || []).join('\n'), /イエカミキリ/);
  assert.match((hostplantsJson['ハチク'] || []).join('\n'), /タケトラカミキリ/);
  assert.doesNotMatch((hostplantsJson['ハチク'] || []).join('\n'), /ベニカミキリ/);
  assert.match((hostplantsJson['レチンギク'] || []).join('\n'), /キクスイカミキリ/);
  assert.doesNotMatch((hostplantsJson['レチンギク'] || []).join('\n'), /ヘリグロリンゴカミキリ/);
  assert.match((hostplantsJson['カクレミノ'] || []).join('\n'), /キボシカミキリ 基亜種/);
  assert.doesNotMatch((hostplantsJson['カクレミノ'] || []).join('\n'), /キボシカミキリ 熊毛諸島亜種/);

  assert.equal((hostplantsJson['ウメ'] || []).includes('ヒメヒゲナガカミキリ 基亜種'), true);
  assert.equal((hostplantsJson['ウメ'] || []).includes('ニセビロウドカミキリ 基亜種'), true);
  assert.equal((hostplantsJson['ウメ'] || []).includes('ヒゲナガカミキリ'), false);
  assert.equal((hostplantsJson['ウメ'] || []).includes('ビロウドカミキリ 基亜種'), false);
  assert.match((hostplantsJson['キリ'] || []).join('\n'), /ムネマダラトラカミキリ 基亜種/);
  assert.doesNotMatch((hostplantsJson['キリ'] || []).join('\n'), /イエカミキリ/);
  assert.equal((hostplantsJson['ヤチダモ'] || []).includes('キスジトラカミキリ'), true);
  assert.equal((hostplantsJson['ヤチダモ'] || []).includes('ナカジロサビカミキリ 基亜種'), false);
  assert.equal((hostplantsJson['リュウキュウガキ'] || []).includes('コウノゴマフカミキリ 沖縄島亜種'), true);
  assert.equal((hostplantsJson['リュウキュウガキ'] || []).includes('フタオビミドリトラカミキリ 御蔵島亜種'), false);
  assert.equal((hostplantsJson['ホテイチク'] || []).includes('サビアヤカミキリ'), true);
  assert.equal((hostplantsJson['ホテイチク'] || []).includes('タケトラカミキリ'), false);
});

test('generated public data reflects representative broad kamikiri corrections when present', () => {
  if (!generatedHostplants) return;

  assert.equal((generatedHostplants['ウメ'] || []).includes('ヒメヒゲナガカミキリ 基亜種'), true);
  assert.equal((generatedHostplants['ウメ'] || []).includes('ニセビロウドカミキリ 基亜種'), true);
  assert.equal((generatedHostplants['ウメ'] || []).includes('ヒゲナガカミキリ'), false);
  assert.equal((generatedHostplants['ウメ'] || []).includes('ビロウドカミキリ 基亜種'), false);
  assert.match((generatedHostplants['キリ'] || []).join('\n'), /ムネマダラトラカミキリ 基亜種/);
  assert.doesNotMatch((generatedHostplants['キリ'] || []).join('\n'), /イエカミキリ/);
  assert.equal((generatedHostplants['ヤチダモ'] || []).includes('キスジトラカミキリ'), true);
  assert.equal((generatedHostplants['ヤチダモ'] || []).includes('ナカジロサビカミキリ 基亜種'), false);
  assert.equal((generatedHostplants['リュウキュウガキ'] || []).includes('コウノゴマフカミキリ 沖縄島亜種'), true);
  assert.equal((generatedHostplants['リュウキュウガキ'] || []).includes('フタオビミドリトラカミキリ 御蔵島亜種'), false);
  assert.equal((generatedHostplants['ホテイチク'] || []).includes('サビアヤカミキリ'), true);
  assert.equal((generatedHostplants['ホテイチク'] || []).includes('タケトラカミキリ'), false);
});
