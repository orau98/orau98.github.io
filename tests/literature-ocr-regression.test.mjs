import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const parseCsv = (relativePath) => {
  const text = fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
  return Papa.parse(text.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), {
    header: true,
    skipEmptyLines: true,
  }).data;
};

const csvPaths = ['normalized_data/hostplants.csv', 'public/hostplants.csv'];

const hostNames = (rows, insectId, reference) => new Set(rows
  .filter((row) => row.insect_id === insectId && (!reference || row.reference === reference))
  .map((row) => row.plant_name));

test('日本原色アブラムシ図鑑のクリオオアブラムシ寄主を本文断片のまま残さない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const targetRows = rows.filter((row) => row.insect_id === 'species-21538');
    const names = new Set(targetRows.map((row) => row.plant_name));

    assert.equal(names.has('クリのほかにカシ'), false, `${csvPath} should split the prose fragment`);
    assert.equal(names.has('クリ'), true, `${csvPath} should keep クリ from the source text`);
    assert.equal(names.has('カシ'), true, `${csvPath} should keep カシ from the source text`);
    assert.equal(names.has('クヌギ'), true, `${csvPath} should keep クヌギ from the source text`);

    const kuri = targetRows.find((row) => row.plant_name === 'クリ');
    const kashi = targetRows.find((row) => row.plant_name === 'カシ');
    assert.equal(kuri?.plant_family, 'ブナ科');
    assert.equal(kashi?.plant_family, 'ブナ科');
  }
});

test('日本原色アブラムシ図鑑の見出し種に連続する寄主だけを反映する', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const ref = '日本原色アブラムシ図鑑';

    const isunoki = hostNames(rows, 'species-21000', ref);
    const todo = hostNames(rows, 'species-21067', ref);
    const kashiwa = hostNames(rows, 'species-21136', ref);
    const ichigo = hostNames(rows, 'species-21249', ref);
    const yomogi = hostNames(rows, 'species-21378', ref);

    assert.equal(isunoki.has('イスノキ'), true, `${csvPath} should include イスノキ for イスノアキアブラムシ`);
    for (const plantName of ['モミ', 'ツガ', 'トドマツ', 'シラベ']) {
      assert.equal(todo.has(plantName), true, `${csvPath} should include ${plantName} for トドワタムシ`);
    }
    for (const plantName of ['コナラ', 'カシワ', 'ミズナラ']) {
      assert.equal(kashiwa.has(plantName), true, `${csvPath} should include ${plantName} for カシワトゲマダラアブラムシ`);
    }
    assert.equal(ichigo.has('カジイチゴ'), true, `${csvPath} should correct カチイチゴ to カジイチゴ for Aphis ichigo`);
    assert.equal(ichigo.has('クマイチゴ'), true, `${csvPath} should include クマイチゴ for Aphis ichigo`);
    assert.equal(ichigo.has('カチイチゴ'), false, `${csvPath} should not expose the OCR form カチイチゴ`);
    assert.equal(yomogi.has('ヨモギ'), true, `${csvPath} should include ヨモギ for ヨモギクビレアブラムシ`);

    assert.equal(hostNames(rows, 'species-21069', ref).has('カエデ類'), false, `${csvPath} should not assign トウキョウカマガタアブラムシ hosts to ヒラヤマカマガタアブラムシ`);
    assert.equal(hostNames(rows, 'species-21078', ref).has('アキニレ'), false, `${csvPath} should not assign ニレヒゲマダラアブラムシ hosts to ニレクロマダラアブラムシ`);
    for (const plantName of ['ショウブ', 'オニガヤツリ', 'ガマ']) {
      assert.equal(hostNames(rows, 'species-21313', ref).has(plantName), false, `${csvPath} should not assign Schizaphis rotundiventris hosts to species-21313`);
    }
    for (const plantName of ['ミヤマベニシダ', 'シノブカグマ']) {
      assert.equal(hostNames(rows, 'species-21422', ref).has(plantName), false, `${csvPath} should not assign オシダコブアブラムシ hosts to species-21422`);
    }
    for (const plantName of ['カリン', 'リンゴ']) {
      assert.equal(hostNames(rows, 'species-21472', ref).has(plantName), false, `${csvPath} should not assign ハッカイボアブラムシ hosts to リンゴミドリアブラムシ`);
    }
    assert.equal(hostNames(rows, 'species-21481', ref).has('ヨモギ'), false, `${csvPath} should not assign ヨモギクギケアブラムシ hosts to ヨモギミドリクギケアブラムシ`);
    assert.equal(hostNames(rows, 'species-21518', ref).has('チュウゴクオウトウ'), false, `${csvPath} should not assign Tuberocephalus sp. hosts to モモコブアブラムシ`);
    for (const plantName of ['マテバシイ', 'アラカシ']) {
      assert.equal(hostNames(rows, 'species-21535', ref).has(plantName), false, `${csvPath} should not assign comparison-text hosts to カシオオアブラムシ`);
    }
  }
});

