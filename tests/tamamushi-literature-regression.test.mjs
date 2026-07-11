import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const SOURCE = '日本産タマムシ大図鑑';
const PDF_SHA256 = '7893e51f670e7a42e6d3df3bb5b224f7ef547112e6e7cdb1954b1f254a673415';
const AUDIT_SHA256 = 'eed4c28862703b48c0f28fb8f5e21a11f3c037e4a86c0f69185d9aea3d19ef9a';

const readCsv = (relativePath) => Papa.parse(
  fs.readFileSync(path.join(ROOT, relativePath), 'utf-8'),
  { header: true, skipEmptyLines: true },
).data;

const hosts = readCsv('normalized_data/hostplants.csv');
const notes = readCsv('normalized_data/general_notes.csv');
const sourceHosts = hosts.filter((row) => row.reference === SOURCE);
const sourceNotes = notes.filter((row) => row.reference === SOURCE);

test('Tamamushi audit ledgers keep complete page, unknown-host and scope decisions', () => {
  const integrity = readCsv('data/source_audits/japanese-jewel-beetles-grand-atlas-integrity-2026-07-11.csv');
  const pages = readCsv('data/source_audits/japanese-jewel-beetles-grand-atlas-pages-2026-07-11.csv');
  const unknown = readCsv('data/source_audits/japanese-jewel-beetles-grand-atlas-host-unknown-2026-07-11.csv');
  const scope = readCsv('data/source_audits/japanese-jewel-beetles-grand-atlas-source-scope-2026-07-11.csv');
  const misassigned = readCsv('data/source_audits/japanese-jewel-beetles-grand-atlas-species10007-misassignment-2026-07-11.csv');
  const duplicateNotes = readCsv('data/source_audits/japanese-jewel-beetles-grand-atlas-duplicate-notes-2026-07-11.csv');

  assert.equal(integrity.length, 129);
  assert.equal(new Set(integrity.map((row) => row.audit_id)).size, integrity.length);
  assert.ok(integrity.every((row) => row.source_pdf_sha256 === PDF_SHA256));
  assert.ok(integrity.every((row) => row.pdf_page && row.printed_page));
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync(path.join(
      ROOT,
      'data/source_audits/japanese-jewel-beetles-grand-atlas-integrity-2026-07-11.csv',
    ))).digest('hex'),
    AUDIT_SHA256,
  );
  assert.equal(integrity.filter((row) => row.action === 'replace_note_content').length, 65);
  assert.equal(pages.length, 211);
  assert.equal(unknown.length, 50);
  assert.deepEqual(
    unknown.filter((row) => row.confirmed_additional_host_candidate === 'YES').map((row) => row.insect_id),
    ['species-10116', 'species-21767', 'species-21813'],
  );
  assert.equal(scope.length, 34);
  assert.equal(scope.filter((row) => row.classification === 'species-level shared').length, 32);
  assert.equal(scope.filter((row) => row.classification === 'locality-identifiable subspecies').length, 2);
  assert.equal(scope.filter((row) => row.target_row_status === 'target_rows_absent_fail_closed').length, 23);
  assert.equal(misassigned.length, 69);
  assert.equal(duplicateNotes.length, 12);
});

test('all five previously missing numbered accounts and the supplementary account are represented', () => {
  const expectedEcologyTaxa = [
    'species-10064',
    'species-10116',
    'species-21744',
    'species-21767',
    'species-21811',
    'species-21812',
    'species-10077',
  ];
  // 222原典アカウントに加え、種レベルの記述を原本確認済みの2亜種へ共有する。
  assert.equal(new Set(sourceNotes.map((row) => row.insect_id)).size, 224);
  for (const insectId of expectedEcologyTaxa) {
    assert.equal(sourceNotes.some((row) => (
      row.insect_id === insectId && row.note_type === '生態情報'
    )), true, insectId);
  }

  for (const insectId of ['species-21811', 'species-21812']) {
    assert.deepEqual(
      sourceHosts.filter((row) => row.insect_id === insectId).map((row) => row.plant_name),
      ['オオイタビ', 'イチジク', 'イヌビワ', 'イタビカズラ'],
    );
  }
  for (const [insectId, plantName] of [
    ['species-10116', 'リュウキュウエノキ'],
    ['species-21767', 'ヤチダモ'],
  ]) {
    const row = sourceHosts.find((item) => (
      item.insect_id === insectId && item.plant_name === plantName
    ));
    assert.equal(row.observation_type, '採集植物');
    assert.equal(row.life_stage, '成虫');
  }
});

