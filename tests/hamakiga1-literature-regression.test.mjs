import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

import { collectGeneralNoteIssues } from '../scripts/lib/generalNoteQuality.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const SOURCE = '日本のハマキガ1';
const PDF_SHA256 = '78f75fd532ace774cff181d573c96c04052e1c65dd77a352ec520d7cd33de646';

const read = relativePath => Papa.parse(
  fs.readFileSync(path.join(ROOT, relativePath), 'utf8'),
  { header: true, skipEmptyLines: true },
).data;

test('Hamakiga1 all-account ledger covers every source account exactly once', () => {
  const rows = read('data/source_audits/japanese-tortricid-moths-1-all-accounts-2026-07-12.csv');
  assert.equal(rows.length, 216);
  assert.equal(new Set(rows.map(row => row.account_no)).size, 216);
  assert.equal(new Set(rows.map(row => row.insect_id)).size, 216);
  assert.deepEqual(
    rows.map(row => Number(row.account_no)).sort((a, b) => a - b),
    Array.from({ length: 216 }, (_, index) => index + 1),
  );
  assert.ok(rows.every(row => row.audit_version === 'hamakiga1-v1-2026-07-12'));
  assert.ok(rows.every(row => row.mapping_status === 'japanese_exact'));
  assert.ok(rows.every(row => row.source_pdf_sha256 === PDF_SHA256));
  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(rows, row => row.source_host_scope))
      .map(([scope, values]) => [scope, values.length])),
    {
      domestic_hosts_recorded: 129,
      domestic_unknown_foreign_hosts_recorded: 24,
      source_unknown: 63,
    },
  );
});

test('Hamakiga1 integrity ledger has the reviewed production action profile', () => {
  const rows = read('data/source_audits/japanese-tortricid-moths-1-integrity-2026-07-12.csv');
  assert.equal(rows.length, 80);
  assert.deepEqual(
    Object.fromEntries(Object.entries(Object.groupBy(rows, row => row.action))
      .map(([action, values]) => [action, values.length])),
    {
      add_host_relation: 52,
      delete_host_records: 2,
      replace_note_content: 19,
      delete_note: 1,
      add_note: 1,
      update_host_field: 5,
    },
  );
  assert.ok(rows.every(row => row.reference === SOURCE));
  assert.ok(rows.every(row => row.source_pdf_sha256 === PDF_SHA256));
  assert.ok(rows.every(row => row.pdf_page && row.printed_page));
  const additions = rows.filter(row => row.action === 'add_host_relation');
  assert.equal(additions.filter(row => row.notes).length, 0);
  assert.equal(additions.filter(row => row.observation_type === '野外（国外）').length, 51);
  assert.equal(additions.filter(row => row.observation_type === '野外（国内）').length, 1);
});

test('Hamakiga1 approved host corrections are present without duplicates', () => {
  const hosts = read('normalized_data/hostplants.csv');
  const sourceRows = hosts.filter(row => row.reference === SOURCE);
  assert.equal(sourceRows.length, 302);
  assert.equal(new Set(sourceRows.map(row => row.insect_id)).size, 153);
  assert.equal(sourceRows.filter(row => row.observation_type === '野外（国外）').length, 52);
  assert.equal(sourceRows.filter(row => row.record_id.startsWith('hostplant-hamakiga1-foreign-')).length, 51);

  const account33 = sourceRows.filter(row => row.insect_id === 'species-2188');
  assert.deepEqual(account33.map(row => row.plant_name).sort(), ['トウヒ属', 'モミ属']);
  assert.equal(account33.some(row => ['トウヒ', 'モミ'].includes(row.plant_name)), false);

  const account102 = sourceRows.filter(row => row.insect_id === 'species-2276');
  assert.equal(account102.length, 4);
  assert.equal(account102.filter(row => row.plant_name === 'キク').length, 1);
  assert.ok(account102.every(row => row.plant_part === '茎'));

  const account151 = sourceRows.filter(row => row.insect_id === 'species-2284');
  assert.equal(account151.find(row => row.plant_name === 'ヌルデ').observation_type, '野外（国外）');

  const account206 = sourceRows.filter(row => row.insect_id === 'species-2144');
  assert.deepEqual(
    account206.map(row => row.plant_name).sort(),
    ['イスノキ', 'スダジイ', 'ツブラジイ'],
  );
  assert.equal(
    account206.find(row => row.plant_name === 'ツブラジイ').observation_type,
    '野外（国内）',
  );

  const account54 = sourceRows.find(
    row => row.record_id === 'hostplant-hamakiga1-foreign-20260712-054-01',
  );
  assert.equal(account54.plant_name, 'カンボク');
  assert.equal(account54.plant_family, 'ガマズミ科');
});

