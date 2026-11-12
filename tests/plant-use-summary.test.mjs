import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlantUseSummary } from '../src/utils/plantUseSummary.js';

const options = {
  usageLabelOf: (record) => [record.lifeStage, record.plantPart].filter(Boolean).join('・'),
  observationOf: (group) => {
    const type = group.records[0].observationType || '';
    return { key: type || '未記載', label: type || '未記載', stated: Boolean(type), priority: type ? 1 : 6 };
  },
  notesOf: () => [],
};
const record = (overrides = {}) => ({ lifeStage: '幼虫', plantPart: '', observationType: '', reference: '日本産蝶類標準図鑑', ...overrides });

test('全件に共通する利用・記録の種類・出典は1回にまとめる（アゲハのような例）', () => {
  const summary = buildPlantUseSummary([
    { name: 'カラタチ', family: 'ミカン科', records: [record()] },
    { name: 'サンショウ', family: 'ミカン科', records: [record()] },
    { name: 'クスノキ', family: 'クスノキ科', records: [record()] },
  ], options);
  assert.equal(summary.commonUsage, '幼虫');
  assert.equal(summary.commonObservation.label, '未記載');
  assert.deepEqual(summary.commonReferences, ['日本産蝶類標準図鑑']);
  assert.deepEqual(summary.referenceOrder, []);
  // 植物の多い科から並べる
  assert.deepEqual(summary.families.map((f) => [f.key, f.items.map((i) => i.name)]), [
    ['ミカン科', ['カラタチ', 'サンショウ']],
    ['クスノキ科', ['クスノキ']],
  ]);
  assert.equal(summary.familyCount, 2);
});

test('出典が植物ごとに違うときは番号を振って最後にまとめる', () => {
  const summary = buildPlantUseSummary([
    { name: 'クヌギ', family: 'ブナ科', records: [record({ reference: '文献A' })] },
    { name: 'コナラ', family: 'ブナ科', records: [record({ reference: '文献A;文献B' })] },
  ], options);
  assert.equal(summary.commonReferences, null);
  assert.deepEqual(summary.referenceOrder, ['文献A', '文献B']);
  assert.deepEqual(summary.items.map((i) => i.referenceNumbers), [[1], [1, 2]]);
});

test('科そのものの記録は科の見出しで表し、科の分からない植物は最後に回す', () => {
  const summary = buildPlantUseSummary([
    { name: '不明', family: '', records: [record()] },
    { name: 'カバノキ科', family: '', records: [record({ observationType: '文献' })] },
    { name: 'ハンノキ', family: 'カバノキ科', records: [record({ observationType: '文献' })] },
  ], options);
  assert.equal(summary.commonObservation, null);
  assert.deepEqual(summary.families.map((f) => [f.key, f.hasFamilyRecord, f.items.map((i) => i.name)]), [
    ['カバノキ科', true, ['ハンノキ']],
    ['', false, ['不明']],
  ]);
});