test('species-10007 retains only the eight source hosts and its own ecology account', () => {
  const rows = sourceHosts.filter((row) => row.insect_id === 'species-10007');
  assert.deepEqual(rows.map((row) => row.record_id), [
    'hostplant-004450',
    'hostplant-004451',
    'hostplant-004452',
    'hostplant-004453',
    'hostplant-004454',
    'hostplant-004455',
    'hostplant-004456',
    'hostplant-004457',
  ]);
  assert.deepEqual(rows.map((row) => row.plant_name), [
    'エノキ',
    'リュウキュウエノキ',
    'ケヤキ',
    'サクラ類',
    'カシ類',
    'カキ',
    'クワ',
    'ハリエンジュ',
  ]);
  assert.equal(rows.at(-1).plant_family, 'マメ科');
  assert.equal(sourceHosts.some((row) => row.insect_id === 'species-10007' && row.record_id.startsWith('hostplant-909')), false);

  const tamamushiEcology = sourceNotes.filter((row) => (
    row.insect_id === 'species-10007' && row.note_type === '生態情報'
  ));
  assert.equal(tamamushiEcology.length, 1);
  assert.equal(
    tamamushiEcology[0].content,
    '南東北地方以南に産し、6〜8月にエノキ、ケヤキ、サクラ類などの林木の太めの枯れ枝に集まる。',
  );
  const ishiharai = sourceNotes.find((row) => row.content.includes('原産地は広島県道後山'));
  assert.equal(ishiharai.insect_id, 'species-10072');
  assert.equal(
    ishiharai.content,
    '6〜7月に現れるが産地は非常に局所的。ヤマボウシの衰弱木を食害し、その生葉や花を後食する。原産地は広島県道後山。近年は本州の各地からも記録されるようになった（北限は岩手県）。',
  );
  assert.doesNotMatch(ishiharai.content, /移動した可能性|献名/);
});

test('species-10119 source hosts are exactly タブノキ・シデ類・カシ類', () => {
  const rows = sourceHosts.filter((row) => row.insect_id === 'species-10119');
  assert.deepEqual(rows.map((row) => row.record_id), [
    'hostplant-004658',
    'hostplant-004659',
    'hostplant-004660',
  ]);
  assert.deepEqual(rows.map((row) => row.plant_name), ['タブノキ', 'シデ類', 'カシ類']);
  assert.equal(rows[1].plant_family, 'カバノキ科');
  assert.equal(hosts.some((row) => ['hostplant-909197', 'hostplant-909198'].includes(row.record_id)), false);
});

test('adult feeding and collection relations stay distinct from larval hosts', () => {
  const beech = hosts.find((row) => row.record_id === 'hostplant-004509');
  assert.equal(beech.observation_type, '後食');
  assert.equal(beech.life_stage, '成虫');

  const collection = hosts.find((row) => row.record_id === 'hostplant-004721');
  assert.equal(collection.observation_type, '採集植物');
  assert.equal(collection.life_stage, '成虫');

  const feeding = hosts.find((row) => row.record_id === 'hostplant-tamamushi-21813-taiwan-uokusa');
  assert.deepEqual(feeding, {
    record_id: 'hostplant-tamamushi-21813-taiwan-uokusa',
    insect_id: 'species-21813',
    plant_name: 'タイワンウオクサギ',
    plant_family: 'シソ科',
    observation_type: '後食',
    plant_part: '葉',
    life_stage: '成虫',
    reference: SOURCE,
    notes: '幼虫寄主ではなく成虫の後食記録',
  });
  const ecology = sourceNotes.find((row) => row.insect_id === 'species-21813' && row.note_type === '生態情報');
  assert.match(ecology.content, /成虫はクサギ属のタイワンウオクサギの生葉を後食する/);
  assert.doesNotMatch(ecology.content, /幼虫は.*後食/);
});

