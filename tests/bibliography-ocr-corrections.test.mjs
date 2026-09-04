import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { bibliography } from '../src/utils/bibliography.js';
import { getSourceLink } from '../src/utils/sourceLinks.js';

const expectedArticles = {
  'ga-tsushin-103-yamamoto-1979': { pages: '48' },
  'ga-tsushin-103-sugi-1979': { authors: ['宮田保'], pages: '37-39' },
  'ga-tsushin-108-iijima-1980': { pages: '127' },
  'ga-tsushin-114-togashi-1982': {
    title: '石川県産蛾類の食草 1', year: '1983', issue: '120', pages: '315-316',
  },
  'ga-tsushin-116-shimbo-1982': {
    title: '乗鞍岳高山帯の蛾 ならびに高山植物を食餌とする蛾の幼虫 (4)', pages: '250-255',
  },
  'ga-tsushin-121-togashi-1983': { title: '石川県産蛾類の食草 2', pages: '332-334' },
  'ga-tsushin-123-kita-1983': { pages: '371' },
  'ga-tsushin-126-gyotoku-1984': { title: 'クロモンシタバ幼虫の食樹と採集資料', pages: '7-9' },
  'ga-tsushin-128-nakamura-1984': {
    title: 'ケンモンキリガの食樹追加',
    pages: '34',
  },
  'ga-tsushin-137-togashi-1986': { title: '石川県産蛾類の食草 5', pages: '183-185' },
  'ga-tsushin-153-fujisawa-1989': { pages: '34-47' },
  'ga-tsushin-155-fujisawa-1989': { authors: ['藤沢勝利', '亀田満'], pages: '65-69' },
  'ga-tsushin-158-watanabe-1990': {
    title: 'ヒメカンアオイについていたワイギンモンウワバとビロードハマキの幼虫', pages: '139',
  },
  'ga-tsushin-169-sugi-1992a': { title: '台湾産 Melapia の一種', pages: '330' },
  'ga-tsushin-171-sugi-1992': { pages: '381' },
  'ga-tsushin-174-nakamura-1993': { title: '針葉樹の葉に潜るコハモグリガの幼生期', pages: '426-429' },
  'ga-tsushin-192-mitamura-1997': { pages: '279' },
  'ga-tsushin-193-tominaga-1997': { pages: '298' },
  'ga-tsushin-197-sasaki-1998': {
    title: '日本産 Kitanola マダライラガ属の再検討と2新種の記載', issue: '200', pages: '417-423',
  },
  'ga-tsushin-200-tanahara-e-1998': { authors: ['棚原功'], pages: '430-432' },
  'ga-tsushin-202a-tominaga-1999': { pages: '20' },
  'sayabane-1-栗原隆-2011': {
    title: '【短報】ツヤナガタマムシの寄主植物の記録',
    authors: ['栗原隆', '福富宏和'], pages: '26-27',
  },
  'sayabane-1-福富宏和-2011': {
    title: '【短報】日本におけるツマキナガタマムシの寄主植物および西表島からの記録',
    authors: ['福富宏和', '栗原隆'], pages: '27',
  },
  'japanese-journal-entomology-61-2-teramoto-1993': {
    title: 'Immature Stages of a Stictopterine Moth, Lophoptera hayesi (Lepidoptera, Noctuidae)',
    authors: ['Teramoto, N.'], year: '1993', volume: '61', issue: '2', pages: '197-202',
  },
};

test('OCR audit corrections remain reflected in bibliography metadata', () => {
  const byKey = new Map(bibliography.map((entry) => [entry.key, entry]));

  for (const [key, expected] of Object.entries(expectedArticles)) {
    const entry = byKey.get(key);
    assert.ok(entry, `missing bibliography entry: ${key}`);
    for (const [field, value] of Object.entries(expected)) {
      assert.deepEqual(entry[field], value, `${key}.${field}`);
    }
  }
});

test('confirmed duplicate bibliography keys stay removed', () => {
  const keys = new Set(bibliography.map((entry) => entry.key));
  assert.equal(keys.has('nihon-no-kiriga'), false);
  assert.equal(keys.has('sayabane-10-鈴木亙-2013-p12'), false);
});

test('Lophoptera hayesi uses the 1993 primary paper and resolves its source link', () => {
  const hostplants = fs.readFileSync(new URL('../normalized_data/hostplants.csv', import.meta.url), 'utf8');
  const row = hostplants.split(/\r?\n/).find((line) => line.startsWith('hostplant-913386,'));

  assert.ok(row);
  assert.match(row, /,寺本憲之 \(1993\),/);
  assert.doesNotMatch(row, /寺本憲之 \(1994\)/);
  assert.equal(getSourceLink('寺本憲之 (1993)'), 'https://dl.ndl.go.jp/pid/10654502');
});
