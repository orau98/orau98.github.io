import test from 'node:test';
import assert from 'node:assert/strict';

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
  assert.match(getSourceLink('日本昆虫目録 第4巻 準新翅類') || '', /ndlsearch\.ndl\.go\.jp/);
  assert.match(getSourceLink('松本嘉幸 (2005)') || '', /kahaku\.go\.jp/);
  assert.equal(getSourceLink('Miyazaki (1988)'), 'https://dl.ndl.go.jp/pid/10653578');
  assert.match(getSourceLink('Blackman & Eastop, Aphids on the World\'s Plants') || '', /aphidsonworldsplants\.info/);
  assert.match(getSourceLink('Aphid Species File') || '', /speciesfile\.org/);
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
