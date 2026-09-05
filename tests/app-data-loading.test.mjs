import test from 'node:test';
import assert from 'node:assert/strict';
import { createAppHarness, fixtureData } from './helpers/appDataHarness.mjs';
import { INSECT_COLLECTION_KEYS } from '../src/utils/siteTaxonomy.js';

test('actual App: insect → plant is equivalent to direct plant, with all seven collections', async () => {
  const app = await createAppHarness('/moth/test/');
  const before = app.requests.length;
  await app.navigate('/plant/test/');
  assert.ok(app.requests.length >= before);
  const props = app.route('/plant/:plantName');
  assert.ok(props);
  assert.equal(props.insectPartitionsReady, true);
  const direct = await createAppHarness('/plant/test/');
  const directProps = direct.route('/plant/:plantName');
  assert.deepEqual(INSECT_COLLECTION_KEYS.map((key) => props[key].length),
    INSECT_COLLECTION_KEYS.map((key) => directProps[key].length));
  assert.ok(INSECT_COLLECTION_KEYS.every((key) => props[key].length === 1));
  app.dispose(); direct.dispose();
});

test('actual App: home → plant loads plant maps and insect → quiz loads all catalogs', async () => {
  const app = await createAppHarness('/');
  await app.navigate('/plant/test/');
  assert.equal(Object.keys(app.route('/plant/:plantName').plantDetails).length, 1);
  const quiz = await createAppHarness('/moth/test/');
  await quiz.navigate('/quiz');
  assert.ok(INSECT_COLLECTION_KEYS.every((key) => quiz.route('/quiz')[key].length === 1));
  app.dispose(); quiz.dispose();
});

test('actual App: partial route data is not rendered as a complete detail page', async () => {
  const app = await createAppHarness('/moth/test/', { pausedFiles: ['catalog/aphids.json'] });
  await app.navigate('/plant/test/');
  assert.equal(app.route('/plant/:plantName'), undefined);
  app.release('catalog/aphids.json');
  await app.settle();
  assert.equal(app.route('/plant/:plantName').insectPartitionsReady, true);
  app.dispose();
});

test('actual App: route changes before manifest arrives are reconciled after bootstrap', async () => {
  const app = await createAppHarness('/moth/test/', { pausedFiles: ['manifest.json'] });
  await app.navigate('/en/plant/test/');
  app.release('manifest.json');
  await app.settle();
  const props = app.route('/en/plant/:plantName');
  assert.ok(props?.insectPartitionsReady);
  assert.ok(INSECT_COLLECTION_KEYS.every((key) => props[key].length === 1));
  app.dispose();
});

test('actual App: failed background plant load exposes a working retry button', async () => {
  const app = await createAppHarness('/', { failedFiles: ['hostplants.json'] });
  app.route('/').onNeedPlantsData();
  await app.settle();
  assert.equal(app.hasAlert(), true);
  app.failed.clear();
  await app.retry();
  assert.equal(app.hasAlert(), false);
  assert.equal(Object.keys(app.route('/').hostPlants).length, 1);
  assert.equal(app.requests.filter((file) => file.endsWith('/hostplants.json')).length, 2);
  app.dispose();
});

test('actual App: failed full-detail upgrade reports failure and retry finishes the route', async () => {
  const app = await createAppHarness('/');
  app.failed.add('moths.json');
  await app.navigate('/moth/test/');
  assert.equal(app.hasAlert(), true);
  assert.equal(app.route('/moth/:mothSlug'), undefined);
  app.failed.clear();
  await app.retry();
  assert.equal(app.hasAlert(), false);
  assert.equal(app.route('/moth/:mothSlug').moths[0]._detail, undefined);
  app.dispose();
});

test('actual App: combined fallback preserves flower-visit data', async () => {
  const app = await createAppHarness('/plant/test/', { failedFiles: ['manifest.json'] });
  const props = app.route('/plant/:plantName');
  assert.equal(JSON.stringify(props.flowerVisitPlants), JSON.stringify(fixtureData.flowerVisitPlants));
  assert.equal(props.insectPartitionsReady, true);
  app.dispose();
});

test('actual App: species content can render while related data waits for every classification', async () => {
  const app = await createAppHarness('/moth/test/', { pausedFiles: ['catalog/aphids.json'] });
  assert.equal(app.route('/moth/:mothSlug').moths[0]._detail, undefined);
  assert.equal(app.route('/moth/:mothSlug').insectPartitionsReady, false);
  app.release('catalog/aphids.json');
  await app.settle();
  assert.equal(app.route('/moth/:mothSlug').insectPartitionsReady, true);
  app.dispose();
});

test('actual App: a full-detail failure does not leave an irrelevant error on the catalog route', async () => {
  const app = await createAppHarness('/');
  app.failed.add('moths.json');
  await app.navigate('/moth/test/');
  assert.equal(app.hasAlert(), true);
  await app.navigate('/');
  assert.ok(app.route('/'));
  assert.equal(app.hasAlert(), false);
  app.dispose();
});

test('actual App: a stale cache is not mixed with a newer manifest', async () => {
  const app = await createAppHarness('/plant/test/', { cache: {
    version: 'old-version', payload: { ...fixtureData, moths: [{ id: 'stale' }] },
  } });
  assert.equal(app.route('/plant/:plantName').moths[0].id, 'moths');
  assert.ok(app.requests.some((file) => file.endsWith('/catalog/moths.json')));
  app.dispose();
});

test('actual App: late fallback failures do not overwrite a successful user retry', async () => {
  const app = await createAppHarness('/moth/test/', {
    failedFiles: ['hostplants.json', 'full-dataset.json', 'index.json'],
    pausedFiles: ['full-dataset.json'],
  });
  assert.equal(app.hasAlert(), true);
  app.failed.delete('hostplants.json');
  await app.retry();
  assert.ok(app.route('/moth/:mothSlug'));
  app.release('full-dataset.json');
  await app.settle();
  assert.equal(app.hasAlert(), false);
  assert.ok(app.route('/moth/:mothSlug'));
  app.dispose();
});
