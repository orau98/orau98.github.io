import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import Papa from 'papaparse';

const readCsv = (filePath) => {
  const parsed = Papa.parse(
    fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
    { header: true, skipEmptyLines: true },
  );
  assert.deepEqual(parsed.errors, [], `${filePath} should parse without errors`);
  return parsed.data;
};

const insects = readCsv('normalized_data/insects.csv');
const hostplants = readCsv('normalized_data/hostplants.csv');
const notes = readCsv('normalized_data/general_notes.csv');
const audit = readCsv('data/source_audits/japanese-longhorn-beetles-2007.csv');
const officialDuplicates = readCsv('data/source_audits/japanese-beetles-2026-duplicate-combinations.csv');

const insectsById = new Map(insects.map((row) => [row.insect_id, row]));
const sourceHostsFor = (insectId) => hostplants.filter(
  (row) => row.insect_id === insectId && row.reference === '日本産カミキリムシ',
);
const sourceNotesFor = (insectId) => notes.filter(
  (row) => row.insect_id === insectId && row.reference === '日本産カミキリムシ',
);
const hostNamesFor = (insectId) => new Set(sourceHostsFor(insectId).map((row) => row.plant_name));
const accountAuditByInsectId = new Map(
  audit
    .filter((row) => ['include', 'include_shared_group'].includes(row.decision))
    .map((row) => [row.insect_id, row]),
);
const accountHostsFor = (insectId) => {
  const auditRow = accountAuditByInsectId.get(insectId);
  if (!auditRow) return [];
  return sourceHostsFor(insectId).filter((row) =>
    row.record_id.startsWith(`host-${auditRow.audit_id}-`)
  );
};
const accountHostNamesFor = (insectId) => new Set(
  accountHostsFor(insectId).map((row) => row.plant_name),
);

const expected = new Map([
  ['species-22625', {
    emergence: '3〜10月',
    page: '539',
    hosts: ['アコウ', 'ガジュマル', 'イヌビワ', 'トベラ', 'カラスザンショウ'],
    alias: null,
  }],
  ['species-22632', {
    emergence: '4〜9月',
    page: '539',
    hosts: ['アコウ', 'ガジュマル'],
    alias: 'トカラアヤモンチビカミキリ',
  }],
  ['species-22631', {
    emergence: '3〜10月',
    page: '539-540',
    hosts: ['アコウ', 'ガジュマル', 'ヤマグワ', 'イヌビワ', 'アカメガシワ', 'ハゼノキ'],
    alias: 'アマミアヤモンチビカミキリ',
  }],
  ['species-22630', {
    emergence: '4〜10月',
    page: '540',
    hosts: ['アコウ', 'ガジュマル', 'イヌビワ', 'ヤマグワ'],
    alias: 'オキノエラブアヤモンチビカミキリ',
  }],
  ['species-22628', {
    emergence: '3〜12月',
    page: '540',
    hosts: ['アコウ', 'ガジュマル', 'イヌビワ', 'ヤマグワ', 'アカメガシワ', 'ウラジロエノキ'],
    alias: 'オキナワアヤモンチビカミキリ',
  }],
  ['species-22626', {
    emergence: '1〜12月',
    page: '540',
    hosts: ['アコウ', 'ガジュマル', 'イヌビワ', 'ヤマグワ', 'アカメガシワ', 'ヤエヤマコクタン'],
    alias: null,
  }],
  ['species-22629', {
    emergence: '1〜12月',
    page: '540-541',
    hosts: ['アコウ', 'ガジュマル', 'ヤマグワ', 'オオハマボウ', 'クロヨナ'],
    alias: null,
  }],
]);

test('アヤモンチビカミキリ各亜種の原典寄主を亜種別に保持する', () => {
  for (const [insectId, row] of expected) {
    const actual = accountHostNamesFor(insectId);
    assert.deepEqual(actual, new Set(row.hosts), `${insectId} host plants`);
    for (const host of accountHostsFor(insectId)) {
      assert.equal(host.observation_type, '文献');
      assert.equal(host.life_stage, '幼虫');
      assert.ok(host.plant_family, `${insectId}:${host.plant_name} should have a family`);
    }
  }
});

