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
});

test('generated public フカノキ data and meta pages include recovered longhorn beetles', () => {
  const hostplantsJson = JSON.parse(fs.readFileSync('public/assets/data-lite/hostplants.json', 'utf8'));
  const fukanokiInsects = new Set(hostplantsJson['フカノキ'] || []);

  for (const [, label] of expectedFukanokiPairs) {
    assert.equal(fukanokiInsects.has(label), true, `public data should include ${label}`);
  }

  for (const page of ['public/meta/plant/フカノキ(ウコギ科).html', 'public/meta/plant/フカノキ.html']) {
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

test('generated public data reflects representative broad kamikiri corrections', () => {
  const hostplantsJson = JSON.parse(fs.readFileSync('public/assets/data-lite/hostplants.json', 'utf8'));

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
