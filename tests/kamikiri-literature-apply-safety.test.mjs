import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const normalizedPaths = [
  'normalized_data/hostplants.csv',
  'normalized_data/general_notes.csv',
  'normalized_data/insects.csv',
];

const hashes = (root = process.cwd()) => Object.fromEntries(normalizedPaths.map((filePath) => [
  filePath,
  crypto.createHash('sha256').update(fs.readFileSync(path.join(root, filePath))).digest('hex'),
]));

const createTemporaryDataRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kamikiri-apply-data-'));
  fs.mkdirSync(path.join(root, 'normalized_data'));
  for (const filePath of normalizedPaths) {
    fs.copyFileSync(filePath, path.join(root, filePath));
  }
  return root;
};

test('監査適用は必須列欠落時に既存CSVを一切変更しない', () => {
  const temporaryAudit = path.join(os.tmpdir(), `kamikiri-invalid-audit-${process.pid}.csv`);
  const dataRoot = createTemporaryDataRoot();
  fs.writeFileSync(
    temporaryAudit,
    'audit_id,insect_id,decision\ninvalid,species-22628,include\n',
    'utf8',
  );
  const before = hashes(dataRoot);
  try {
    const result = spawnSync(process.execPath, ['scripts/apply-kamikiri-literature-audit.mjs'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        KAMIKIRI_LITERATURE_AUDIT_PATH: temporaryAudit,
        KAMIKIRI_LITERATURE_DATA_ROOT: dataRoot,
      },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /is missing current_japanese_name/);
    assert.deepEqual(hashes(dataRoot), before);
  } finally {
    fs.rmSync(temporaryAudit, { force: true });
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('統合済み旧IDに新しい文献行が付いたら削除せず停止する', () => {
  const dataRoot = createTemporaryDataRoot();
  const hostplantsPath = path.join(dataRoot, 'normalized_data/hostplants.csv');
  fs.appendFileSync(
    hostplantsPath,
    'host-merged-duplicate-safety,species-22610,クリ,ブナ科,文献,,幼虫,別文献,\r\n',
    'utf8',
  );
  const before = hashes(dataRoot);
  try {
    const result = spawnSync(process.execPath, ['scripts/apply-kamikiri-literature-audit.mjs'], {
      cwd: process.cwd(),
      env: { ...process.env, KAMIKIRI_LITERATURE_DATA_ROOT: dataRoot },
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Merged duplicate IDs gained linked evidence/);
    assert.deepEqual(hashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});

test('監査適用は再実行しても同じCSVを生成する', () => {
  const dataRoot = createTemporaryDataRoot();
  try {
    const before = hashes(dataRoot);
    for (let index = 0; index < 2; index += 1) {
      const result = spawnSync(process.execPath, ['scripts/apply-kamikiri-literature-audit.mjs'], {
        cwd: process.cwd(),
        env: { ...process.env, KAMIKIRI_LITERATURE_DATA_ROOT: dataRoot },
        encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
    }
    assert.deepEqual(hashes(dataRoot), before);
  } finally {
    fs.rmSync(dataRoot, { recursive: true, force: true });
  }
});