test('アヤモンチビカミキリ各亜種の出現期と生態を原典ページ付きで保持する', () => {
  for (const [insectId, row] of expected) {
    const sourceNotes = sourceNotesFor(insectId);
    const emergence = sourceNotes.filter((note) => note.note_type === '出現時期');
    const ecology = sourceNotes.filter((note) => note.note_type === '生態情報');
    assert.equal(emergence.length, 1, `${insectId} should have one audited emergence note`);
    assert.equal(ecology.length, 1, `${insectId} should have one audited ecology note`);
    assert.equal(emergence[0].content, row.emergence);
    assert.equal(emergence[0].page, row.page);
    assert.equal(emergence[0].year, '2007');
    assert.equal(ecology[0].page, row.page);
    assert.match(ecology[0].content, /クワ科植物の枯枝/);
  }
});

test('沖縄亜種は6寄主・3〜12月・成虫越冬の原典記述を持つ', () => {
  const insectId = 'species-22628';
  assert.deepEqual(accountHostNamesFor(insectId), new Set([
    'アコウ', 'ガジュマル', 'イヌビワ', 'ヤマグワ', 'アカメガシワ', 'ウラジロエノキ',
  ]));
  const sourceNotes = sourceNotesFor(insectId);
  assert.equal(sourceNotes.some((row) => row.note_type === '出現時期' && row.content === '3〜12月'), true);
  assert.equal(sourceNotes.some((row) => row.content.includes('成虫越冬')), true);
  assert.equal(sourceNotes.some((row) => row.content === '3〜11月'), false);
  assert.equal(
    accountHostsFor(insectId).find((row) => row.plant_name === 'ウラジロエノキ')?.plant_family,
    'アサ科',
  );
});

test('全欠落監査で確認したヒメスギカミキリとクリチビカミキリを収録する', () => {
  assert.deepEqual(accountHostNamesFor('species-21882'), new Set(['スギ', 'ヒノキ', 'モミ', 'アカマツ', 'エゾマツ']));
  assert.deepEqual(accountHostNamesFor('species-22609'), new Set(['クリ', 'コナラ', 'ミズナラ']));

  const himesugiNotes = sourceNotesFor('species-21882');
  assert.equal(himesugiNotes.some((row) => row.note_type === '出現時期' && row.content === '3〜7月' && row.page === '478'), true);
  assert.equal(himesugiNotes.some((row) => row.note_type === '生態情報' && row.content.includes('新しい伐採木')), true);

  const kuriNotes = sourceNotesFor('species-22609');
  assert.equal(kuriNotes.some((row) => row.note_type === '出現時期' && row.content === '5〜9月' && row.page === '543'), true);
  assert.equal(kuriNotes.some((row) => row.note_type === '生態情報' && row.content.includes('クリの細い枯枝')), true);
});

