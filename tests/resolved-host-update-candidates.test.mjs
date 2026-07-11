import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const AUDIT_PATH = path.join(ROOT, 'data', 'source_audits', 'resolved-host-update-candidates-pdf-2026-07-11.csv');
const APPLY_SCRIPT = path.join(ROOT, 'scripts', 'apply-resolved-host-update-candidates.mjs');
const HOST_FIELDS = ['plant_name', 'plant_family', 'observation_type', 'plant_part', 'life_stage', 'reference', 'notes'];
const HOST_HEADER = ['record_id', 'insect_id', ...HOST_FIELDS];
const INSECT_HEADER = ['insect_id', 'japanese_name', 'scientific_name'];

const readAudit = () => {
  const parsed = Papa.parse(fs.readFileSync(AUDIT_PATH, 'utf8'), { header: true, skipEmptyLines: true });
  assert.deepEqual(parsed.errors, []);
  return parsed.data;
};

const auditRows = readAudit();

function csvLine(values) {
  return Papa.unparse([values], { newline: '' });
}

function makeFixture({ malformedTail = false, mixedTail = false } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ok23-host-audit-'));
  const insectRows = [...new Map(auditRows.map((row) => [row.insect_id, row])).values()]
    .map((row) => [row.insect_id, row.current_japanese_name, row.current_scientific_name]);
  const enrichRows = auditRows.filter((row) => row.action === 'enrich_existing_relation').map((row) => [
    row.record_id,
    row.insect_id,
    ...HOST_FIELDS.map((field) => row[`expected_${field}`]),
  ]);
  const unrelated = ['host-unrelated', 'species-unrelated', '植物Z', '科Z', '', '', '幼虫', '出典Z', ''];

  for (const collection of ['normalized_data', 'public']) {
    const dir = path.join(tmp, collection);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'insects.csv'),
      `${csvLine(INSECT_HEADER)}\r\n${insectRows.map(csvLine).join('\r\n')}\r\n`,
    );
    let hostText = `${csvLine(HOST_HEADER)}\r\n${enrichRows.map(csvLine).join('\r\n')}\r\n${csvLine(unrelated)}`;
    if (mixedTail) {
      const approvedAdds = auditRows.filter((row) => row.action === 'add_host_relation').map((row) => csvLine([
        row.record_id,
        row.insect_id,
        ...HOST_FIELDS.map((field) => row[`approved_${field}`]),
      ]));
      hostText += `\n${approvedAdds.join('\n')}\n`;
    }
    if (malformedTail) {
      const firstAdd = auditRows.find((row) => row.action === 'add_host_relation');
      hostText += csvLine([
        firstAdd.record_id,
        firstAdd.insect_id,
        ...HOST_FIELDS.map((field) => firstAdd[`approved_${field}`]),
      ]);
    }
    fs.writeFileSync(path.join(dir, 'hostplants.csv'), hostText);
  }
  return tmp;
}

function runApply(dataRoot, args = []) {
  return spawnSync(process.execPath, [APPLY_SCRIPT, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, OK23_DATA_ROOT: dataRoot },
  });
}

