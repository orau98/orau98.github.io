import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPLORER_RESULT_QUERY_KEYS,
  hasExplorerResultQuery,
} from '../src/utils/explorerQueryParams.js';

test('result-state query keys stay shared between noindex and home discovery logic', () => {
  assert.equal(new Set(EXPLORER_RESULT_QUERY_KEYS).size, EXPLORER_RESULT_QUERY_KEYS.length);
  for (const key of EXPLORER_RESULT_QUERY_KEYS) {
    assert.equal(hasExplorerResultQuery(`?${key}=value`), true, key);
  }
  assert.equal(hasExplorerResultQuery(new URLSearchParams('pfamily=ブナ科')), true);
});

test('display and attribution parameters do not turn the home into a result page', () => {
  assert.equal(
    hasExplorerResultQuery('?tab=plants&pview=compact&psort=name&pper=48&utm_source=search'),
    false,
  );
  assert.equal(
    hasExplorerResultQuery('?tab=insects&iview=compact&isort=name&iper=48'),
    false,
  );
});