test('日本産蛾類標準図鑑1のチャオビコバネナミシャク寄主をOCR断片名にしない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const targetRows = rows.filter((row) => row.insect_id === 'species-4098');
    const names = new Set(targetRows.map((row) => row.plant_name));

    assert.equal(names.has('卵形幼虫はアカシ'), false, `${csvPath} should not keep an OCR prose fragment`);
    assert.equal(names.has('アラカシ'), true, `${csvPath} should recover アラカシ from the source text`);
    assert.equal(names.has('シラカシ'), true, `${csvPath} should keep シラカシ from the source text`);
    assert.equal(names.has('ケヤキ'), true, `${csvPath} should keep ケヤキ from the source text`);
  }
});

test('日本産蝶類標準図鑑の欠落食草とCapparis綴りを保持する', () => {
  const expected = {
    'species-20196': ['ツゲモドキ'],
    'species-20287': ['クロヨナ'],
    'species-20340': ['シダレヤナギ'],
    'species-20391': ['キジョラン', 'フルモウリンカ', 'ホウライアオカズラ'],
    'species-20402': ['コウシュンカズラ', 'アセロラ', 'モモタマナ'],
    'species-20435': ['ムニンススキ', 'サトウキビ', 'ススキ'],
  };

  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);

    for (const [insectId, plantNames] of Object.entries(expected)) {
      const names = new Set(rows
        .filter((row) => row.insect_id === insectId && row.reference === '日本産蝶類標準図鑑')
        .map((row) => row.plant_name));

      for (const plantName of plantNames) {
        assert.equal(names.has(plantName), true, `${csvPath} should include ${plantName} for ${insectId}`);
      }
    }

    const kawakami = rows.filter((row) => row.insect_id === 'species-20197');
    const kawakamiNames = new Set(kawakami.map((row) => row.plant_name));
    assert.equal(kawakamiNames.has('Capparis heyncana'), false, `${csvPath} should not keep the OCR typo`);
    assert.equal(kawakamiNames.has('Capparis heyneana'), true, `${csvPath} should keep the corrected source spelling`);
  }
});

