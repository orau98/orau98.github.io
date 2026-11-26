import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEmergenceTime, hasEmergencePeriods, shouldAnalyzeEmergenceHint } from '../src/utils/emergenceTime.js';
import { getEmergenceMonths } from '../src/utils/emergenceTimeUtils.js';
import { parseInsectDetailSeason } from '../src/utils/insectDetailNotes.js';

test('extracted emergence parser preserves empty, full-year and year-spanning periods', () => {
  assert.equal(hasEmergencePeriods('不明'), false);
  assert.deepEqual(parseEmergenceTime('周年').months, [1,2,3,4,5,6,7,8,9,10,11,12]);
  assert.deepEqual(parseEmergenceTime('10-12、1-5月').months, [1,2,3,4,5,10,11,12]);
  assert.equal(hasEmergencePeriods('5月上旬'), true);
  assert.equal(shouldAnalyzeEmergenceHint('成虫は春に出現'), true);
  assert.equal(shouldAnalyzeEmergenceHint('食草はアデク'), false);
});

const winterMonths = [1, 2, 3, 11, 12];

test('both published accounts for チャマダラキリガ give the same five-month span', () => {
  for (const text of [
    '年1化。11月頃に羽化し、翌年3月頃まで見られる。',
    '11月羽化〜翌年3月',
    '11月頃に羽化し、3月頃まで見られる。',
  ]) {
    const result = parseEmergenceTime(text);
    assert.deepEqual(result.months, winterMonths, text);
    assert.deepEqual(getEmergenceMonths(text), winterMonths, text);
    assert.equal(result.periods.length, 15, text);
  }
  assert.deepEqual(getEmergenceMonths('11-3'), winterMonths);
});

test('explicit ranges handle alternative months, year rollover, and month parts', () => {
  const monthCases = [
    ['10〜11月に羽化し、成虫で越冬して翌年4〜5月頃まで見られる。', [1, 2, 3, 4, 5, 10, 11, 12]],
    ['9月下旬〜越冬後の翌年5月', [1, 2, 3, 4, 5, 9, 10, 11, 12]],
    ['11月羽化〜暖地では翌年2月', [1, 2, 11, 12]],
    ['成虫は8月下旬よりあらわれ、10月まで見られる。', [8, 9, 10]],
    ['2月～翌1月', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    ['8月から10月にかけて', [8, 9, 10]],
    ['年2化．6～9月に出現する。', [6, 7, 8, 9]],
  ];
  for (const [text, months] of monthCases) {
    assert.deepEqual(parseEmergenceTime(text).months, months, text);
  }
  const partCases = [
    ['１１月下旬から翌年１月中旬まで', [1.1, 1.2, 11.3, 12.1, 12.2, 12.3]],
    ['十一月下旬〜翌一月上旬', [1.1, 11.3, 12.1, 12.2, 12.3]],
    ['5月上旬から5月中旬まで、8月中旬にも見られる。', [5.1, 5.2, 8.2]],
    ['5月末～6月初旬', [5.3, 6.1]],
    ['8月中下旬から9月上旬', [8.2, 8.3, 9.1]],
    ['5月中～下旬', [5.2, 5.3]],
  ];
  for (const [text, periods] of partCases) {
    assert.deepEqual(parseEmergenceTime(text).periods, periods, text);
  }
});

test('periods remain separate across localities and independent observations', () => {
  const cases = [
    ['平地では4月から6月まで、山地では8月から10月までに見られる。', [4, 5, 6, 8, 9, 10]],
    ['平地では4月から発生し、山地では7月まで見られる。', [4, 7]],
    ['11月に羽化し、越冬個体は翌年3月にも得られる', [3, 11]],
    ['5〜6月と8〜9月', [5, 6, 8, 9]],
    ['6月から9月頃まで見られるが、周年経過は不明', [6, 7, 8, 9]],
    ['4月、10月（周年発生の可能性あり）', [4, 10]],
    ['5月〜7月には見られない', []],
    ['1月〜13月', []],
    ['5月下旬〜5月上旬', []],
    ['11月羽化〜未解決の区切り翌年3月', []],
  ];
  for (const [text, months] of cases) {
    assert.deepEqual(parseEmergenceTime(text).months, months, text);
  }
});

test('lists with a shared month unit retain every month in the chart and filter', () => {
  const cases = [
    ['6、7月', [6, 7]],
    ['6，9，12月', [6, 9, 12]],
    ['石垣島で4、5月に、西表島では12月', [4, 5, 12]],
    ['沖縄島で7-8、10、12月', [7, 8, 10, 12]],
    ['5・7〜9月', [5, 7, 8, 9]],
    ['6、7月には見られない', []],
  ];
  for (const [text, months] of cases) {
    assert.deepEqual(getEmergenceMonths(text), months, text);
    assert.deepEqual(parseInsectDetailSeason([text]).months, months, text);
  }
});

test('specific peak days do not extend the reported adult season', () => {
  const cases = [
    ['関東地方では11月中旬から12月上旬。ピークは11月20日前後。', [11.2, 11.3, 12.1]],
    ['平地では12月中旬〜1月下旬。ピークは12月20日過ぎ。', [1.1, 1.2, 1.3, 12.2, 12.3]],
    ['ピークは2月10日前後、山地では3月中旬〜4月上旬。', [3.2, 3.3, 4.1]],
  ];
  for (const [text, periods] of cases) {
    assert.deepEqual(parseInsectDetailSeason([text]).periods, periods, text);
  }
});
