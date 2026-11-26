import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Papa from 'papaparse';
import { normalizeHostRecord } from '../src/utils/hostRecord.js';
import { getCompactReferenceMeta } from '../src/utils/sourceLinks.js';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const csv = read('../normalized_data/hostplants.csv');
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
const records = new Map(parsed.data.map((row) => [row.record_id, row]));
const verification = JSON.parse(read('../data/source_audits/host-record-recovery-2026-11-26.json'));

test('原典で再確認した食草データと公開CSVが一致する', () => {
  assert.deepEqual(parsed.errors, []);
  assert.equal(read('../public/hostplants.csv'), csv);
  for (const item of verification.records) {
    if (item.after === null) {
      assert.equal(records.has(item.recordId), false, item.recordId);
      continue;
    }
    const fields = Papa.parse(item.after).data[0];
    assert.deepEqual(records.get(item.recordId), Object.fromEntries(
      parsed.meta.fields.map((field, index) => [field, fields[index]]),
    ), item.recordId);
  }
});

test('チャマダラキリガの文献上の食樹と成虫の訪花を区別する', () => {
  const plantUse = parsed.data
    .filter((row) => row.insect_id === 'species-6041')
    .map(normalizeHostRecord);
  const visits = plantUse.filter((record) => record.isFlowerVisit);
  const feeds = plantUse.filter((record) => !record.isFlowerVisit);
  assert.deepEqual(feeds.map((record) => record.name).sort(), ['アカガシ', 'アラカシ']);
  assert.equal(visits.length, 5);
  for (const host of feeds) {
    assert.equal(host.observationType, '文献');
    assert.equal(host.lifeStage, '');
    assert.equal(host.plantPart, '');
    assert.match(host.notes, /発育段階・摂食部位・観察条件は未記載/);
    assert.match(host.notes, /Sohnほか（2005）は寄主植物を不明と記載/);
    const citation = getCompactReferenceMeta(host.reference);
    assert.equal(citation.location, 'p. 40');
    assert.match(citation.link, /Vol29_1\/kiberihamushi_29_1_34-49\.pdf#page=7$/);
  }
});

test('文献に記載された飼育と野外での食害を元の観察条件で保存する', () => {
  const reared = normalizeHostRecord(records.get('host-nov26-source-6025-hannoki-reared'));
  assert.equal(reared.observationType, '飼育');
  assert.equal(reared.plantPart, '');
  assert.match(getCompactReferenceMeta(reared.reference).link, /\.pdf#page=5$/);

  const flowerFeeder = normalizeHostRecord(records.get('host-nov26-source-6046-tsubaki-oshima'));
  assert.equal(flowerFeeder.lifeStage, '幼虫');
  assert.equal(flowerFeeder.plantPart, '花');
  assert.equal(flowerFeeder.isFlowerVisit, false);
  assert.match(getCompactReferenceMeta(flowerFeeder.reference).link, /5830\.pdf#page=1$/);
});

test('カラマツイトヒキハマキの正しい学名に原典の寄主を結び付ける', () => {
  const insectCsv = read('../normalized_data/insects.csv');
  assert.equal(read('../public/insects.csv'), insectCsv);
  const insects = Papa.parse(insectCsv, { header: true, skipEmptyLines: true });
  assert.deepEqual(insects.errors, []);
  const moth = insects.data.find((row) => row.japanese_name === 'カラマツイトヒキハマキ');
  assert.equal(moth.insect_id, 'species-1816');
  assert.equal(moth.scientific_name, 'Ptycholomoides aeriferana (Herrich-Schäffer, 1851)');
  const plants = parsed.data.filter((row) => row.insect_id === moth.insect_id);
  assert.deepEqual(plants.map((row) => row.plant_name).sort(), ['カラマツ', 'グイマツ']);
});

test('ワタムシの寄主を標本の同定・部位に基づいて表示する', () => {
  const hosts = parsed.data.filter((row) => row.insect_id === 'species-21047').map(normalizeHostRecord);
  assert.deepEqual(hosts.map(({ name, plantPart, lifeStage }) => [name, plantPart, lifeStage]), [
    ['ハルニレ', '葉', ''],
    ['キンミズヒキ', '根', '成虫'],
  ]);
  const citation = getCompactReferenceMeta(hosts[1].reference);
  assert.equal(citation.location, 'p. 52');
  assert.match(citation.link, /\/9821\/27_p37-106\.pdf$/);
  assert.ok(!parsed.data.some((row) => row.insect_id === 'species-23149' && row.plant_family === 'ニレ科'));
  const notes = read('../normalized_data/general_notes.csv');
  assert.equal(read('../public/general_notes.csv'), notes);
  assert.match(notes, /note-aphid-guide-a231-species-21047-ecology[^\r\n]+同図鑑では夏寄主を不明としている/);
});