test('日本産蛾類標準図鑑2の寄主植物欄を隣接種へ混入させない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const ref = '日本産蛾類標準図鑑2';

    const yu = hostNames(rows, 'species-20671', ref);
    const inanis = hostNames(rows, 'species-20697', ref);
    const karschi = hostNames(rows, 'species-20709', ref);
    const nigricans = hostNames(rows, 'species-20710', ref);

    assert.equal(yu.has('スズメノヒエ属'), true, `${csvPath} should include スズメノヒエ属 for ユーウスイロキヨトウ`);
    assert.equal(yu.has('ワセオバナ'), true, `${csvPath} should include ワセオバナ for ユーウスイロキヨトウ`);
    assert.equal(inanis.has('スズメノヒエ属'), false, `${csvPath} should not assign ユーウスイロキヨトウ hosts to ウスイロキヨトウ`);
    assert.equal(inanis.has('ワセオバナ'), false, `${csvPath} should not assign ユーウスイロキヨトウ hosts to ウスイロキヨトウ`);

    assert.equal(karschi.has('イネ科'), true, `${csvPath} should include the family-level イネ科 record for ムギヤガ`);

    for (const plantName of ['テンサイ', 'キャベツ', 'インゲンマメ', 'クローバー', 'オオムギ', 'コムギ', 'オオバコ', 'セリ科']) {
      assert.equal(nigricans.has(plantName), true, `${csvPath} should include ${plantName} for キタクロヤガ`);
    }
    for (const sourcePhrase of ['砂糖大根', '大麦', '小麦']) {
      assert.equal(nigricans.has(sourcePhrase), false, `${csvPath} should expose normalized plant names instead of ${sourcePhrase}`);
    }
  }
});

test('日本産蛾類標準図鑑3のホソハマキモドキ類は隣接種の寄主を混入させない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const ref = '日本産蛾類標準図鑑3';

    const tsuya = hostNames(rows, 'species-0748', ref);
    const nami = hostNames(rows, 'species-0749', ref);
    const ko = hostNames(rows, 'species-0750', ref);
    const shinju = hostNames(rows, 'species-0754', ref);
    const shirozu = hostNames(rows, 'species-0755', ref);
    const mesumon = hostNames(rows, 'species-0757', ref);

    assert.equal(tsuya.has('ネザサ'), false, `${csvPath} should not assign ネザサ to ツヤホソハマキモドキ`);
    assert.equal(nami.has('ネザサ'), true, `${csvPath} should keep ネザサ for ナミホソハマキモドキ`);
    assert.equal(nami.has('シャクヤク'), false, `${csvPath} should not keep unrelated OCR spillover on ナミホソハマキモドキ`);
    assert.equal(nami.has('セントウソウ'), false, `${csvPath} should not keep unrelated OCR spillover on ナミホソハマキモドキ`);
    assert.equal(ko.has('カサスゲ'), false, `${csvPath} should keep コホソハマキモドキ as unknown`);
    assert.equal(shinju.has('オオシンジュガヤ'), true, `${csvPath} should keep オオシンジュガヤ for シンジュガヤホソハマキモドキ`);
    assert.equal(shirozu.has('アブラガヤ'), true, `${csvPath} should keep アブラガヤ for シロズホソハマキモドキ`);
    assert.equal(mesumon.has('アブラガヤ'), false, `${csvPath} should keep メスモンホソハマキモドキ as unknown`);
  }
});

test('日本産蛾類標準図鑑3のノコメキバガ類はOCRの隣接ブロック混入を補正する', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const ref = '日本産蛾類標準図鑑3';

    const omelkoi = hostNames(rows, 'species-1462', ref);
    const ussuriella = hostNames(rows, 'species-1463', ref);
    const mukurossivora = hostNames(rows, 'species-1464', ref);
    const posticalis = hostNames(rows, 'species-1539', ref);

    assert.equal(omelkoi.has('アベマキ'), true, `${csvPath} should keep アベマキ for オメルコクロノコメキバガ`);
    assert.equal(omelkoi.has('モンゴリナラ'), true, `${csvPath} should keep モンゴリナラ for オメルコクロノコメキバガ`);
    assert.equal(omelkoi.has('ハリシロヤナギ'), false, `${csvPath} should not keep OCR spillover ハリシロヤナギ`);
    assert.equal(omelkoi.has('ミズナラ'), false, `${csvPath} should not keep ウスリーノコメキバガ host on オメルコ`);

    assert.equal(ussuriella.has('ミズナラ'), true, `${csvPath} should add ミズナラ for ウスリーノコメキバガ`);
    assert.equal(ussuriella.has('モンゴリナラ'), true, `${csvPath} should add モンゴリナラ for ウスリーノコメキバガ`);
    assert.equal(mukurossivora.has('ムクロジ'), true, `${csvPath} should keep ムクロジ for ムクロジハオリノコメキバガ`);

    assert.equal(posticalis.has('カエデ類'), true, `${csvPath} should normalize カエデ類各種 to カエデ類`);
    assert.equal(posticalis.has('カエデ類各種'), false, `${csvPath} should not keep the source phrase as a separate plant key`);
    assert.equal(posticalis.has('クマシデ'), true, `${csvPath} should keep クマシデ for ヒロズイラガ`);
    assert.equal(posticalis.has('サワシバ'), true, `${csvPath} should keep サワシバ for ヒロズイラガ`);
  }
});

