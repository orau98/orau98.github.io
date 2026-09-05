import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SITE_ICON_VERSION, SITE_LOGO_SRC } from '../src/utils/siteBrand.js';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url));
const text = (file) => read(file).toString('utf8');
const pngSize = (buffer) => {
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
};

test('C1 icon exports have their declared dimensions and a self-contained SVG', () => {
  assert.deepEqual(pngSize(read('assets/brand/logo-c1-source.png')), [1254, 1254]);
  for (const size of [48, 192, 512]) {
    assert.deepEqual(pngSize(read(`public/favicon-${size}.png`)), [size, size]);
  }
  assert.deepEqual(pngSize(read('public/apple-touch-icon.png')), [180, 180]);
  const embedded = text('public/favicon.svg').match(/href="data:image\/png;base64,([^"]+)"/);
  assert.ok(embedded, 'SVG must embed the C1 artwork rather than reference another URL');
  assert.deepEqual(Buffer.from(embedded[1], 'base64'), read('public/favicon-192.png'));
});

test('ICO contains valid 16/32/48px PNG frames', () => {
  const ico = read('public/favicon.ico');
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  [16, 32, 48].forEach((size, index) => {
    const entry = 6 + index * 16;
    assert.equal(ico[entry], size);
    assert.equal(ico[entry + 1], size);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset + length <= ico.length);
    assert.deepEqual(pngSize(ico.subarray(offset, offset + length)), [size, size]);
  });
});

test('entry and manifest invalidate the old icon URLs consistently', () => {
  const html = text('index.html');
  for (const file of ['favicon-48.png', 'favicon.svg', 'favicon-192.png', 'apple-touch-icon.png', 'site.webmanifest']) {
    assert.ok(html.includes(`href="/${file}?v=${SITE_ICON_VERSION}"`), file);
  }
  const manifest = JSON.parse(text('public/site.webmanifest'));
  assert.equal(manifest.icons.length, 4);
  for (const icon of manifest.icons) {
    assert.ok(icon.src.endsWith(`?v=${SITE_ICON_VERSION}`));
    const file = icon.src.split('?')[0];
    assert.equal(pngSize(read(`public${file}`)).join('x'), icon.sizes);
    assert.ok(!icon.purpose?.includes('maskable'), 'transparent artwork is not advertised as mask-safe');
  }
});

test('React and both static generators share C1 instead of the old inline mark', () => {
  assert.equal(SITE_LOGO_SRC, `/favicon-192.png?v=${SITE_ICON_VERSION}`);
  const header = text('src/components/Header.jsx');
  assert.ok(header.includes('src={SITE_LOGO_SRC}'));
  assert.ok(header.includes('aria-hidden="true"'));
  assert.ok(!header.includes('logo-leaf-bite'));
  for (const [file, count] of [['scripts/generate-meta-pages.js', 3], ['scripts/generate-meta-en-pages.mjs', 4]]) {
    const script = text(file);
    assert.equal(script.match(/<img src="\$\{SITE_LOGO_SRC\}"/g)?.length, count);
    assert.ok(!script.includes('logo-leaf-bite'));
  }
});