test('resolved candidate ledger covers all 23 candidates with source-faithful decisions', () => {
  assert.equal(auditRows.length, 37);
  assert.equal(new Set(auditRows.map((row) => row.candidate_id)).size, 23);
  assert.equal(auditRows.filter((row) => row.action === 'add_host_relation').length, 21);
  assert.equal(auditRows.filter((row) => row.action === 'enrich_existing_relation').length, 14);
  assert.equal(auditRows.filter((row) => row.action === 'exclude_relation').length, 2);
  assert.equal(new Set(auditRows.map((row) => row.source_pdf_sha256)).size, 16);
  assert.equal(auditRows.every((row) => /^[a-f0-9]{64}$/.test(row.source_pdf_sha256)), true);
  assert.equal(auditRows.every((row) => /^\d+(;\d+)*$/.test(row.pdf_page) && /^\d+(;\d+)*$/.test(row.printed_page)), true);

  const carex = auditRows.find((row) => row.candidate_id === 'ok23-06');
  assert.equal(carex.source_plant_taxon, 'Carex sp.');
  assert.equal(carex.approved_plant_name, 'スゲ属');
  assert.equal(carex.approved_plant_family, 'カヤツリグサ科');

  const kuju = auditRows.filter((row) => row.candidate_id === 'ok23-15');
  assert.equal(kuju.find((row) => row.approved_plant_name === 'ミヤマキリシマ')?.decision, 'include_explicit_larval_defoliation_merge_existing');
  assert.equal(kuju.find((row) => row.candidate_plant_name === 'ミヤマハンノキ')?.decision, 'exclude_oviposition_substrate_only');

  const nobuki = auditRows.filter((row) => row.candidate_id === 'ok23-17');
  assert.equal(nobuki.find((row) => row.approved_plant_name === 'ヤマボクチ属')?.action, 'add_host_relation');
  assert.equal(nobuki.find((row) => row.candidate_plant_name === 'ノブキ')?.decision, 'exclude_negative_host_record');

  const lopharcha = new Set(auditRows.filter((row) => row.candidate_id === 'ok23-23').map((row) => row.approved_plant_name));
  assert.deepEqual(lopharcha, new Set(['シロダモ', 'クスノキ']));
});

test('apply repairs a missing final delimiter, adds and enriches idempotently', () => {
  const tmp = makeFixture();
  const first = runApply(tmp);
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.match(first.stdout, /changed=35 format_fixed=1/);

  const hashes = new Map();
  for (const collection of ['normalized_data', 'public']) {
    const filePath = path.join(tmp, collection, 'hostplants.csv');
    const bytes = fs.readFileSync(filePath);
    const text = bytes.toString('utf8');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.data.some((row) => Object.hasOwn(row, '__parsed_extra')), false);
    assert.equal(parsed.data.length, 36);
    assert.equal(parsed.data.filter((row) => row.record_id.startsWith('host-ok23-')).length, 21);
    assert.equal((text.match(/(?<!\r)\n/g) || []).length, 0);
    assert.equal(parsed.data.some((row) => row.insect_id === 'species-3885' && row.plant_name === 'ミヤマハンノキ'), false);
    assert.equal(parsed.data.some((row) => row.insect_id === 'species-0814' && row.plant_name === 'ノブキ'), false);
    hashes.set(collection, crypto.createHash('sha256').update(bytes).digest('hex'));
  }

  const second = runApply(tmp);
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.match(second.stdout, /changed=0 format_fixed=0/);
  for (const collection of ['normalized_data', 'public']) {
    const bytes = fs.readFileSync(path.join(tmp, collection, 'hostplants.csv'));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), hashes.get(collection));
  }
  const check = runApply(tmp, ['--check']);
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test('apply fails closed on a concatenated over-wide row', () => {
  const tmp = makeFixture({ malformedTail: true });
  const result = runApply(tmp);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /has \d+ columns; expected 9/);
});

test('apply repairs a mixed-LF tail without duplicating approved rows', () => {
  const tmp = makeFixture({ mixedTail: true });
  const result = runApply(tmp);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /changed=14 format_fixed=22/);
  for (const collection of ['normalized_data', 'public']) {
    const text = fs.readFileSync(path.join(tmp, collection, 'hostplants.csv'), 'utf8');
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    assert.deepEqual(parsed.errors, []);
    assert.equal(parsed.data.some((row) => Object.hasOwn(row, '__parsed_extra')), false);
    assert.equal(parsed.data.filter((row) => row.record_id.startsWith('host-ok23-')).length, 21);
    assert.equal((text.match(/(?<!\r)\n/g) || []).length, 0);
  }
  const second = runApply(tmp, ['--check']);
  assert.equal(second.status, 0, second.stderr || second.stdout);
});

test('apply fails closed when an excluded relation is present', () => {
  const tmp = makeFixture();
  for (const collection of ['normalized_data', 'public']) {
    const filePath = path.join(tmp, collection, 'hostplants.csv');
    fs.appendFileSync(
      filePath,
      `\r\n${csvLine(['host-forbidden', 'species-3885', 'ミヤマハンノキ', 'カバノキ科', '', '', '幼虫', '誤出典', ''])}`,
    );
  }
  const result = runApply(tmp);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /excluded host relation is present/);
});
