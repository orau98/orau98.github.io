import test from 'node:test';
import assert from 'node:assert/strict';

import { bibliography } from '../src/utils/bibliography.js';
import {
  AMAZON_ASSOCIATE_TAG,
  buildAmazonBookUrl,
  isAmazonAssociateUrl,
} from '../src/utils/amazonAssociates.js';
import {
  getCompactReferenceMeta,
  getReferenceMeta,
  getReferenceMetaList,
  getSourceLink,
  normalizeReference,
} from '../src/utils/sourceLinks.js';

test('normalizeReference canonicalizes 日本のキリガ to 日本の冬夜蛾', () => {
  assert.equal(normalizeReference('日本のキリガ'), '日本の冬夜蛾');
  assert.equal(normalizeReference('日本のキリガ p.12'), '日本の冬夜蛾');
});

test('getSourceLink resolves aliases to the canonical bibliography URL', () => {
  const canonicalUrl = 'https://www.mushi-sha.co.jp/shopdetail/000000000506/ct6/page1/recommend/';
  assert.equal(getSourceLink('日本のキリガ'), canonicalUrl);
  assert.equal(getSourceLink('日本の冬夜蛾'), canonicalUrl);
});

test('getReferenceMeta returns the canonical display label for aliases', () => {
  const meta = getReferenceMeta('日本のキリガ');
  assert.match(meta.displayLabel, /^小林 秀紀・四方 圭一郎・枝 恵太郎 \(2016\)。日本の冬夜蛾/);
  assert.match(meta.link || '', /000000000506/);
});

test('getReferenceMetaList merges 日本のキリガ into a single 日本の冬夜蛾 entry', () => {
  const metas = getReferenceMetaList(['日本の冬夜蛾', '日本のキリガ']);
  assert.equal(metas.length, 1);
  assert.equal(metas[0].displayLabel, getReferenceMeta('日本の冬夜蛾').displayLabel);
  assert.match(metas[0].link || '', /000000000506/);
});

test('flower-visit citations resolve the subtitle variants to the same author and year', () => {
  const references = [
    '花を訪れる蛾たち',
    '花を訪れる蛾たち　知られざる姿を求めて',
    '花を訪れる蛾たち―知られざる姿を求めて',
  ];
  const [citation] = getReferenceMetaList(references, { compact: true });
  assert.equal(getReferenceMetaList(references, { compact: true }).length, 1);
  assert.equal(citation.label, '池ノ上 利幸 (2008)');
  assert.match(citation.publication, /花を訪れる蛾たち.*知られざる姿を求めて/);
  assert.equal(citation.link, buildAmazonBookUrl('490264908X'));
});

test('plant profile citations keep the volume and printed or PDF page locators', () => {
  const first = getCompactReferenceMeta('日本の野生植物 第1巻 p.300 / PDF p.150');
  const second = getCompactReferenceMeta('日本の野生植物 第2巻 PDF p.46');
  assert.equal(first.label, '大橋広好・門田裕一・邑田仁・米倉浩司・木原浩（編） (2021)');
  assert.equal(second.label, first.label);
  assert.equal(first.location, 'p.300 / PDF p.150');
  assert.equal(second.location, 'PDF p.46');
  assert.match(first.publication, /第1巻/);
  assert.match(second.publication, /第2巻/);
  assert.notEqual(first.link, second.link);
});

test('unresolved sources retain their complete labels and issue numbers', () => {
  const shortSeries = '日本産ハムシ科生態覚書';
  const seriesIssue = 'さやばね ニューシリーズ (さやばね ニューシリーズ No.17)';
  assert.equal(getCompactReferenceMeta(shortSeries).label, shortSeries);
  assert.equal(getCompactReferenceMeta(seriesIssue).label, seriesIssue);
  const citedIssue = getCompactReferenceMeta('越野誠一郎 (1999) 蛾類通信202号');
  assert.equal(citedIssue.label, '越野誠一郎 (1999)');
  assert.equal(citedIssue.publication, '蛾類通信202号');
});

test('getSourceLink resolves the Schizaphis taxonomy references', () => {
  assert.equal(
    getSourceLink('日本昆虫目録 第4巻 準新翅類'),
    buildAmazonBookUrl('4434218220'),
  );
  assert.match(getSourceLink('松本嘉幸 (2005)') || '', /kahaku\.go\.jp/);
  assert.equal(getSourceLink('Miyazaki (1988)'), 'https://dl.ndl.go.jp/pid/10653578');
  assert.match(getSourceLink('Blackman & Eastop, Aphids on the World\'s Plants') || '', /aphidsonworldsplants\.info/);
  assert.match(getSourceLink('Aphid Species File') || '', /speciesfile\.org/);
});

