import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANT_QUERY_ALIASES,
  filterBySearchQuery,
  getRelevanceTerm,
  matchesSearchQuery,
  parseSearchQuery,
} from '../src/utils/searchQuery.js';

const fieldsOf = (...values) => values.map((value) => String(value || '').toLowerCase());

test('前後の空白（全角スペースを含む）は無視する', () => {
  const query = parseSearchQuery('オオミズアオ　');
  assert.ok(matchesSearchQuery(query, fieldsOf('オオミズアオ', 'Actias aliena')));
  assert.equal(parseSearchQuery(' 　 '), null);
});

test('ひらがな・半角カナはカタカナとして探す', () => {
  assert.ok(matchesSearchQuery(parseSearchQuery('おおみずあお'), fieldsOf('オオミズアオ')));
  assert.ok(matchesSearchQuery(parseSearchQuery('ｵｵﾐｽﾞｱｵ'), fieldsOf('オオミズアオ')));
});

test('空白で区切った語は、詰めた語でもすべてを含む語でも一致する', () => {
  assert.ok(matchesSearchQuery(parseSearchQuery('アオスジ アゲハ'), fieldsOf('アオスジアゲハ')));
  assert.ok(matchesSearchQuery(parseSearchQuery('Papilio  xuthus'), fieldsOf('papilio xuthus linnaeus, 1767')));
  // 食草名を空白で並べると、両方を食べる昆虫だけに一致する
  const query = parseSearchQuery('コナラ クヌギ');
  assert.ok(matchesSearchQuery(query, fieldsOf('ミズイロオナガシジミ', '', 'コナラ クヌギ ミズナラ')));
  assert.ok(!matchesSearchQuery(query, fieldsOf('ヤママユ', '', 'コナラ')));
});

test('すべてを含むものが無いときだけ、どれかを含むもので探し直す', () => {
  const plants = ['コナラ', 'クヌギ', 'ミズナラ'];
  assert.deepEqual(filterBySearchQuery(plants, parseSearchQuery('コナラ クヌギ'), (name) => fieldsOf(name)), ['コナラ', 'クヌギ']);
  assert.deepEqual(filterBySearchQuery(plants, parseSearchQuery('ナラ'), (name) => fieldsOf(name)), ['コナラ', 'ミズナラ']);
  assert.deepEqual(filterBySearchQuery(plants, null, (name) => fieldsOf(name)), plants);
});

test('植物の漢字・通称は図鑑の表記に読み替える', () => {
  const sakura = parseSearchQuery('桜', PLANT_QUERY_ALIASES);
  assert.ok(matchesSearchQuery(sakura, fieldsOf('オオシマザクラ', 'サクラ属', 'バラ科')));
  assert.equal(getRelevanceTerm(sakura), 'サクラ');
  assert.ok(matchesSearchQuery(parseSearchQuery('どんぐり', PLANT_QUERY_ALIASES), fieldsOf('コナラ', 'ブナ科')));
  assert.equal(getRelevanceTerm(parseSearchQuery('クヌギ', PLANT_QUERY_ALIASES)), 'クヌギ');
});
