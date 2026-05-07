import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCurrentHashHref } from '../src/utils/sectionNavigation.js';

test('buildCurrentHashHref preserves the current detail route when adding a hash', () => {
  assert.equal(
    buildCurrentHashHref(
      { pathname: '/moth/%E3%82%A2%E3%82%AA%E3%82%A2%E3%83%84%E3%83%90', search: '' },
      'share',
    ),
    '/moth/%E3%82%A2%E3%82%AA%E3%82%A2%E3%83%84%E3%83%90#share',
  );

  assert.equal(
    buildCurrentHashHref(
      { pathname: '/en/plant/Fagus%20crenata', search: '?tab=plants' },
      'main-content',
    ),
    '/en/plant/Fagus%20crenata?tab=plants#main-content',
  );
});
