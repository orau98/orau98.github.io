import test from 'node:test';
import assert from 'node:assert/strict';

import {
  INDEX_FOLLOW_ROBOTS,
  NOINDEX_FOLLOW_ROBOTS,
  NOINDEX_NOFOLLOW_ROBOTS,
  buildRobotsMetaContent,
} from '../src/utils/robotsMeta.js';

test('buildRobotsMetaContent creates rich-preview defaults', () => {
  assert.equal(buildRobotsMetaContent(), INDEX_FOLLOW_ROBOTS);
  assert.match(INDEX_FOLLOW_ROBOTS, /index, follow/);
  assert.match(INDEX_FOLLOW_ROBOTS, /max-image-preview:large/);
});

test('robots presets cover search pages and 404 pages', () => {
  assert.equal(NOINDEX_FOLLOW_ROBOTS, buildRobotsMetaContent({ index: false }));
  assert.equal(
    NOINDEX_NOFOLLOW_ROBOTS,
    buildRobotsMetaContent({ index: false, follow: false, allowRichPreview: false }),
  );
  assert.match(NOINDEX_NOFOLLOW_ROBOTS, /noindex, nofollow/);
  assert.match(NOINDEX_NOFOLLOW_ROBOTS, /max-image-preview:none/);
});
