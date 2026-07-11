import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import Papa from 'papaparse';

const readCsv = (filePath) => {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  assert.deepEqual(parsed.errors, [], `${filePath} should parse cleanly`);
  return parsed.data;
};

const auditRows = readCsv('data/source_audits/japanese-longhorn-beetles-2007-host-index.csv');
const insectRows = readCsv('normalized_data/insects.csv');
const hostRows = readCsv('normalized_data/hostplants.csv');
const noteRows = readCsv('normalized_data/general_notes.csv');
const report = JSON.parse(fs.readFileSync('reports/kamikiri_hostplant_list.json', 'utf8'));
const insectsById = new Map(insectRows.map((row) => [row.insect_id, row]));
const hostsByRecordId = new Map(hostRows.map((row) => [row.record_id, row]));
const reportByEvidenceKey = new Map(
  report.results
    .filter((row) => row.insect_id && Number.isInteger(row.source_ocr_line))
    .map((row) => [
      `${row.insect_id}\u0000${row.source_ocr_line}\u0000${row.match_method}`,
      row,
    ]),
);

test('寄主植物索引の全目視監査判断をページ・OCR行付きで保持する', () => {
  assert.equal(auditRows.length, 1895);
  assert.equal(auditRows.filter((row) => row.decision === 'include').length, 1650);
  assert.equal(auditRows.filter((row) => row.decision === 'exclude_ocr_or_boundary').length, 101);
  assert.equal(auditRows.filter((row) => row.decision === 'needs_review').length, 144);
  const derivedBaseRows = auditRows.filter((row) => row.match_method === 'exact_derived_base_name');
  assert.equal(derivedBaseRows.length, 597);
  assert.equal(derivedBaseRows.filter((row) => row.decision === 'include').length, 425);
  assert.equal(derivedBaseRows.filter((row) => row.decision === 'exclude_ocr_or_boundary').length, 34);
  assert.equal(derivedBaseRows.filter((row) => row.decision === 'needs_review').length, 138);
  assert.equal(new Set(auditRows.map((row) => row.audit_id)).size, auditRows.length);
  assert.equal(report.summary.unreviewed_new_candidates, 0);

  for (const row of auditRows) {
    assert.equal(row.canonical_reference, '日本産カミキリムシ');
    assert.equal(row.source_pdf_sha256, '52299895c14c1fd1c74279dca00f6fd9ba64d36d69e3bf3dd9c3a29a92802e77');
    assert.equal(row.ocr_sha256, 'efb17b5912fbb2c144dab4d99924dbc341e8f64054be7909dd7818cad155bef2');
    assert.equal(insectsById.get(row.insect_id)?.japanese_name, row.current_japanese_name);
    if (row.match_method === 'exact_derived_base_name' && row.decision !== 'exclude_ocr_or_boundary') {
      assert.equal(
        row.current_japanese_name.replace(/\s+(?:基亜種|亜種\d*|[A-Z].+亜種).*$/u, '').trim(),
        row.source_japanese_name,
        `${row.audit_id} should retain the visually reviewed base-name mapping`,
      );
      assert.match(row.review_note, /索引/);
    }
    const reportRow = reportByEvidenceKey.get(
      `${row.insect_id}\u0000${row.source_ocr_line}\u0000${row.match_method}`,
    );
    assert.ok(reportRow, `${row.audit_id} should retain a source-ledger evidence row`);
    assert.equal(reportRow.audit_id, row.audit_id, `${row.audit_id} report audit_id`);
    assert.equal(reportRow.audit_decision, row.decision, `${row.audit_id} report decision`);
  }
});

test('元索引台帳では採用1650組だけを元record_idで反映し、別共有台帳と混同しない', () => {
  for (const row of auditRows) {
    const recordId = `host-${row.audit_id}`;
    const host = hostsByRecordId.get(recordId);
    if (row.decision !== 'include') {
      assert.equal(host, undefined, `${row.audit_id} must not be published`);
      continue;
    }
    assert.ok(host, `${row.audit_id} should be published`);
    assert.deepEqual(
      {
        insect_id: host.insect_id,
        plant_name: host.plant_name,
        plant_family: host.plant_family,
        plant_part: host.plant_part,
        reference: host.reference,
      },
      {
        insect_id: row.insect_id,
        plant_name: row.plant_name,
        plant_family: row.plant_family,
        plant_part: '',
        reference: '日本産カミキリムシ',
      },
      row.audit_id,
    );
  }
});

test('文献データがあるカミキリムシに未入力表示を残さない', () => {
  const linkedInsectIds = new Set([
    ...hostRows.map((row) => row.insect_id),
    ...noteRows.map((row) => row.insect_id),
  ]);
  const staleRows = insectRows.filter((row) =>
    row.family === 'Cerambycidae' &&
    linkedInsectIds.has(row.insect_id) &&
    /食草・生態情報は未入力/u.test(row.notes || '')
  );
  assert.deepEqual(staleRows, []);
});