test('冊子541〜544頁のSybra各種を種別欄どおりに保持する', () => {
  const sybraAccounts = new Map([
    ['species-22622', {
      emergence: '3〜10月',
      page: '541',
      hosts: ['ハチジョウススキ'],
      ecology: /ハチジョウススキ群生地の叩き網/,
    }],
    ['species-22616', {
      emergence: '5〜8月',
      page: '541',
      hosts: ['モミ', 'アカマツ'],
      ecology: /樹幹部には産卵しない/,
    }],
    ['species-22615', {
      emergence: '7〜8月',
      page: '541',
      hosts: ['リュウキュウマツ'],
      ecology: /生立木の枯枝部/,
    }],
    ['species-22641', {
      emergence: '7〜9月',
      page: '541',
      hosts: [
        'サルナシ', 'ヒメリンゴ', 'ヤマザクラ', 'サクラ類', 'フジ', 'ヌルデ',
        'イタヤカエデ', 'ノブドウ', 'サワフタギ', 'シロモジ', '各種広葉樹', 'モミ',
      ],
      ecology: /自然植生の豊かな広葉樹林/,
    }],
    ['species-22612', {
      emergence: '5〜6月',
      page: '542',
      hosts: [],
      ecology: /寄主植物は未知/,
    }],
    ['species-22613', {
      emergence: '4〜7月',
      page: '542',
      hosts: ['クリ', 'コナラ'],
      ecology: /スダジイ生木上部の細い枯枝/,
    }],
    ['species-22611', {
      emergence: '4〜7月',
      page: '542',
      hosts: ['スダジイ'],
      ecology: /伐採跡地に積んであるスダジイのそだ/,
    }],
    ['species-22642', {
      emergence: '5〜9月',
      page: '543',
      hosts: [
        'シナノキ', 'キブシ', 'コシアブラ', 'ミズキ', 'クマノミズキ',
        'ハリギリ', 'ハクウンボク', 'シオジ', 'ハシドイ', '各種広葉樹',
      ],
      ecology: /広葉樹の細い枯枝に多い/,
    }],
    ['species-22643', {
      emergence: '6〜8月',
      page: '543',
      hosts: [],
      ecology: /広葉樹の細い枯枝の叩き網.*寄主植物は未知/,
    }],
    ['species-22644', {
      emergence: '4〜10月',
      page: '543-544',
      hosts: [],
      ecology: /広葉樹の細い枯枝によく見られる.*寄主植物は未知/,
    }],
  ]);

  for (const [insectId, expectedAccount] of sybraAccounts) {
    assert.deepEqual(accountHostNamesFor(insectId), new Set(expectedAccount.hosts), `${insectId} hosts`);
    const sourceNotes = sourceNotesFor(insectId);
    assert.deepEqual(
      sourceNotes.filter((row) => row.note_type === '出現時期').map((row) => [row.content, row.page]),
      [[expectedAccount.emergence, expectedAccount.page]],
      `${insectId} emergence`,
    );
    const ecology = sourceNotes.filter((row) => row.note_type === '生態情報');
    assert.equal(ecology.length, 1, `${insectId} ecology count`);
    assert.match(ecology[0].content, expectedAccount.ecology, `${insectId} ecology`);
    assert.equal(ecology[0].page, expectedAccount.page, `${insectId} ecology page`);
    assert.equal(ecology[0].year, '2007', `${insectId} ecology year`);
  }

  assert.equal(hostNamesFor('species-22616').has('シロマツ'), false);
  assert.deepEqual(hostNamesFor('species-22643'), new Set(), '伊豆諸島亜種へ基亜種寄主をコピーしない');
  assert.equal(
    insectsById.get('species-22613').old_japanese_name.split(/[;；]/).includes('キリシマヒメサビカミキリ'),
    true,
  );
  assert.equal(
    insectsById.get('species-22643').old_japanese_name.split(/[;；]/).includes('ミクラシロオビチビカミキリ'),
    true,
  );
});

test('クリチビカミキリの旧組合せ重複を正本へ統合する', () => {
  assert.equal(insectsById.has('species-22610'), false);
  assert.deepEqual(sourceHostsFor('species-22610'), []);
  assert.deepEqual(sourceNotesFor('species-22610'), []);
  assert.equal(
    insectsById.get('species-22609').synonyms.split(/[;；]/).includes(
      'Sybra sakamotoi kuri Ohbayashi & Hayashi, 1962'
    ),
    true,
  );
});

