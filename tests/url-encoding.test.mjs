import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodePercentEncodedText,
  decodeRouteParam,
  repairUtf8Mojibake,
  safeDecodeURIComponent,
} from '../src/utils/urlEncoding.js';

test('decodeRouteParam preserves normal Japanese route params', () => {
  assert.equal(decodeRouteParam('アオアツバ'), 'アオアツバ');
  assert.equal(
    decodeRouteParam('%E3%82%A2%E3%82%AA%E3%82%A2%E3%83%84%E3%83%90'),
    'アオアツバ',
  );
});

test('decodeRouteParam repairs the UTF-8 mojibake produced on reload', () => {
  assert.equal(decodeRouteParam('ã¢ãªã¢ãã'), 'アオアツバ');
  assert.equal(
    decodeRouteParam('%C3%A3%C2%82%C2%A2%C3%A3%C2%82%C2%AA%C3%A3%C2%82%C2%A2%C3%A3%C2%83%C2%84%C3%A3%C2%83%C2%90'),
    'アオアツバ',
  );
});

test('decodePercentEncodedText handles one or two encoding layers', () => {
  assert.equal(
    decodePercentEncodedText('%2Fplant%2F%25E3%2583%2596%25E3%2583%258A'),
    '/plant/ブナ',
  );
});

test('safe decoding falls back on malformed escapes', () => {
  assert.equal(safeDecodeURIComponent('%E3%82'), '%E3%82');
  assert.equal(repairUtf8Mojibake('plain-text'), 'plain-text');
});
