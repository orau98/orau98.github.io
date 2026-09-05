import test from 'node:test';
import assert from 'node:assert/strict';
import { createDataPartitionLoader, isCompleteDatasetPayload } from '../src/services/dataPartitionLoader.js';
import { planInitialDataLoad, isRouteDataReady } from '../src/utils/dataLitePlan.js';
import { INSECT_COLLECTION_KEYS } from '../src/utils/siteTaxonomy.js';

const dataset = () => ({
  ...Object.fromEntries(INSECT_COLLECTION_KEYS.map((key) => [key, [{ id: key, name: key }]])),
  hostPlants: { テスト植物: [...INSECT_COLLECTION_KEYS] },
  plantDetails: { テスト植物: { family: 'ブナ科' } },
  flowerVisitPlants: { 花: ['moths'] },
});
const harness = (overrides = {}) => {
  const data = dataset();
  const files = new Map([
    ['hostplants.json', data.hostPlants], ['plant-details.json', data.plantDetails],
    ['flower-visit-plants.json', data.flowerVisitPlants],
    ...INSECT_COLLECTION_KEYS.flatMap((key) => [
      [`${key}.json`, data[key]], [`catalog/${key}.json`, data[key].map((row) => ({ ...row, _detail: false }))],
    ]),
  ]);
  const requests = [];
  const failures = new Set();
  const delivered = {};
  const saved = [];
  const loader = createDataPartitionLoader({
    readJson: async (file) => {
      requests.push(file);
      if (failures.has(file)) throw new Error(`404: ${file}`);
      return files.get(file);
    },
    onCollection: (key, records) => { delivered[key] = records; },
    onPlants: (plants) => Object.assign(delivered, plants),
    onComplete: (payload) => saved.push(payload),
    ...overrides,
  });
  return { loader, requests, failures, delivered, saved, files };
};
const ensureRoute = (loader, pathname) => loader.ensurePlan(planInitialDataLoad({ pathname }));

test('cold insect → plant and direct plant routes deliver the same seven classifications', async () => {
  const h = harness();
  await ensureRoute(h.loader, '/moth/テストガ/');
  assert.equal(h.loader.getState().collectionLevels.moths, 'full');
  assert.equal(Object.keys(h.loader.getState().collectionLevels).length, 1);
  assert.equal(isRouteDataReady(h.loader.getState(), '/plant/テスト植物/'), false);
  await ensureRoute(h.loader, '/plant/テスト植物/');
  assert.equal(isRouteDataReady(h.loader.getState(), '/plant/テスト植物/'), true);
  assert.equal(h.delivered.moths[0]._detail, undefined, 'catalog cannot downgrade full moths');
  const direct = harness();
  await ensureRoute(direct.loader, '/plant/テスト植物/');
  assert.deepEqual(INSECT_COLLECTION_KEYS.flatMap((k) => h.delivered[k].map((r) => r.id)),
    INSECT_COLLECTION_KEYS.flatMap((k) => direct.delivered[k].map((r) => r.id)));
});

test('home → plant and insect → quiz fetch all required data, including English routes', async () => {
  for (const [from, to] of [['/', '/plant/テスト/'], ['/moth/テスト/', '/quiz'], ['/en/moth/test/', '/en/plant/test/']]) {
    const h = harness();
    await ensureRoute(h.loader, from);
    await ensureRoute(h.loader, to);
    assert.equal(isRouteDataReady(h.loader.getState(), to), true);
    assert.equal(Object.keys(h.loader.getState().collectionLevels).length, 7);
    assert.deepEqual(h.delivered.flowerVisitPlants, dataset().flowerVisitPlants);
  }
});

test('a failed plant request is retried; successful companion partitions are retained', async () => {
  const h = harness();
  h.failures.add('hostplants.json');
  await h.loader.ensurePlants();
  assert.equal(h.loader.getState().plantsReady, false);
  assert.ok(h.loader.getState().errors.hostPlants);
  h.failures.clear();
  await h.loader.retryFailures();
  assert.equal(h.loader.getState().plantsReady, true);
  assert.deepEqual(h.loader.getState().errors, {});
  assert.equal(h.requests.filter((file) => file === 'hostplants.json').length, 2);
  assert.equal(h.requests.filter((file) => file === 'plant-details.json').length, 1);
});

