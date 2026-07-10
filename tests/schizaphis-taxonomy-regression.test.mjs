import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const parseCsv = (relativePath) => {
  const csv = fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
  return Papa.parse(csv.replace(/\r\n/g, '\n').replace(/\r/g, '\n'), {
    header: true,
    skipEmptyLines: true,
  }).data;
};

test('Schizaphis acori and S. rotundiventris remain distinct taxa', () => {
  for (const csvPath of ['normalized_data/insects.csv', 'public/insects.csv']) {
    const rows = parseCsv(csvPath);
    const acori = rows.find((row) => row.insect_id === 'species-21313');
    const rotundiventris = rows.find((row) => row.insect_id === 'species-21323');

    assert.ok(acori, `${csvPath} should contain species-21313`);
    assert.ok(rotundiventris, `${csvPath} should contain species-21323`);
    assert.equal(acori.subgenus, 'Paraschizaphis');
    assert.equal(acori.japanese_name, 'ショウブアブラムシ');
    assert.equal(acori.alternative_name, 'ショウブノハアブラムシ');
    assert.match(acori.synonyms, /Toxoptera acori Shinji, 1922/);
    assert.match(acori.notes, /別種/);

    assert.equal(rotundiventris.subgenus, 'Schizaphis');
    assert.equal(rotundiventris.subfamily_jp, 'アブラムシ亜科');
    assert.equal(rotundiventris.japanese_name, 'ニセナシアブラムシ');
    assert.match(rotundiventris.synonyms, /Aphis acori Theobald, 1923/);
    assert.match(rotundiventris.synonyms, /Toxoptera cyperi van der Goot, 1917/);
    assert.doesNotMatch(rotundiventris.synonyms, /Toxoptera acori Shinji, 1922/);
    assert.match(rotundiventris.notes, /Toxoptera acori Shinji, 1922/);
    assert.notEqual(acori.scientific_name, rotundiventris.scientific_name);
  }
});

test('confirmed host records follow the resolved Schizaphis taxonomy', () => {
  for (const csvPath of ['normalized_data/hostplants.csv', 'public/hostplants.csv']) {
    const rows = parseCsv(csvPath);
    const acoriRows = rows.filter((row) => row.insect_id === 'species-21313');
    const modernAcori = acoriRows.find((row) => row.reference === '松本嘉幸 (2005)');

    assert.ok(modernAcori, `${csvPath} should cite the Akasaka Imperial Gardens record`);
    assert.equal(modernAcori.plant_name, 'ショウブ');
    assert.equal(modernAcori.plant_family, 'ショウブ科');
    assert.equal(modernAcori.plant_part, '葉身');
    assert.equal(acoriRows.some((row) => row.plant_name === 'オニガヤツリ'), false);
    assert.equal(acoriRows.some((row) => row.plant_name === 'ガマ'), false);

    const atlasRotundiventris = new Set(rows
      .filter((row) => row.insect_id === 'species-21323' && row.reference === '日本原色アブラムシ図鑑')
      .map((row) => row.plant_name));
    assert.deepEqual(atlasRotundiventris, new Set(['ショウブ', 'オニガヤツリ', 'ガマ']));

    const shobuFamilies = new Set(rows
      .filter((row) => row.plant_name === 'ショウブ')
      .map((row) => row.plant_family));
    assert.deepEqual(shobuFamilies, new Set(['ショウブ科']));
  }
});