test('全欠落監査の追加バッチは寄主・出現期・生態を隣種から分離して収録する', () => {
  assert.deepEqual(accountHostNamesFor('species-22464'), new Set(['エゾマツ']));
  assert.equal(sourceNotesFor('species-22464').some((row) => row.note_type === '出現時期' && row.content === '7〜8月' && row.page === '347'), true);

  assert.deepEqual(accountHostNamesFor('species-22202'), new Set(['ミズナラ']));
  assert.equal(sourceNotesFor('species-22202').some((row) => row.note_type === '出現時期' && row.content === '6〜8月' && row.page === '393'), true);

  assert.deepEqual(
    accountHostNamesFor('species-22301'),
    new Set(['ウラジロモミ', 'トウヒ', 'サワラ', 'アスナロ', 'ヒノキアスナロ']),
  );
  assert.equal(sourceNotesFor('species-22301').some((row) => row.note_type === '生態情報' && row.content.includes('生木の空洞')), true);

  assert.deepEqual(accountHostNamesFor('species-22443'), new Set());
  assert.equal(sourceNotesFor('species-22443').some((row) => row.note_type === '生態情報' && row.content.includes('寄主植物は未知')), true);
});

test('追加バッチBは欄なし・寄主未知・地域限定記録を区別する', () => {
  assert.deepEqual(accountHostsFor('species-22240'), []);
  assert.deepEqual(sourceNotesFor('species-22240').map((row) => [row.note_type, row.content]), [
    ['出現時期', '4〜7月'],
  ]);

  assert.deepEqual(accountHostsFor('species-22154'), []);
  assert.equal(sourceNotesFor('species-22154').some((row) => row.content.includes('寄主植物は未知')), true);

  assert.deepEqual(accountHostsFor('species-21965'), []);
  assert.equal(sourceNotesFor('species-21965').some((row) => row.content.includes('台湾では各種広葉樹')), true);

  assert.deepEqual(accountHostNamesFor('species-22720'), new Set(['リュウキュウチク', 'ホウライチク', 'ハチジョウススキ']));
  assert.equal(sourceNotesFor('species-22720').some((row) => row.note_type === '出現時期' && row.content === '3〜10月' && row.page === '525'), true);
  assert.equal(
    insectsById.get('species-22720').old_japanese_name.split(/[;；]/).map((value) => value.trim()).includes('オキナワウスアヤカミキリ'),
    true,
  );
});

test('完全一致していた未入力6種にも原典の未知・記録評価を保持する', () => {
  const expectedNotes = new Map([
    ['species-22376', /寄主植物も未知/],
    ['species-22198', /シイの花/],
    ['species-21981', /寄主植物は未知/],
    ['species-21871', /日本に分布していない可能性/],
    ['species-21985', /基準標本も紛失/],
    ['species-22762', /本州からの記録をゴマダラカミキリの誤同定/],
  ]);
  for (const [insectId, pattern] of expectedNotes) {
    assert.equal(sourceNotesFor(insectId).some((row) => pattern.test(row.content)), true, insectId);
    assert.doesNotMatch(insectsById.get(insectId).notes, /食草・生態情報は未入力/);
  }
  assert.deepEqual(accountHostNamesFor('species-22198'), new Set(['リュウキュウマツ']));
  assert.equal(sourceNotesFor('species-22198').some((row) => row.content === '4〜6月'), true);
  assert.equal(sourceNotesFor('species-21981').some((row) => row.content === '3月'), true);
});

test('OCR崩れで漏れた追加18分類群を原典の亜種欄へ戻す', () => {
  assert.equal(sourceNotesFor('species-22338').some((row) => row.content === '7〜8月'), true);
  assert.deepEqual(accountHostNamesFor('species-22118'), new Set([
    'ヤチダモ', 'ヤマトアオダモ', 'コバノトネリコ', 'オニグルミ', 'ケヤキ',
  ]));
  assert.equal(sourceNotesFor('species-22118').some((row) => row.content === '6〜8月'), true);
  assert.deepEqual(accountHostNamesFor('species-22100'), new Set(['ハイノキ属']));
  assert.equal(sourceNotesFor('species-22100').some((row) => row.content === '3〜4月'), true);
  assert.deepEqual(accountHostNamesFor('species-22639'), new Set(['アカメガシワ', 'ボタンヅル']));
  assert.deepEqual(accountHostNamesFor('species-22552'), new Set([
    'テリハノブドウ', 'シマサルナシ', 'クサギ', 'ジャケツイバラ',
  ]));
  assert.deepEqual(accountHostNamesFor('species-22665'), new Set(['サワグルミ', 'クマシデ', 'アケビ']));
  assert.deepEqual(accountHostNamesFor('species-22666'), new Set(['リュウキュウテイカカズラ']));
});

