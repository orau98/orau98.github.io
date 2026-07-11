import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import Papa from 'papaparse';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(__filename), '..');
const SCRIPT = path.join(ROOT, 'scripts', 'repair-literature-record-integrity.mjs');

const read = (filePath) => Papa.parse(
  fs.readFileSync(filePath, 'utf-8').replace(/\r\n|\r|\n/g, '\n'),
  { header: true, skipEmptyLines: true },
).data;

const hash = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

test('literature record repair gives imported notes stable unique IDs and removes stale placeholders', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'literature-record-integrity-'));
  const insectsPath = path.join(tmp, 'insects.csv');
  const hostsPath = path.join(tmp, 'hostplants.csv');
  const notesPath = path.join(tmp, 'general_notes.csv');
  fs.writeFileSync(
    insectsPath,
    'insect_id,notes\r\nspecies-a,目録参照。食草・生態情報は未入力。\r\nspecies-b,食草・生態情報は未入力。\r\n',
  );
  fs.writeFileSync(
    hostsPath,
    'record_id,insect_id,plant_name,plant_family,observation_type,plant_part,life_stage,reference,notes\r\nhost-a,species-a,植物A,科A,,,,出典A,\r\n',
  );
  fs.writeFileSync(
    notesPath,
    'record_id,insect_id,note_type,content,reference,page,year\r\nnote-collision,species-a,出現時期,4～6月,日本産タマムシ大図鑑,,\r\nnote-collision,species-b,生態情報,本文,日本産タマムシ大図鑑,,\r\nnote-other,species-b,生態情報,別本文,別出典,,\r\n',
  );

  const env = {
    ...process.env,
    LITERATURE_RECORD_INSECTS_PATH: insectsPath,
    LITERATURE_RECORD_HOSTPLANTS_PATH: hostsPath,
    LITERATURE_RECORD_NOTES_PATH: notesPath,
  };
  const first = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, env, encoding: 'utf-8' });
  assert.equal(first.status, 0, first.stderr || first.stdout);
  const firstNotes = fs.readFileSync(notesPath);
  const firstInsects = fs.readFileSync(insectsPath);

  const notes = read(notesPath);
  assert.equal(new Set(notes.map((row) => row.record_id)).size, notes.length);
  assert.match(notes[0].record_id, /^note-tamamushi-a-emergence-[0-9a-f]{12}$/);
  assert.match(notes[1].record_id, /^note-tamamushi-b-ecology-[0-9a-f]{12}$/);
  assert.equal(notes[2].record_id, 'note-other');

  const insects = read(insectsPath);
  assert.equal(insects[0].notes, '目録参照。');
  assert.equal(insects[1].notes, '');

  const second = spawnSync(process.execPath, [SCRIPT], { cwd: ROOT, env, encoding: 'utf-8' });
  assert.equal(second.status, 0, second.stderr || second.stdout);
  assert.deepEqual(fs.readFileSync(notesPath), firstNotes);
  assert.deepEqual(fs.readFileSync(insectsPath), firstInsects);
});

test('literature record repair rejects a prospective ID collision without writing either file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'literature-record-integrity-collision-'));
  try {
    const insectsPath = path.join(tmp, 'insects.csv');
    const hostsPath = path.join(tmp, 'hostplants.csv');
    const notesPath = path.join(tmp, 'general_notes.csv');
    fs.writeFileSync(insectsPath, 'insect_id,notes\r\nspecies-a,食草・生態情報は未入力。\r\n');
    fs.writeFileSync(hostsPath, 'record_id,insect_id,plant_name\r\nhost-a,species-a,植物A\r\n');
    const signature = ['日本産タマムシ大図鑑', 'species-a', '出現時期', '4～6月', '', ''].join('\u0000');
    const digest = crypto.createHash('sha1').update(signature).digest('hex').slice(0, 12);
    const collisionId = `note-tamamushi-a-emergence-${digest}`;
    fs.writeFileSync(
      notesPath,
      `record_id,insect_id,note_type,content,reference,page,year\r\nnote-old,species-a,出現時期,4～6月,日本産タマムシ大図鑑,,\r\n${collisionId},species-a,生態情報,別本文,別出典,,\r\n`,
    );
    const before = [insectsPath, notesPath].map(hash);
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: ROOT,
      env: {
        ...process.env,
        LITERATURE_RECORD_INSECTS_PATH: insectsPath,
        LITERATURE_RECORD_HOSTPLANTS_PATH: hostsPath,
        LITERATURE_RECORD_NOTES_PATH: notesPath,
      },
      encoding: 'utf-8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate record_id/);
    assert.deepEqual([insectsPath, notesPath].map(hash), before);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('literature record repair leaves notes unchanged when a later insect parse fails', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'literature-record-integrity-late-fail-'));
  try {
    const insectsPath = path.join(tmp, 'insects.csv');
    const hostsPath = path.join(tmp, 'hostplants.csv');
    const notesPath = path.join(tmp, 'general_notes.csv');
    fs.writeFileSync(insectsPath, 'insect_id,notes\r\nspecies-a,"unterminated\r\n');
    fs.writeFileSync(hostsPath, 'record_id,insect_id,plant_name\r\nhost-a,species-a,植物A\r\n');
    fs.writeFileSync(notesPath, 'record_id,insect_id,note_type,content,reference,page,year\r\nnote-old,species-a,出現時期,4～6月,日本産タマムシ大図鑑,,\r\n');
    const beforeNotes = hash(notesPath);
    const result = spawnSync(process.execPath, [SCRIPT], {
      cwd: ROOT,
      env: {
        ...process.env,
        LITERATURE_RECORD_INSECTS_PATH: insectsPath,
        LITERATURE_RECORD_HOSTPLANTS_PATH: hostsPath,
        LITERATURE_RECORD_NOTES_PATH: notesPath,
      },
      encoding: 'utf-8',
    });
    assert.notEqual(result.status, 0);
    assert.equal(hash(notesPath), beforeNotes);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
