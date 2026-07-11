import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

test('種解説抽出器は原典監査crosswalkと完全一致だけを候補台帳へ出す', () => {
  const outputPath = path.join(os.tmpdir(), `kamikiri-account-safety-${process.pid}.json`);
  try {
    execFileSync(process.execPath, ['scripts/extract-kamikiri-species-accounts.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        KAMIKIRI_OCR_FILE: path.resolve('tests/fixtures/kamikiri-species-account-ocr-safety.txt'),
        KAMIKIRI_ACCOUNT_OUT_JSON: outputPath,
      },
      encoding: 'utf8',
    });

    const ledger = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    assert.equal(ledger.mode, 'candidate_ledger_only_no_repo_writes');
    assert.equal(ledger.summary.fuzzyAutoMatchCount, 0);
    assert.equal(ledger.summary.reviewedDerivedAliasOverrideCount, 1);
    assert.equal(ledger.safety.fuzzyAutomaticMatching, false);
    assert.equal(ledger.safety.reviewedCrosswalkMayOverrideDerivedBaseAliasOnly, true);

    const okinawa = ledger.candidates.find((row) =>
      row.insectId === 'species-22628' && row.headingJapanese === 'オキナワアヤモンチビカミキリ'
    );
    assert.ok(okinawa);
    assert.equal(okinawa.matchMethod, 'manual_crosswalk');
    assert.equal(okinawa.emergenceCandidates[0].normalized, '3〜12月');
    assert.deepEqual(
      new Set(okinawa.hostFieldCandidates[0].plantCandidates),
      new Set(['アコウ', 'ガジュマル', 'イヌビワ', 'ヤマグワ', 'アカメガシワ', 'ウラジロエノキ']),
    );
    assert.deepEqual(okinawa.boundaryFlags, []);

    const sado = ledger.candidates.find((row) =>
      row.insectId === 'species-22118' && row.headingJapanese === 'サドチビアメイロカミキリ'
    );
    assert.ok(sado, '目視監査済みcrosswalkは亜種の省略和名を正しい本土亜種へ解決する');
    assert.equal(sado.matchMethod, 'manual_crosswalk');
    assert.equal(sado.emergenceCandidates[0].normalized, '6〜8月');
    assert.equal(
      ledger.candidates.some((row) =>
        ['species-22116', 'species-22119'].includes(row.insectId) &&
        row.headingJapanese === 'サドチビアメイロカミキリ'
      ),
      false,
    );

    const ocrMiss = ledger.unresolvedHeadings.find((row) =>
      row.headingJapanese === 'オキナリアヤモンチビカミキリ'
    );
    assert.ok(ocrMiss, 'OCR-misspelled heading should stay unresolved');
    assert.equal(ocrMiss.matchMethod, 'unresolved_exact_only');
    assert.equal(
      ledger.candidates.some((row) =>
        row.headingJapanese === 'オキナリアヤモンチビカミキリ' &&
        ['species-22628', 'species-23032'].includes(row.insectId)
      ),
      false,
    );
  } finally {
    fs.rmSync(outputPath, { force: true });
  }
});