test('トゲウスバカミキリ種群は共通寄主と亜種固有の出現期を分離する', () => {
  const emergence = new Map([
    ['2', '5〜6月'],
    ['3-1', '7〜8月'],
    ['3-2', '7〜8月'],
    ['3-3', '7月'],
    ['3-4', '6月'],
    ['3-5', '7月'],
  ]);
  for (const [insectId, expectedEmergence] of emergence) {
    assert.equal(sourceNotesFor(insectId).some((row) => row.content === expectedEmergence), true, insectId);
    assert.equal(hostNamesFor(insectId).has('モチノキ科'), true, insectId);
    assert.equal(sourceNotesFor(insectId).some((row) => row.content.includes('夜行性で灯火')), true, insectId);
  }
  assert.deepEqual(accountHostNamesFor('3-1'), new Set(['アオハダ', 'ソヨゴ', 'クロガネモチ', 'モチノキ科']));
  assert.equal(hostNamesFor('3-5').has('イスノキ'), false);
});

test('分類年を原記載まで確認した2種は生態を収録し、標準年も同期する', () => {
  assert.deepEqual(
    new Set(audit.filter((row) => ['species-22458', 'species-22444'].includes(row.insect_id) && row.decision === 'include').map((row) => row.insect_id)),
    new Set(['species-22458', 'species-22444']),
  );
  assert.equal(sourceNotesFor('species-22458').some((row) => row.note_type === '出現時期' && row.content === '5〜8月'), true);
  assert.equal(sourceNotesFor('species-22444').some((row) => row.note_type === '出現時期' && row.content === '7月'), true);
  assert.equal(insectsById.get('species-22458').year, '1879');
  assert.equal(insectsById.get('species-22458').scientific_name, 'Toxotinus reinii (Heyden, 1879)');
  assert.equal(insectsById.get('species-22444').year, '1901');
});

test('2007年原典にない粟国島亜種へ基亜種データをコピーしない', () => {
  assert.deepEqual(sourceHostsFor('species-22627'), []);
  assert.deepEqual(sourceNotesFor('species-22627'), []);
  assert.match(insectsById.get('species-22627').notes, /2023年記載/);
  assert.doesNotMatch(insectsById.get('species-22627').notes, /原典ページを再監査済み/);
});

test('旧分類名の重複行を受容名へ統合し、文献情報を二重掲載しない', () => {
  assert.equal(insectsById.has('species-22423'), false);
  assert.equal(insectsById.has('species-22721'), false);
  assert.deepEqual(sourceHostsFor('species-22423'), []);
  assert.deepEqual(sourceHostsFor('species-22721'), []);

  assert.equal(
    insectsById.get('species-22422').synonyms.includes('Pidonia (Pseudopidonia) shikokensis'),
    true,
  );
  assert.equal(
    insectsById.get('species-22720').synonyms.includes('Bumetopia okinawana Hayashi, 1963'),
    true,
  );
  assert.deepEqual(
    accountHostNamesFor('species-22720'),
    new Set(['リュウキュウチク', 'ホウライチク', 'ハチジョウススキ']),
  );

  for (const row of audit.filter((candidate) => candidate.decision === 'merge_duplicate_taxon')) {
    const canonical = insectsById.get(row.merge_into_insect_id);
    assert.ok(canonical, `${row.audit_id} canonical row`);
    assert.equal(insectsById.has(row.insect_id), false, `${row.audit_id} duplicate removed`);
    assert.equal(
      canonical.synonyms.split(/[;；]/).map((value) => value.trim()).includes(row.source_taxon),
      true,
      `${row.audit_id} old scientific name retained`,
    );
    assert.equal(
      canonical.synonyms.split(/[;；]/).map((value) => value.trim()).includes(row.legacy_scientific_name),
      true,
      `${row.audit_id} exact deleted-row scientific name retained`,
    );
  }
});

