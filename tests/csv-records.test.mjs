import test from 'node:test';
import assert from 'node:assert/strict';

import {
  splitCsvRecords,
  splitCsvRecordsWithDelimiters,
} from '../scripts/lib/csvRecords.mjs';

test('splitCsvRecords preserves quoted line breaks as part of one logical record', () => {
  const source = 'id,content\r\n1,"first line\r\nsecond line"\r\n2,"escaped ""quote"""\r\n';
  assert.deepEqual(splitCsvRecords(source), [
    'id,content',
    '1,"first line\r\nsecond line"',
    '2,"escaped ""quote"""',
  ]);
});

test('splitCsvRecordsWithDelimiters preserves mixed record separators', () => {
  assert.deepEqual(splitCsvRecordsWithDelimiters('a,b\r\n1,one\n2,two\r3,three'), [
    { record: 'a,b', delimiter: '\r\n' },
    { record: '1,one', delimiter: '\n' },
    { record: '2,two', delimiter: '\r' },
    { record: '3,three', delimiter: '' },
  ]);
});

test('splitCsvRecords rejects unterminated quoted fields', () => {
  assert.throws(() => splitCsvRecords('id,content\n1,"broken'), /unterminated quoted field/);
});
