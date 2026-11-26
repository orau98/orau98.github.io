import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Papa from 'papaparse';
import { normalizeHostRecord } from '../src/utils/hostRecord.js';
import { projectInsectNotes } from '../src/utils/insectNoteRevisions.js';
import { getCompactReferenceMeta } from '../src/utils/sourceLinks.js';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
const csv = read('../normalized_data/hostplants.csv');
const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });
const records = new Map(parsed.data.map((row) => [row.record_id, row]));
const verification = JSON.parse(read('../data/source_audits/host-record-recovery-2026-11-26.json'));
const followup = JSON.parse(read('../data/source_audits/host-record-followup.json'));

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

test('再確認した寄主記録と掲載頁を保持する', () => {
  for (const { recordId, reference } of followup.additions) {
    assert.equal(records.get(recordId)?.reference, reference, recordId);
    const citation = getCompactReferenceMeta(reference);
    assert.ok(citation.link, reference);
    if (/\bpp?\.\s+\d/.test(reference)) assert.match(citation.location, /\d/);
  }
});

test('宮古島の枯れ葉食とリュウキュウハマキの同定根拠を区別する', () => {
  const reared = normalizeHostRecord(records.get('host-recheck-1837-shimaguwa'));
  const pupalId = normalizeHostRecord(records.get('host-recheck-1837-adan'));
  assert.equal(reared.resourceType, 'substrate');
  assert.equal(pupalId.resourceType, 'substrate');
  assert.match(reared.notes, /1頭が羽化/);
  assert.match(pupalId.notes, /羽化せず、蛹の形態/);
});

test('分類改訂で別種や別亜種とされた寄主を移さない', () => {
  const spruce = normalizeHostRecord(records.get('host-recheck-0985-picea'));
  assert.equal(spruce.name, 'ドイツトウヒ');
  assert.equal(spruce.observationType, '国外');
  assert.equal(records.get('host-recheck-21943-tabunoki')?.insect_id, 'species-21943');
  assert.equal(records.get('host-recheck-21943-sharinbai')?.insect_id, 'species-21943');
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

test('ウスイロアツバの削除された食樹を植物名として復元する', () => {
  const record = normalizeHostRecord(records.get('host-nov26-source-5293-momi'));
  assert.equal(record.name, 'モミ');
  assert.equal(record.lifeStage, '幼虫');
  assert.equal(record.plantPart, '葉');
  assert.equal(record.observationType, '文献');
  assert.equal(getCompactReferenceMeta(record.reference).location, 'p. 229');
});

test('図鑑の隣り合う欄の寄主を別種へ移さない', () => {
  const hosts = (insectId) => parsed.data
    .filter((row) => row.insect_id === insectId)
    .map(normalizeHostRecord)
    .filter((row) => !row.isFlowerVisit);
  assert.ok(!hosts('species-3868').some((record) => record.name === 'コメツガ'));
  assert.deepEqual(hosts('species-3869').map((record) => record.name), ['コメツガ']);
  const notes = Papa.parse(read('../normalized_data/general_notes.csv'), { header: true, skipEmptyLines: true });
  const original = notes.data.find((row) => row.record_id === 'note-1001649');
  assert.equal(original.content, '幼虫で越冬する。成虫は灯火に飛来し、昼間にも花を訪れて吸蜜する。');
  assert.match(projectInsectNotes([original])[0].content, /針葉樹を含む幅広い植物/);
  const habitat = notes.data.find((row) => row.record_id === 'note-nov26-source-0265-dead-cycas');
  assert.equal(habitat.note_type, '生態情報');
  assert.equal(getCompactReferenceMeta(habitat.reference).location, 'p. 124');
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