test('公式2026目録で確認した73組の旧組合せを空ページとして残さない', () => {
  assert.equal(officialDuplicates.length, 73);
  assert.equal(officialDuplicates.every((row) => row.status === 'confirmed'), true);
  const auditByDuplicate = new Map(audit.map((row) => [row.insect_id, row]));
  for (const pair of officialDuplicates) {
    const merge = auditByDuplicate.get(pair.duplicate_id);
    assert.ok(merge, pair.duplicate_id);
    assert.equal(merge.decision, 'merge_duplicate_taxon');
    assert.equal(merge.merge_into_insect_id, pair.canonical_id);
    assert.equal(insectsById.has(pair.duplicate_id), false);
    assert.ok(insectsById.get(pair.canonical_id));
  }
});

test('原典和名を旧和名として保持し、類似名への曖昧一致を避ける', () => {
  for (const [insectId, row] of expected) {
    if (!row.alias) continue;
    assert.equal(
      insectsById.get(insectId).old_japanese_name.split(/[;；]/).map((value) => value.trim()).includes(row.alias),
      true,
      `${insectId} should retain ${row.alias}`,
    );
  }

  const aliases = new Map();
  for (const insect of insects) {
    for (const alias of (insect.old_japanese_name || '').split(/[;；]/).map((value) => value.trim()).filter(Boolean)) {
      if (!aliases.has(alias)) aliases.set(alias, []);
      aliases.get(alias).push(insect.insect_id);
    }
  }
  assert.deepEqual(aliases.get('オキナワアヤモンチビカミキリ'), ['species-22628']);
  assert.deepEqual(aliases.get('オキノエラブアヤモンチビカミキリ'), ['species-22630']);
});

test('監査台帳は原典ハッシュ・ページ・判断を保持する', () => {
  assert.ok(audit.length >= 49);
  assert.equal(new Set(audit.map((row) => row.audit_id)).size, audit.length);
  assert.equal(new Set(audit.map((row) => row.insect_id)).size, audit.length);
  assert.equal(
    audit.filter((row) => [
      'include',
      'include_shared_group',
      'exclude_not_in_source',
      'merge_duplicate_taxon',
      'needs_review',
    ].includes(row.decision)).length,
    audit.length,
  );
  assert.equal(audit.some((row) => row.insect_id === 'species-22628' && row.decision === 'include'), true);
  assert.equal(audit.some((row) => row.insect_id === 'species-22627' && row.decision === 'exclude_not_in_source'), true);
  for (const row of audit) {
    assert.equal(row.source_pdf_sha256, '52299895c14c1fd1c74279dca00f6fd9ba64d36d69e3bf3dd9c3a29a92802e77');
    assert.equal(row.ocr_sha256, 'efb17b5912fbb2c144dab4d99924dbc341e8f64054be7909dd7818cad155bef2');
    assert.match(row.reviewed_on, /^\d{4}-\d{2}-\d{2}$/);
    if (row.decision === 'include' || row.decision === 'needs_review') {
      assert.ok(row.pdf_page);
      assert.ok(row.printed_page);
    }
    if (row.decision === 'merge_duplicate_taxon') {
      assert.ok(row.legacy_scientific_name, `${row.audit_id} legacy scientific name`);
      assert.ok(row.legacy_route_name, `${row.audit_id} legacy route name`);
      assert.equal(row.current_japanese_name, row.legacy_japanese_name, row.audit_id);
    } else {
      assert.equal(row.legacy_japanese_name, '', row.audit_id);
      assert.equal(row.legacy_scientific_name, '', row.audit_id);
      assert.equal(row.legacy_route_name, '', row.audit_id);
    }
  }
});

