import test from 'node:test';
import assert from 'node:assert/strict';

import { bibliography } from '../src/utils/bibliography.js';
import {
  AMAZON_ASSOCIATES_DISCLOSURE,
  AMAZON_ASSOCIATE_TAG,
  buildAmazonBookUrl,
  isAmazonAssociateUrl,
} from '../src/utils/amazonAssociates.js';
import {
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
  assert.equal(meta.displayLabel, '日本の冬夜蛾');
  assert.match(meta.link || '', /000000000506/);
});

test('getReferenceMetaList merges 日本のキリガ into a single 日本の冬夜蛾 entry', () => {
  const metas = getReferenceMetaList(['日本の冬夜蛾', '日本のキリガ']);
  assert.equal(metas.length, 1);
  assert.equal(metas[0].displayLabel, '日本の冬夜蛾');
  assert.match(metas[0].link || '', /000000000506/);
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

test('bibliography book URLs and disclosure preserve Amazon Associate attribution', () => {
  const amazonEntries = bibliography.filter((entry) => isAmazonAssociateUrl(entry.url));
  assert.equal(amazonEntries.length, 11);
  assert.equal(
    AMAZON_ASSOCIATES_DISCLOSURE.ja,
    'Amazonのアソシエイトとして、昆虫植物図鑑は適格販売により収入を得ています。',
  );
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