test('book references use the restored Amazon Associate tag', () => {
  const expectedBooks = new Map([
    ['日本産蛾類標準図鑑1', '405403845X'],
    ['日本産蛾類標準図鑑2', '4054038468'],
    ['日本産蛾類標準図鑑3', '405405109X'],
    ['日本産蛾類標準図鑑4', '4054051103'],
    ['花を訪れる蛾たち', '490264908X'],
    ['日本産タマムシ大図鑑', '494395507X'],
    ['ハムシハンドブック', '4829981229'],
    ['日本産カミキリムシ', '4486017412'],
    ['日本産蝶類標準図鑑', '4052022963'],
    ['日本原色アブラムシ図鑑', '4881370170'],
    ['日本昆虫目録 第4巻 準新翅類', '4434218220'],
  ]);

  for (const [reference, asin] of expectedBooks) {
    const url = getSourceLink(reference);
    assert.equal(url, buildAmazonBookUrl(asin), reference);
    assert.equal(isAmazonAssociateUrl(url), true, reference);
    assert.equal(new URL(url).searchParams.get('tag'), AMAZON_ASSOCIATE_TAG, reference);
  }
});

test('bibliography book URLs preserve Amazon Associate attribution', () => {
  const amazonEntries = bibliography.filter((entry) => isAmazonAssociateUrl(entry.url));
  assert.equal(amazonEntries.length, 11);
});

test('books without a current Amazon product page keep their publisher or society links', () => {
  assert.match(getSourceLink('日本の冬夜蛾') || '', /mushi-sha\.co\.jp/);
  assert.match(getSourceLink('日本の冬尺蛾') || '', /mushi-sha\.co\.jp/);
  assert.equal(getSourceLink('日本のハマキガ3'), 'https://www.moth.jp/pubs/special');
});

test('getSourceLink resolves the primary Scolytinae papers', () => {
  assert.equal(
    getSourceLink('Nobuchi (1964) Studies on Scolytidae III'),
    'https://www.ffpri.go.jp/pubs/bulletin/151/documents/171-3.pdf',
  );
  assert.equal(
    getSourceLink('Nobuchi (1973) Studies on Scolytidae XI'),
    'https://www.ffpri.go.jp/pubs/bulletin/251/documents/258-2.pdf',
  );
  assert.equal(
    getSourceLink('Nobuchi (1974) Studies on Scolytidae XII'),
    'https://www.ffpri.go.jp/pubs/bulletin/251/documents/266-4.pdf',
  );
  assert.equal(
    getSourceLink('Nobuchi (1975) Studies on Scolytidae XIII'),
    'https://www.ffpri.go.jp/pubs/bulletin/251/documents/277-3.pdf',
  );
  assert.equal(
    getSourceLink('Nobuchi (1979) Studies on Scolytidae XVIII'),
    'https://www.ffpri.go.jp/pubs/bulletin/301/documents/308-1.pdf',
  );
  assert.equal(
    getSourceLink('Nobuchi (1981) Revision of the genus Xylosandrus from Japan'),
    'https://www.ffpri.go.jp/pubs/bulletin/301/documents/314-4.pdf',
  );
});

test('species citations render the full bibliography for titles, references and record keys', () => {
  const sources = [
    '岡本清 (1995) 「メイガ幼虫の食草について」',
    'メイガ幼虫の食草について',
    'tentomushi-okamoto-foodplants-1995',
  ];
  const expected = {
    displayLabel: '岡本清 (1995)。メイガ幼虫の食草について。てんとうむし 特別号「遊蟲千年」 pp. 19-21',
    link: 'https://www.konchukan.net/pdf/tentomushi/specialnumber/tentomushi_specialnumber_19-21.pdf',
  };

  assert.deepEqual(getReferenceMetaList(sources), [expected]);
  assert.deepEqual(getReferenceMetaList([sources[2]]), [expected]);
});

test('different articles in the same issue remain distinct in the source list', () => {
  const metas = getReferenceMetaList([
    'suzumushi-140-nakamura-2005-p95-tamagawa',
    'suzumushi-140-nakamura-2005-p95-96-bisei',
  ]);

  assert.equal(metas.length, 2);
  assert.equal(metas[0].link, metas[1].link);
  assert.match(metas[0].displayLabel, /高梁市玉川町.*すずむし 第140号 pp\. 95$/);
  assert.match(metas[1].displayLabel, /美星町中央部.*すずむし 第140号 pp\. 95-96$/);
});
