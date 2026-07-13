import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildResponsivePicture,
  buildResizedImageUrl,
} from '../src/utils/imageSrcset.js';

test('insect responsive images use WebP as the deployed fallback', () => {
  const image = buildResponsivePicture({
    baseUrl: '/',
    folder: 'insects',
    filename: 'Cucullia_argentea',
    query: '',
  });

  assert.equal(image.src, '/images/resized/insects/Cucullia_argentea.1024.webp');
  assert.match(image.srcSet, /\.320\.webp 320w/u);
  assert.equal(image.sources.length, 0);
});

test('legacy JPEG-only insect sources use the generated WebP fallback', () => {
  assert.equal(
    buildResizedImageUrl({
      baseUrl: '/',
      folder: 'insects',
      filename: 'Acronicta_alni',
      width: 640,
      query: '',
    }),
    '/images/resized/insects/Acronicta_alni.640.webp',
  );
});

test('plant responsive images keep JPEG fallback and modern picture sources', () => {
  const image = buildResponsivePicture({
    baseUrl: '/',
    folder: 'plants',
    filename: 'オキナグサ',
    query: '',
  });

  assert.match(image.src, /^\/images\/resized\/plants\/.+\.1024\.jpg$/u);
  assert.deepEqual(image.sources.map(({ type }) => type), ['image/avif', 'image/webp']);
});
