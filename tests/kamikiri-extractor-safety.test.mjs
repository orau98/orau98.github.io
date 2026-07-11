import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('カミキリ寄主索引は監査済み完全一致だけを採用し、類似名を隔離する', () => {
  const outputPath = path.join(os.tmpdir(), `kamikiri-hostplant-safety-${process.pid}.json`);
  try {
    execFileSync(process.execPath, ['scripts/extract_kamikiri_hostplants.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        KAMIKIRI_OCR_FILE: path.resolve('tests/fixtures/kamikiri-hostplant-ocr-safety.txt'),
        KAMIKIRI_OUT_JSON: outputPath,
      },
      encoding: 'utf8',
    });

    const report = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const rows = report.results;
    assert.equal(report.schema_version, 3);
    assert.equal(report.mode, 'candidate_ledger_only_no_csv_writes');
    assert.equal(report.safety.fuzzy_automatic_matching, false);
    assert.equal(report.safety.reviewed_crosswalk_may_override_derived_base_alias_only, true);
    assert.equal(report.safety.derived_base_candidates_require_index_and_taxon_account_review, true);
    assert.equal(report.safety.new_candidates_require_source_review_before_csv_application, true);
    assert.equal(report.summary.reviewed_derived_alias_overrides, 1);
    const exactOkinawa = rows.find((row) =>
      row.insect_id === 'species-22628' && row.plant_name === 'アコウ'
    );
    assert.ok(exactOkinawa, 'reviewed source name should resolve to the Okinawa subspecies');
    assert.equal(exactOkinawa.match_method, 'reviewed_source_crosswalk');
    assert.equal(exactOkinawa.match_score, 1);
    assert.equal(exactOkinawa.source_pdf_page, 177);
    assert.deepEqual(exactOkinawa.source_printed_page_range, [686, 687]);
    assert.equal(Number.isInteger(exactOkinawa.source_ocr_line), true);
    assert.equal(exactOkinawa.manual_correction, false);

    const exactOkinoerabu = rows.find((row) =>
      row.insect_id === 'species-22630' && row.plant_name === 'イヌビワ'
    );
    assert.ok(exactOkinoerabu, 'reviewed Okinoerabu source name should resolve exactly');

    const exactSado = rows.find((row) =>
      row.insect_id === 'species-22118' && row.plant_name === 'ヤチダモ'
    );
    assert.ok(exactSado, '監査済み省略和名は本土亜種へ明示的に解決する');
    assert.equal(exactSado.match_method, 'reviewed_source_crosswalk');
    assert.equal(
      rows.some((row) => row.insect_id === 'species-22116' && row.plant_name === 'ヤチダモ'),
      false,
    );

    const ocrMiss = rows.find((row) =>
      row.insect_name === 'オキナリアヤモンチビカミキリ' && row.plant_name === 'ガジュマル'
    );
    assert.ok(ocrMiss, 'OCR miss should remain in the candidate ledger');
    assert.equal(ocrMiss.insect_id, null);
    assert.equal(ocrMiss.note, 'no_match');

    assert.equal(rows.some((row) => row.note === 'fuzzy_match'), false);
    const taxonGroupLabel = rows.find((row) =>
      row.insect_name === 'オキナワアヤモンチビカミキリ類' && row.plant_name === 'ヤマグワ'
    );
    assert.ok(taxonGroupLabel);
    assert.equal(taxonGroupLabel.insect_id, null, '「類」は名称の一部として自動削除しない');
    assert.equal(taxonGroupLabel.note, 'no_match');
    assert.equal(
      rows.some((row) => row.insect_id === 'species-23032' && row.plant_name === 'ガジュマル'),
      false,
      'OCR miss must not attach to オキナワリンゴカミキリ',
    );

    assert.equal(
      rows.some((row) => row.insect_id === 'species-21882' && row.plant_name === 'モミ'),
      true,
      'the first host-index pages must not be skipped',
    );
    assert.equal(
      rows.some((row) => row.insect_id === 'species-22882' && row.plant_name === 'タコノキ'),
      true,
      'the last host-index pages before the scientific-name index must be included',
    );
    assert.equal(
      rows.some((row) => row.insect_id === 'species-23032' && row.plant_name === 'アコウ'),
      false,
      'the scientific-name index and later text must not be parsed as host records',
    );
  } finally {
    fs.rmSync(outputPath, { force: true });
  }
});
