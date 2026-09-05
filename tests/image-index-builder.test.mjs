import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildImageIndex } from '../scripts/build-image-index.mjs';

test('shared image index excludes tiny originals without fallback and writes three consistent indexes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'image-index-test-'));
  try {
    const originals = path.join(root, 'public/images/insects');
    const resized = path.join(root, 'public/images/resized/insects');
    fs.mkdirSync(originals, { recursive: true });
    fs.mkdirSync(resized, { recursive: true });
    fs.writeFileSync(path.join(originals, 'valid.png'), Buffer.alloc(200));
    fs.writeFileSync(path.join(originals, 'valid.jpg'), Buffer.alloc(200));
    fs.writeFileSync(path.join(originals, 'tiny.jpg'), 'bad');
    fs.writeFileSync(path.join(originals, 'fallback.jpg'), 'bad');
    fs.writeFileSync(path.join(resized, 'fallback.320.jpg'), Buffer.alloc(200));
    buildImageIndex(root);
    const read = (file) => fs.readFileSync(path.join(root, 'public', file), 'utf8');
    const names = read('image_filenames.txt');
    const exts = read('image_extensions.json');
    const lite = JSON.parse(read('assets/data-lite/image-index.json'));
    assert.deepEqual(lite.names, ['fallback', 'valid']);
    assert.deepEqual(lite.exts, { fallback: '.jpg', valid: '.jpg' });
    assert.equal(names, lite.names.join('\n') + '\n');
    assert.deepEqual(JSON.parse(exts), lite.exts);
    buildImageIndex(root);
    assert.equal(read('image_filenames.txt'), names);
    assert.equal(read('image_extensions.json'), exts);
    const meta = fs.readFileSync(new URL('../scripts/generate-meta-pages.js', import.meta.url), 'utf8');
    assert.match(meta, /import \{ buildImageIndex \} from '.\/build-image-index.mjs'/);
    assert.ok(!meta.includes('const imageCandidatesByName'), 'no second insect index writer');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
