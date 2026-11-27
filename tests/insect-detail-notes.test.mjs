import assert from 'node:assert/strict';
import test from 'node:test';
import { projectInsectNotes } from '../src/utils/insectNoteRevisions.js';
import { buildInsectDetailNotes, parseInsectDetailSeason } from '../src/utils/insectDetailNotes.js';

const season = (content, reference) => ({ type: '出現時期', content, reference });
const ecology = (content, reference) => ({ type: '生態情報', content, reference });

test('regional adult records retain both sources and omit dates from ecology', () => {
  const standard = '日本産蛾類標準図鑑1';
  const winter = '日本の冬尺蛾';
  const regional = '北海道では4月中旬、利尻島では4月下旬、礼文島では5月上旬';
  const kanto = '関東周辺では3月上旬~下旬(年によっては4月上旬まで)。';
  const detailed = '地域により2月下旬〜3月上旬に出現し始め、3月下旬まで見られる。';
  const result = buildInsectDetailNotes({
    type: 'moth',
    generalNotes: [
      season(kanto, winter),
      season(`地域により2月下旬〜3月下旬。${regional}。`, standard),
      ecology(`早春に出現する昼飛性の蛾。${detailed}${regional}に見られる。`, standard),
      ecology('典型的な早春の昼飛性種で、晴天でなければ飛翔しない。クズの樹皮の割れ目に産卵する。', winter),
    ],
  });
  assert.deepEqual(result.seasonRecords.map((record) => record.content), [kanto, `${detailed}${regional}。`]);
  assert.deepEqual(result.seasonRecords.map((record) => record.sources), [[winter], [standard]]);
  assert.deepEqual(result.ecologyNotes, [
    { content: '昼飛性の蛾。', sources: [standard] },
    { content: '昼飛性種で、晴天でなければ飛翔しない。クズの樹皮の割れ目に産卵する。', sources: [winter] },
  ]);
  const plot = parseInsectDetailSeason(result.seasonRecords.map((record) => record.content));
  assert.ok(plot.periods.includes(2.3) && plot.periods.includes(5.1));
  assert.ok(!plot.periods.includes(2.2) && !plot.periods.includes(5.2));
});

test('shared adult dates are merged even when a different source reports behavior and juvenile stages', () => {
  const result = buildInsectDetailNotes({
    type: 'beetle',
    generalNotes: [
      season('5〜6月', '図鑑A'),
      ecology('成虫は5月〜6月に出現し、モモなどを後食する。幼虫は8月に見られる。蛹で越冬する。', '図鑑B'),
      ecology('山地の成虫は8月に出現する。', '図鑑B'),
    ],
  });
  assert.deepEqual(result.seasonRecords.map((record) => record.content), ['5〜6月', '山地の成虫は8月に出現する。']);
  assert.deepEqual(result.seasonRecords.map((record) => record.sources), [['図鑑A', '図鑑B'], ['図鑑B']]);
  assert.deepEqual(result.ecologyNotes, [
    { content: 'モモなどを後食する。幼虫は8月に見られる。蛹で越冬する。', sources: ['図鑑B'] },
  ]);
  assert.ok(!parseInsectDetailSeason(result.seasonRecords.map((record) => record.content)).months.includes(7));
});

test('matching dates in editions with distinct locality or conditions are preserved', () => {
  const spring = '4月〜5月';
  const qualifiers = [`関東では${spring}。`, `山地では${spring}。`, `暖冬の年は${spring}。`];
  const result = buildInsectDetailNotes({
    type: 'butterfly',
    generalNotes: qualifiers.map((text) => season(text, '図鑑A')),
  });
  assert.deepEqual(result.seasonRecords.map((record) => record.content), qualifiers);
});

test('field season excludes captivity, juvenile seasons and isolated dated specimens', () => {
  const result = buildInsectDetailNotes({
    type: 'moth',
    generalNotes: [
      ecology('成虫は3〜10月に出現する。幼虫は5月に得られる。飼育すると11月に羽化する。', '図鑑'),
      ecology('2012年8月に成虫が1頭採集された。', '原著'),
    ],
  });
  assert.deepEqual(result.seasonRecords.map((record) => record.content), ['成虫は3〜10月に出現する。']);
  assert.deepEqual(result.ecologyNotes.map(note => note.content), [
    '幼虫は5月に得られる。飼育すると11月に羽化する。',
    '2012年8月に成虫が1頭採集された。',
  ]);
});

