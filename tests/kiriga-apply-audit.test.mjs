import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'apply-kiriga-ecology-audit.mjs');
const PDF_HASH = '8d6fdad849c967ec2ea5659fd1b455ea088e13d7bde74d936bbbea97586d703d';

test('apply-kiriga-ecology-audit removes an already-applied row when the audit changes to exclude', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiriga-audit-test-'));
  const notesPath = path.join(tempDir, 'general_notes.csv');
  const auditPath = path.join(tempDir, 'audit.csv');

  try {
    fs.writeFileSync(
      notesPath,
      '\ufeffrecord_id,insect_id,note_type,content,reference,page,year\r\n' +
        'note-test,species-test,生態情報,除外対象の本文,日本の冬夜蛾,54,\r\n',
      'utf-8',
    );
    fs.writeFileSync(
      auditPath,
      'record_id,insect_id,japanese_name,canonical_reference,pdf_file,source_pdf_sha256,pdf_page,printed_page,note_type,decision,approved_content,excluded_categories,reviewed_on\n' +
        `note-test,species-test,テスト種,日本の冬夜蛾,日本のキリガ.pdf,${PDF_HASH},1,54,生態情報,exclude_subjective,,subjective_aesthetic,2026-07-11\n`,
      'utf-8',
    );

    const run = () => spawnSync(process.execPath, [SCRIPT], {
      cwd: ROOT,
      encoding: 'utf-8',
      env: {
        ...process.env,
        KIRIGA_ECOLOGY_NOTES_PATH: notesPath,
        KIRIGA_ECOLOGY_AUDIT_PATH: auditPath,
      },
    });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.doesNotMatch(fs.readFileSync(notesPath, 'utf-8'), /note-test/);

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.doesNotMatch(fs.readFileSync(notesPath, 'utf-8'), /note-test/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

