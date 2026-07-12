import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import Papa from 'papaparse';

import { loadButterflyMergedTaxonRedirects } from '../scripts/lib/mergedTaxonRedirects.mjs';

const AUDIT_PATH = 'data/source_audits/butterfly-canonical-taxonomy-merge-2026-07-12.json';
const CANONICAL_ID = 'species-20432';
const DUPLICATE_ID = 'species-20436';

const readCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8'), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });
  assert.deepEqual(parsed.errors, []);
  return parsed.data;
};

test('イチモンジセセリは正準IDだけをデータ表に保持する', () => {
  for (const base of ['normalized_data', 'public']) {
    const insects = readCsv(`${base}/insects.csv`);
    const hostplants = readCsv(`${base}/hostplants.csv`);
    const notes = readCsv(`${base}/general_notes.csv`);
    const canonical = insects.find(({ insect_id }) => insect_id === CANONICAL_ID);

    assert.ok(canonical);
    assert.equal(canonical.japanese_name, 'イチモンジセセリ');
    assert.equal(canonical.scientific_name, 'Parnara guttata Bremer et Grey, 1852');
    assert.equal(insects.some(({ insect_id }) => insect_id === DUPLICATE_ID), false);
    assert.equal(hostplants.some(({ insect_id }) => insect_id === DUPLICATE_ID), false);
    assert.equal(notes.some(({ insect_id }) => insect_id === DUPLICATE_ID), false);
    assert.equal(
      hostplants.some(({ insect_id, plant_name }) => insect_id === CANONICAL_ID && plant_name === 'マコモ'),
      false,
    );
  }
});

test('旧IDは正準IDへのtaxonomy mergeとして保持する', () => {
  const redirects = loadButterflyMergedTaxonRedirects(AUDIT_PATH);
  assert.equal(redirects.length, 1);
  assert.deepEqual(
    {
      duplicateId: redirects[0].duplicateId,
      canonicalId: redirects[0].canonicalId,
      taxonGroup: redirects[0].taxonGroup,
      legacyScientificName: redirects[0].legacyScientificName,
      skipEnglishScientificRedirect: redirects[0].skipEnglishScientificRedirect,
    },
    {
      duplicateId: DUPLICATE_ID,
      canonicalId: CANONICAL_ID,
      taxonGroup: 'butterfly',
      legacyScientificName: 'Parnara guttata Bremer et Grey, 1852',
      skipEnglishScientificRedirect: true,
    },
  );
});

test('正規化昆虫表に同一和名・同一学名の重複IDを残さない', () => {
  const insects = readCsv('normalized_data/insects.csv');
  const seen = new Map();
  for (const row of insects) {
    const japaneseName = String(row.japanese_name || '').trim();
    const scientificName = String(row.scientific_name || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (!japaneseName || !scientificName) continue;
    const key = `${japaneseName}__${scientificName}`;
    assert.equal(seen.has(key), false, `${key}: ${seen.get(key)} / ${row.insect_id}`);
    seen.set(key, row.insect_id);
  }
});