test('日本産蛾類標準図鑑3のホタルガ類とモモブトスカシバ類は隣接種の寄主を混入させない', () => {
  for (const csvPath of csvPaths) {
    const rows = parseCsv(csvPath);
    const ref = '日本産蛾類標準図鑑3';

    const mesuji = hostNames(rows, 'species-1564', ref);
    const shiroshita = hostNames(rows, 'species-1566', ref);
    const hotaruga = hostNames(rows, 'species-1567', ref);
    const koshiaka = hostNames(rows, 'species-1587', ref);
    const taiwan = hostNames(rows, 'species-20938', ref);
    const ruri = hostNames(rows, 'species-20939', ref);
    const shitaki = hostNames(rows, 'species-1589', ref);
    const oo = hostNames(rows, 'species-1590', ref);

    assert.equal(mesuji.has('クロバイ'), true, `${csvPath} should include the クロバイ rearing record for メスジロホタルガ`);
    assert.equal(shiroshita.has('サワフタギ'), true, `${csvPath} should keep サワフタギ for シロシタホタルガ`);
    assert.equal(shiroshita.has('タンナサワフタギ'), true, `${csvPath} should keep タンナサワフタギ for シロシタホタルガ`);
    assert.equal(shiroshita.has('サカキ'), false, `${csvPath} should not assign ホタルガ hosts to シロシタホタルガ`);
    assert.equal(shiroshita.has('ヒサカキ'), false, `${csvPath} should not assign ホタルガ hosts to シロシタホタルガ`);
    assert.equal(hotaruga.has('ヒサカキ'), true, `${csvPath} should keep ヒサカキ for ホタルガ`);
    assert.equal(hotaruga.has('ハマヒサカキ'), true, `${csvPath} should keep ハマヒサカキ for ホタルガ`);
    assert.equal(hotaruga.has('サカキ'), true, `${csvPath} should keep サカキ for ホタルガ`);

    assert.equal(koshiaka.has('ケカラスウリ'), false, `${csvPath} should not assign タイワンモモブトスカシバ host to コシアカスカシバ`);
    assert.equal(taiwan.has('ケカラスウリ'), true, `${csvPath} should keep ケカラスウリ for タイワンモモブトスカシバ`);
    assert.equal(taiwan.has('カラスウリ'), false, `${csvPath} should not assign シタキ/オオモモブト hosts to タイワンモモブトスカシバ`);
    assert.equal(ruri.has('カラスウリ'), false, `${csvPath} should keep ルリオオモモブトスカシバ as unknown`);
    assert.equal(ruri.has('キカラスウリ'), false, `${csvPath} should keep ルリオオモモブトスカシバ as unknown`);
    assert.equal(shitaki.has('カラスウリ'), true, `${csvPath} should keep カラスウリ for シタキモモブトスカシバ`);
    assert.equal(shitaki.has('キカラスウリ'), true, `${csvPath} should keep キカラスウリ for シタキモモブトスカシバ`);
    assert.equal(oo.has('カラスウリ'), true, `${csvPath} should keep カラスウリ for オオモモブトスカシバ`);
    assert.equal(oo.has('キカラスウリ'), true, `${csvPath} should keep キカラスウリ for オオモモブトスカシバ`);
  }
});
