import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { normalizeCsvLineEndings } from '../src/utils/csvText.js';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const csvPaths = ['normalized_data/insects.csv', 'public/insects.csv'];

const expectedLamiini = new Map([
  ['species-22770', 'オオスミヒゲナガカミキリ'],
  ['species-22771', 'ヨコヤマヒゲナガカミキリ'],
  ['species-22773', 'ホシベニカミキリ'],
  ['species-22774', 'エゾカミキリ'],
]);

test('insects CSV parses every mixed-source row independently', () => {
  for (const csvPath of csvPaths) {
    const raw = fs.readFileSync(path.join(ROOT, csvPath), 'utf8');
    const parsed = Papa.parse(raw, { header: true, skipEmptyLines: true });

    assert.deepEqual(parsed.errors, [], `${csvPath} should parse without joined rows`);
    assert.equal(parsed.data.length, 9738, `${csvPath} should keep every insect row`);

    const byId = new Map(parsed.data.map((row) => [row.insect_id, row]));
    for (const [insectId, japaneseName] of expectedLamiini) {
      assert.equal(byId.get(insectId)?.japanese_name, japaneseName, `${csvPath}: ${insectId}`);
      assert.equal(byId.get(insectId)?.__parsed_extra, undefined, `${csvPath}: ${insectId} should not absorb adjacent rows`);
    }
    assert.equal(byId.get('species-22772')?.scientific_name, 'Monochamus yokoyamai Gressitt, 1937');
  }
});

test('CSV line-ending normalizer prevents Papa Parse row joining', () => {
  const mixed = 'id,name\r\n1,alpha\n2,beta\r\n';
  const parsed = Papa.parse(normalizeCsvLineEndings(mixed), { header: true, skipEmptyLines: true });

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.data, [
    { id: '1', name: 'alpha' },
    { id: '2', name: 'beta' },
  ]);
});
