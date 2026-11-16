import test from 'node:test';
import assert from 'node:assert/strict';
import { createTextTooltip } from '../src/utils/textTooltip.js';
import { decodeRouteParam } from '../src/utils/urlEncoding.js';

test('tooltip preserves route markup as text and never assigns HTML', () => {
  const routeName = '<b data-audit-probe="tooltip">safe</b>';
  const name = decodeRouteParam(encodeURIComponent(routeName));
  const ownerDocument = {
    createElement(tag) {
      assert.equal(tag, 'span');
      return {
        textContent: '',
        set innerHTML(_value) { throw new Error('HTML assignment is forbidden'); },
      };
    },
  };
  const label = createTextTooltip(name, ownerDocument);
  assert.equal(label.textContent, routeName);
});

test('tooltip keeps Unicode and normalizes absent or numeric labels', () => {
  const ownerDocument = { createElement: () => ({ textContent: '' }) };
  for (const [value, expected] of [['クヌギ & <文字>', 'クヌギ & <文字>'], [null, ''], [undefined, ''], [7, '7']]) {
    assert.equal(createTextTooltip(value, ownerDocument).textContent, expected);
  }
});