test('malformed or missing flower/profile JSON is not treated as an empty successful response', async () => {
  for (const [file, key] of [['plant-details.json', 'plantDetails'], ['flower-visit-plants.json', 'flowerVisitPlants']]) {
    const h = harness();
    h.files.set(file, null);
    await h.loader.ensurePlants();
    assert.equal(h.loader.getState().plantsReady, false);
    assert.ok(h.loader.getState().errors[key]);
    h.files.set(file, {});
    await h.loader.ensurePlants();
    assert.equal(h.loader.getState().plantsReady, true, 'a genuinely empty map is valid');
  }
});

test('one malformed classification does not discard six successful responses or cache partial data', async () => {
  const h = harness();
  h.files.set('catalog/beetles.json', { invalid: true });
  await Promise.all([h.loader.ensureTypes(), h.loader.ensurePlants()]);
  assert.equal(Object.keys(h.loader.getState().collectionLevels).length, 6);
  assert.equal(h.saved.length, 0);
  h.files.set('catalog/beetles.json', []);
  await h.loader.retryFailures();
  assert.equal(Object.keys(h.loader.getState().collectionLevels).length, 7);
  assert.equal(h.saved.length, 1);
  assert.deepEqual(h.saved[0].beetles, []);
  assert.equal(h.requests.filter((file) => file === 'catalog/moths.json').length, 1);
});

test('a catalog-to-full failure stays incomplete for detail routes and can recover', async () => {
  const h = harness();
  await ensureRoute(h.loader, '/');
  h.failures.add('moths.json');
  await ensureRoute(h.loader, '/moth/テスト/');
  assert.equal(isRouteDataReady(h.loader.getState(), '/moth/テスト/'), false);
  assert.ok(h.delivered.moths.length, 'successful catalog remains available');
  h.failures.clear();
  await h.loader.retryFailures();
  assert.equal(isRouteDataReady(h.loader.getState(), '/moth/テスト/'), true);
});

test('concurrent catalog/full requests deduplicate and never downgrade the full data', async () => {
  const h = harness();
  await Promise.all([h.loader.ensureTypes(['moths']), h.loader.ensureTypes(['moths']),
    h.loader.ensureTypes(['moths'], 'full'), h.loader.ensureTypes(['moths'], 'full')]);
  assert.deepEqual(h.requests, ['catalog/moths.json', 'moths.json']);
  assert.equal(h.loader.getState().collectionLevels.moths, 'full');
  await h.loader.ensureTypes(['moths']);
  assert.equal(h.requests.length, 2);
});

test('concurrent failed calls and synchronous exceptions release guards without silent retry loops', async () => {
  let calls = 0;
  const h = harness({ readJson: () => { calls += 1; throw new Error('offline'); } });
  await Promise.all([h.loader.ensureTypes(['moths']), h.loader.ensureTypes(['moths'])]);
  assert.equal(calls, 1);
  await h.loader.retryFailures();
  assert.equal(calls, 2);
});

test('a failed full request does not satisfy or prevent a queued catalog request', async () => {
  const h = harness();
  h.failures.add('moths.json');
  await Promise.all([h.loader.ensureTypes(['moths'], 'full'), h.loader.ensureTypes(['moths'], 'catalog')]);
  assert.equal(h.loader.getState().collectionLevels.moths, 'catalog');
  assert.ok(h.requests.includes('catalog/moths.json'));
});

test('combined fallback/cache preserves flower maps and rejects incomplete payloads', async () => {
  const data = dataset();
  assert.equal(isCompleteDatasetPayload(data), true);
  assert.equal(isCompleteDatasetPayload({ moths: [], butterflies: [] }), false);
  assert.equal(isCompleteDatasetPayload({ ...data, flowerVisitPlants: [] }), false);
  const h = harness({ initialPayload: data });
  await ensureRoute(h.loader, '/plant/テスト/');
  assert.equal(h.requests.length, 0);
  assert.deepEqual(h.delivered.flowerVisitPlants, data.flowerVisitPlants);
});

test('plant partitions arriving after all catalogs still cause a complete cache save', async () => {
  const h = harness();
  await h.loader.ensureTypes();
  assert.equal(h.saved.length, 0);
  await h.loader.ensurePlants();
  assert.equal(h.saved.length, 1);
  assert.ok(isCompleteDatasetPayload(h.saved[0]));
});

test('superseded requests cannot publish state or persist stale data', async () => {
  let active = true;
  const h = harness({ isActive: () => active });
  const pending = h.loader.ensureTypes();
  active = false;
  await pending;
  assert.deepEqual(h.delivered, {});
  assert.equal(h.saved.length, 0);
});
