import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildAnalyticsHeadTags } from '../scripts/lib/analyticsHeadTags.mjs';

test('static meta pages share the QA and persistent analytics opt-out contract', () => {
  const tags = buildAnalyticsHeadTags('G-MFEQF99G0H');
  const loader = readFileSync(
    new URL('../public/assets/analytics-loader.js', import.meta.url),
    'utf8',
  );

  assert.match(tags, /src="\/assets\/analytics-loader\.js"/);
  assert.match(tags, /data-measurement-id="G-MFEQF99G0H"/);
  assert.match(tags, /data-send-page-view="true"/);
  assert.match(loader, /params\.get\('qa'\)/);
  assert.match(loader, /params\.get\('analytics'\)/);
  assert.match(loader, /orau98\.analytics\.qaSession/);
  assert.match(loader, /orau98\.analytics\.optOut/);
  assert.match(loader, /ga-disable-/);
  assert.match(loader, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=/);
  assert.match(loader, /window\.gtag\('config', measurementId/);
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