test('監査台帳の全採用行が正規化CSVへ過不足なく反映される', () => {
  for (const row of audit.filter((candidate) =>
    ['include', 'include_shared_group'].includes(candidate.decision)
  )) {
    const insect = insectsById.get(row.insect_id);
    assert.ok(insect, `${row.audit_id} should retain a canonical insect row`);
    assert.ok(insect.japanese_name, `${row.audit_id} should have a displayable Japanese name`);
    assert.doesNotMatch(insect.notes, /食草・生態情報は未入力/);

    const expectedHosts = (row.host_plants || '')
      .split(';')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [plantName, plantFamily = ''] = entry.split('|').map((value) => value.trim());
        return [plantName, plantFamily];
      });
    assert.deepEqual(
      accountHostsFor(row.insect_id).map((host) => [host.plant_name, host.plant_family]),
      expectedHosts,
      `${row.audit_id} host rows`,
    );

    const sourceNotes = sourceNotesFor(row.insect_id);
    const emergenceNotes = sourceNotes.filter((note) => note.note_type === '出現時期');
    const ecologyNotes = sourceNotes.filter((note) => note.note_type === '生態情報');
    assert.deepEqual(
      emergenceNotes.map((note) => [note.content, note.page, note.year]),
      row.emergence ? [[row.emergence, row.printed_page, '2007']] : [],
      `${row.audit_id} emergence note`,
    );
    assert.deepEqual(
      ecologyNotes.map((note) => [note.content, note.page, note.year]),
      row.ecology ? [[row.ecology, row.printed_page, '2007']] : [],
      `${row.audit_id} ecology note`,
    );

    const registeredNames = new Set([
      insect.japanese_name,
      ...(insect.old_japanese_name || '').split(/[;；]/).map((value) => value.trim()).filter(Boolean),
    ]);
    if (row.decision === 'include') {
      assert.equal(
        registeredNames.has(row.source_japanese_name),
        true,
        `${row.audit_id} should retain its source Japanese name`,
      );
    }
  }
});

test('除外・統合判断の行は文献行を残さない', () => {
  for (const row of audit.filter((candidate) =>
    !['include', 'include_shared_group'].includes(candidate.decision)
  )) {
    assert.deepEqual(sourceHostsFor(row.insect_id), [], `${row.audit_id} hosts`);
    assert.deepEqual(sourceNotesFor(row.insect_id), [], `${row.audit_id} notes`);
    if (row.decision === 'merge_duplicate_taxon') {
      assert.equal(insectsById.has(row.insect_id), false, `${row.audit_id} merged row`);
    }
  }
});

test('再監査済み亜種の登録備考から未入力表示を除く', () => {
  for (const insectId of expected.keys()) {
    const insect = insectsById.get(insectId);
    assert.doesNotMatch(insect.notes, /食草・生態情報は未入力/);
    assert.match(insect.notes, /原典ページを再監査済み/);
  }
});

test('data-lite生成物も沖縄亜種の寄主と出現期を保持する', () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kamikiri-data-lite-'));
  try {
    execFileSync(process.execPath, ['scripts/build-data-lite.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, DATA_LITE_OUT_DIR: outputDir },
      encoding: 'utf8',
    });
    const insectsLite = JSON.parse(fs.readFileSync(path.join(outputDir, 'longhornbeetles.json'), 'utf8'));
    const hostplantsLite = JSON.parse(fs.readFileSync(path.join(outputDir, 'hostplants.json'), 'utf8'));
    const target = insectsLite.find((row) => row.id === 'species-22628');
    assert.ok(target);
    assert.equal(target.emergenceTime, '3〜12月');
    assert.deepEqual(
      new Set(target.hostPlants.map((name) => name.replace(/（[^）]+科）$/u, ''))),
      new Set(expected.get('species-22628').hosts),
    );
    assert.equal(
      target.hostPlantsDetailed.every((host) => host.plantPart === ''),
      true,
      '原典にない「葉」を利用部位として補わない',
    );

    for (const plantName of expected.get('species-22628').hosts) {
      assert.equal(
        (hostplantsLite[plantName] || []).includes('アヤモンチビカミキリ 沖縄亜種'),
        true,
        `generated data should link ${plantName} to the Okinawa subspecies`,
      );
    }
  } finally {
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});
