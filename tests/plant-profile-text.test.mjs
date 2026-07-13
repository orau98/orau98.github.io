import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSourceLabel,
  normalizePlantProfileText,
} from '../src/utils/plantProfileText.js';

test('normalizePlantProfileText removes OCR spaces inside Japanese words', () => {
  assert.equal(
    normalizePlantProfileText('本州（宮 城県・新潟県以南）・四 国・九州'),
    '本州（宮城県・新潟県以南）・四国・九州',
  );
  assert.equal(
    normalizePlantProfileText('本 州 中 部， 山 地に生える。'),
    '本州中部、山地に生える。',
  );
  assert.equal(
    normalizePlantProfileText('本州・ 四国・ 九州に分布'),
    '本州・四国・九州に分布',
  );
  assert.equal(
    normalizePlantProfileText('葉は長さ3 ー 8 cm（ 山地 ）'),
    '葉は長さ3～8 cm（山地）',
  );
});

test('buildSourceLabel prefers the printed book page and labels PDF-page fallbacks', () => {
  assert.equal(
    buildSourceLabel({ source: '日本の野生植物 第1巻', page: '111', printedPage: '220' }),
    '日本の野生植物 第1巻 p.220',
  );
  assert.equal(
    buildSourceLabel({ source: '日本の野生植物 第1巻', page: '111' }),
    '日本の野生植物 第1巻 PDF p.111',
  );
  assert.equal(
    buildSourceLabel({ source: '日本の野生植物 第1巻', page: '150;151', printedPage: '299;300' }),
    '日本の野生植物 第1巻 p.299・300',
  );
  assert.equal(
    buildSourceLabel({ source: '日本の野生植物 第1巻', page: '150;151', printedPage: '300' }),
    '日本の野生植物 第1巻 p.300 / PDF p.150',
  );
  assert.equal(
    buildSourceLabel({ source: '日本の野生植物 第1巻', page: '32', printedPage: '62;63' }),
    '日本の野生植物 第1巻 p.62・63',
  );
});