test('Hamakiga1 emergence and ecology notes are complete and source-clean', () => {
  const notes = read('normalized_data/general_notes.csv');
  const sourceRows = notes.filter(row => row.reference === SOURCE);
  assert.equal(sourceRows.length, 363);
  assert.equal(new Set(sourceRows.map(row => row.insect_id)).size, 216);

  const account64 = sourceRows.filter(row => row.insect_id === 'species-2213');
  assert.equal(account64.find(row => row.note_type === '出現時期').content, '6-7月');
  assert.equal(account64.find(row => row.note_type === '生態情報').content, '本州では高山帯に分布');

  const account133 = sourceRows.find(
    row => row.insect_id === 'species-2096' && row.note_type === '生態情報',
  );
  assert.match(account133.content, /樹皮下の木化程度の低いところを摂食する$/);
  assert.doesNotMatch(account133.content, /樹脂を避けるためと考えられている/);
  assert.doesNotMatch(account133.content, /このような特異な習性は，寄$/);

  const approvedEcology = new Map([
    ['species-2094', '幼虫は葉に食入して中空にし，近くの葉1〜2枚を同様に食し，それらを綴り合わせる．年1化．老熟幼虫で越冬'],
    ['species-2115', '幼虫は葉の縁を折り返すか，2枚の葉を合わせる'],
    ['species-2126', '近畿地方では年3〜4化する．幼虫はモッコクの新芽や新葉を綴ったり，合わせたりする．加害を受けた葉は褐変し，後に黒く枯れる'],
    ['species-2131', '我が国では，屋久島で成虫が10月に採集されただけである'],
    ['species-2132', '年2化．幼虫ははじめカラマツ針葉に潜り，後に葉を束ねて食害し，若齢幼虫で越冬'],
    ['species-2141', '幼虫はイスノキの葉を綴る．年1化．幼虫越冬'],
    ['species-2147', '幼虫はヤマナラシの葉を重ねて綴り，中齢期までは1葉に複数個体が共存する(奥，2003)'],
    ['species-2166', '幼虫は最初，芽に潜るが，中齢以降は2〜3本の葉を綴って筒をつくる'],
    ['species-2212', '幼虫は，シマサルスベリの葉を2〜3枚綴るか折りたたみ，中に潜みながら摂食し，葉の表面に多数の小孔を開ける'],
    ['species-2258', '幼虫はエゴノキでは数枚の葉を，ハクウンボクでは1枚の葉を葉巻状に巻く'],
    ['species-23153', '石垣島でアデクの葉に実を付着させ，実に潜っている幼虫が3月に発見されている'],
    ['species-2316', '年2〜3化．幼虫は，イヌマキなどの種子に食入する．ナギでの発生は少ない'],
    ['species-2321', '幼虫はハマゴウの当年枝に潜り，幼虫越冬'],
    ['species-2128', '幼虫はさまざまな広葉樹の新芽や新葉を綴る'],
    ['species-2227', '中国ではタイワンアカマツP. massoniana が記録されている'],
    ['species-2231', '北海道では，成虫が日中にオニグルミJuglans mandshurica var. sachalinensis (クルミ科)の枝に静止していたり，多数の成虫が枝上を飛翔したりしているのが観察されている(Nasu and Kawahara, 2004)'],
    ['species-2317', '成虫は周年発生する．幼虫はフクギの新芽や葉を綴ったり，潜ったりする'],
  ]);
  for (const [insectId, approved] of approvedEcology) {
    const actual = sourceRows.find(
      row => row.insect_id === insectId && row.note_type === '生態情報' && row.content === approved,
    );
    assert.ok(actual, `${insectId} should have the visually approved ecology content`);
  }

  const contentIssues = sourceRows
    .filter(row => row.note_type === '生態情報')
    .flatMap(row => collectGeneralNoteIssues(row)
      .filter(issue => issue !== 'missing_source_page')
      .map(issue => `${row.record_id}:${issue}`));
  assert.deepEqual(contentIssues, []);
  assert.equal(sourceRows.some(row => row.record_id === 'note-1000758'), false);
  assert.doesNotMatch(sourceRows.map(row => row.content).join('\n'), /美観を大いに損ねる/);
  assert.doesNotMatch(sourceRows.map(row => row.content).join('\n'), /年2\s*[～〜]\s*3\s*化すると思われる/);
  assert.doesNotMatch(
    sourceRows.map(row => row.content).join('\n'),
    /可能性がある|おそらく|と思われる|考えられる/,
  );

  assert.ok(sourceRows.every(row => row.year === ''));
  assert.equal(
    sourceRows.find(row => row.insect_id === 'species-2126' && row.note_type === '生態情報').page,
    '67',
  );
});