test('foreign dates and single records appear in the text without extending the domestic season chart', () => {
  const text = ['日本では7月に成虫が出現する。ヨーロッパでは5〜7月に出現する。', '2012年11月に1頭を採集。'];
  assert.deepEqual(parseInsectDetailSeason(text).months, [7]);
});

test('source revisions preserve the original row and project independent ecology and adult timing', () => {
  const original = {
    record_id: 'note-tamamushi-10002-ecology-5bcb8caafe15',
    insect_id: 'species-10002',
    note_type: '生態情報',
    content: '成虫は5〜6月に発生し、モモなどを後食する。日本では長崎県・鹿児島県・東京都などから記録されている。',
    reference: '日本産タマムシ大図鑑',
    page: '',
    year: '1867',
  };
  const result = projectInsectNotes([original])[0];
  assert.equal(result.note_type, '生態情報');
  assert.doesNotMatch(result.content, /5〜6月/);
  assert.match(result.content, /モモなどを後食/);
  assert.equal(result.year, '2013');
  assert.equal(result.record_id, original.record_id);
  assert.match(original.content, /5〜6月/);
  const changed = { ...original, page: '109' };
  assert.deepEqual(projectInsectNotes([changed]), [changed]);
});

test('occasional visitors retain their record months without depicting an established adult season', () => {
  const statement = '成虫は3〜9月に記録されているが、偶産と考えられる。';
  const result = buildInsectDetailNotes({ type: 'moth', generalNotes: [season(statement, '日本産蛾類標準図鑑2')] });
  assert.deepEqual(result.seasonRecords.map((record) => record.content), [statement]);
  assert.deepEqual(parseInsectDetailSeason(result.seasonRecords.map((record) => record.content)).months, []);
});

test('only shared statements get both works and correct page numbers', () => {
  const shared = '6〜7月に出現する。';
  const regional = '山地では8月に見られる。';
  const result = buildInsectDetailNotes({
    type: 'moth',
    generalNotes: [
      { ...season(shared + regional, '日本の冬尺蛾'), page: '64' },
      { ...season(shared, '日本産蛾類標準図鑑1'), page: '188' },
      season(shared, '日本の冬尺蛾'),
    ],
  });
  assert.deepEqual(result.seasonRecords, [
    { content: shared, sources: ['日本の冬尺蛾 p. 64', '日本産蛾類標準図鑑1 p. 188'] },
    { content: regional, sources: ['日本の冬尺蛾 p. 64'] },
  ]);
});


test('the plotted periods come from the complete, citation-linked season notes', () => {
  const standard = '日本産蛾類標準図鑑2';
  const winter = '日本の冬夜蛾';
  const result = buildInsectDetailNotes({
    type: 'moth',
    generalNotes: [
      { ...season('年1化。11月頃に羽化し、翌年3月頃まで見られる。', standard), page: '355' },
      { ...season('11月羽化〜翌年3月', winter), page: '72' },
    ],
  });
  assert.deepEqual(result.seasonRecords.map(({ sources }) => sources), [[standard + ' p. 355'], [winter + ' p. 72']]);
  const chart = parseInsectDetailSeason(result.seasonRecords.map(({ content }) => content));
  assert.deepEqual(chart.months.toSorted((a, b) => a - b), [1, 2, 3, 11, 12]);
  assert.equal(chart.periods.length, 15);
});

test('a continuous adult overwintering record stays intact beside juvenile and captive notes', () => {
  const record = '10〜11月に羽化し、成虫で越冬して翌年4〜5月頃まで生存する。';
  const result = buildInsectDetailNotes({
    type: 'moth',
    generalNotes: [
      season(record + '幼虫は7月、飼育下で8月に羽化した。', '図鑑'),
    ],
  });
  assert.deepEqual(result.seasonRecords.map(({ content }) => content), [record]);
  assert.deepEqual(parseInsectDetailSeason([record, '幼虫は7月、成虫は9月に見られる。']).months.toSorted((a, b) => a - b),
    [1, 2, 3, 4, 5, 9, 10, 11, 12]);
});
