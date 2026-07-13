import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlantMetaTargetResolver,
  hasNoindexRobotsMeta,
} from '../scripts/lib/metaPageLinks.mjs';

test('robots noindex detection is token-based and attribute-order independent', () => {
  assert.equal(
    hasNoindexRobotsMeta('<meta content="index, follow" name="robots">'),
    false,
  );
  assert.equal(
    hasNoindexRobotsMeta('<meta content="noindex, follow" name="robots">'),
    true,
  );
  assert.equal(
    hasNoindexRobotsMeta('<meta name="robots" content="index, nofollow">'),
    false,
  );
});

test('plant meta resolver uses generated direct names and exact scientific-name matches', () => {
  const resolveTarget = createPlantMetaTargetResolver({
    pageNames: ['ミブヨモギ', 'バッコヤナギ', 'ヨモギ'],
    plantDetails: {
      ミブヨモギ: { scientificName: 'Artemisia maritima' },
      バッコヤナギ: { scientificName: 'Salix caprea' },
      ヨモギ: { scientificName: 'Artemisia indica' },
    },
  });

  assert.equal(resolveTarget('ヨモギ'), 'ヨモギ');
  assert.equal(resolveTarget('  Artemisia   maritima  '), 'ミブヨモギ');
  assert.equal(resolveTarget('salix CAPREA'), 'バッコヤナギ');
  assert.equal(resolveTarget('Artemisia'), '');
  assert.equal(resolveTarget('Artemisia maritima L.'), '');
});

test('plant meta resolver rejects unavailable and ambiguous scientific-name targets', () => {
  const resolveTarget = createPlantMetaTargetResolver({
    pageNames: ['正本A', '正本B'],
    plantDetails: {
      正本A: { scientificName: 'Duplicata plantus' },
      正本B: { scientificName: 'Duplicata plantus' },
      未生成: { scientificName: 'Missing plantus' },
    },
  });

  assert.equal(resolveTarget('Duplicata plantus'), '');
  assert.equal(resolveTarget('Missing plantus'), '');
});