test('twelve short note subsets are removed and source corrections remain', () => {
  const duplicateTaxa = [
    'species-10009', 'species-10016', 'species-10045', 'species-10070',
    'species-10090', 'species-10096', 'species-10100', 'species-10102',
    'species-10105', 'species-10109', 'species-10125', 'species-10138',
  ];
  for (const insectId of duplicateTaxa) {
    assert.equal(sourceNotes.filter((row) => (
      row.insect_id === insectId && row.note_type === '生態情報'
    )).length, 1, insectId);
    assert.equal(sourceNotes.filter((row) => (
      row.insect_id === insectId && row.note_type === '出現時期'
    )).length, 1, insectId);
  }

  const ecologyText = sourceNotes
    .filter((row) => row.note_type === '生態情報')
    .map((row) => row.content)
    .join('\n');
  for (const fragment of [
    '葉虫として葉に潜り込み',
    '特に後半は',
    '護摩増山',
    '静岡県型岳',
    'コウゾの無名に由来',
    '枝先を揃って採集',
    '河原の議木ヤナギ類',
    'アアクヤシマシャリンパイ',
    '伐水',
    '4枚型',
    '日本産本属中の最美種',
    '北会津（愛山地）',
    '七飯町水薬沼',
    'ヤマハンノキの精',
    'クズノハカエデの生木',
    '新草あるいは刈り込んだ後の草木',
    '不思議な分布',
    '3月末〜7月に現れる',
  ]) {
    assert.equal(ecologyText.includes(fragment), false, fragment);
  }
  assert.match(ecologyText, /潜葉虫として生葉に潜り込み/);
  assert.match(ecologyText, /特に雌はヒメコマツ/);
  assert.match(ecologyText, /護摩壇山/);
  assert.match(ecologyText, /静岡県聖岳/);
  assert.match(ecologyText, /コウゾの属名に由来/);
  assert.match(ecologyText, /枝先を掬って採集/);
  assert.match(ecologyText, /河原の灌木ヤナギ類の生葉/);
  const nipponigena = sourceNotes.find((row) => (
    row.insect_id === 'species-10096' && row.note_type === '生態情報'
  ));
  assert.equal(
    nipponigena.content,
    '平野部から山間部に現れ、カキ類を食害する。河原の灌木ヤナギ類の生葉から採集される個体は全体にやや光沢が強く、前胸背板の側縁は金緑赤色を帯びる。',
  );
  assert.doesNotMatch(nipponigena.content, /異名同種|疑問が残る|考えられ/);
  assert.match(ecologyText, /5〜6月にクズの葉上/);
  assert.match(ecologyText, /アデクやシマシャリンバイ/);
  assert.match(ecologyText, /群馬県武尊山/);
  assert.match(ecologyText, /福島県北会津（飯豊山麓）/);
  assert.match(ecologyText, /北海道七飯町蓴菜沼/);
  assert.match(ecologyText, /新葉あるいは刈り込んだ後の再生葉/);
  assert.match(ecologyText, /5月末〜7月に現れる/);
  assert.doesNotMatch(ecologyText, /可能性|考えられ|推察され/);
  assert.doesNotMatch(ecologyText, /献名/);
  assert.doesNotMatch(ecologyText, /異名同種|独立種として扱/);

  assert.match(ecologyText, /東日本では非常に稀/);
  assert.match(ecologyText, /北海道幌加で7月に採集された1個体が知られるだけ/);
  assert.match(ecologyText, /個体変異が大きい/);

  assert.equal(hosts.some((row) => row.record_id === 'hostplant-004459'), false);
  assert.equal(hosts.some((row) => row.record_id === 'hostplant-909194'), false);
});
