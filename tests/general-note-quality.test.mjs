import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalizeEcologyNoteType,
  collectGeneralNoteIssues,
  normalizeOcrLayoutWhitespace,
} from '../scripts/lib/generalNoteQuality.mjs';

test('normalizeOcrLayoutWhitespace removes OCR line-wrap gaps without collapsing Latin spacing', () => {
  assert.equal(
    normalizeOcrLayoutWhitespace('飛来のピークは19～ 20時頃。気温は5 ℃。♀ の飛来数と♂ 成虫。Sugilania 3種。'),
    '飛来のピークは19～20時頃。気温は5℃。♀の飛来数と♂成虫。Sugilania 3種。',
  );
});

test('canonicalizeEcologyNoteType replaces the legacy ecology label', () => {
  assert.equal(canonicalizeEcologyNoteType('生態'), '生態情報');
  assert.equal(canonicalizeEcologyNoteType('出現時期'), '出現時期');
});

test('collectGeneralNoteIssues rejects subjective prose and source-column bleed', () => {
  const issues = collectGeneralNoteIssues({
    note_type: '生態',
    content: '幸福感に包まれる。日本固有種にふさわしい美しさである。分布図 --- ページ 3 ---',
    page: '',
  });
  assert.ok(issues.includes('subjective_aesthetic'));
  assert.ok(issues.includes('subjective_emotion'));
  assert.ok(issues.includes('page_or_column_bleed'));
  assert.ok(issues.includes('legacy_note_type'));
});
