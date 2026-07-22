import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildAnalyticsHeadTags } from '../scripts/lib/analyticsHeadTags.mjs';

test('static meta pages share the QA and persistent analytics opt-out contract', () => {
  const tags = buildAnalyticsHeadTags('G-MFEQF99G0H');

  assert.match(tags, /params\.get\('qa'\)/);
  assert.match(tags, /params\.get\('analytics'\)/);
  assert.match(tags, /orau98\.analytics\.qaSession/);
  assert.match(tags, /orau98\.analytics\.optOut/);
  assert.match(tags, /ga-disable-/);
  assert.match(tags, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(tags, /window\.gtag\('config', 'G-MFEQF99G0H'\)/);
});

test('invalid measurement ids are sanitized before HTML interpolation', () => {
  const tags = buildAnalyticsHeadTags("G-TEST'</script>");
  assert.equal(tags.includes('</script></script>'), false);
  assert.match(tags, /G-TESTscript/);
});

test('SPA bootstrap applies the same opt-out before analytics is scheduled', () => {
  const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

  assert.match(indexHtml, /orau98\.analytics\.qaSession/);
  assert.match(indexHtml, /orau98\.analytics\.optOut/);
  assert.match(indexHtml, /window\['ga-disable-' \+ measurementId\] = analyticsDisabled/);
  assert.match(indexHtml, /if \(isLocalPreview \|\| analyticsDisabled\) return/);
});
