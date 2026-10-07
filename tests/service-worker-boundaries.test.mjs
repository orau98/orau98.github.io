import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const origin = 'https://example.test';
const shellUrl = origin + '/';

class MockRequest {
  constructor(input, options = {}) {
    Object.assign(this, { method: 'GET', mode: 'cors', destination: '' },
      typeof input === 'string' ? { url: input } : input, options);
    this.url = new URL(this.url, origin).href;
  }
}

class MockResponse {
  constructor(body) { this.body = body; this.ok = true; this.type = 'basic'; }
  clone() { return new MockResponse(this.body); }
}

const keyOf = (request) => typeof request === 'string' ? request : request.url;

class MockCache {
  entries = new Map();
  async put(request, response) { this.entries.set(keyOf(request), response); }
  async match(request, options = {}) {
    const key = keyOf(request);
    if (!options.ignoreSearch) return this.entries.get(key);
    const wanted = new URL(key);
    return [...this.entries].find(([url]) => {
      const candidate = new URL(url);
      return candidate.origin === wanted.origin && candidate.pathname === wanted.pathname;
    })?.[1];
  }
  async keys() { return [...this.entries.keys()].map((url) => new MockRequest(url)); }
  async delete(request) { return this.entries.delete(keyOf(request)); }
}

function createHarness(cacheNames = []) {
  const handlers = new Map();
  const stores = new Map(cacheNames.map((name) => [name, new MockCache()]));
  const networkCalls = [];
  let offline = false;
  let body = 'root shell';
  const caches = {
    async keys() { return [...stores.keys()]; },
    async open(name) {
      if (!stores.has(name)) stores.set(name, new MockCache());
      return stores.get(name);
    },
    async delete(name) { return stores.delete(name); },
  };
  const self = {
    location: { href: origin + '/sw.js', origin },
    addEventListener(type, handler) { handlers.set(type, handler); },
    skipWaiting() {},
    clients: { async claim() {} },
  };
  vm.runInNewContext(source, {
    self, caches, URL, Request: MockRequest,
    async fetch(request) {
      networkCalls.push(request.url);
      if (offline) throw new Error('synthetic offline');
      return new MockResponse(body);
    },
  }, { timeout: 1000 });
  return {
    stores, networkCalls, caches,
    setNetwork(nextBody, isOffline = false) { body = nextBody; offline = isOffline; },
    async activate() {
      const pending = [];
      handlers.get('activate')({ waitUntil(promise) { pending.push(promise); } });
      await Promise.all(pending);
    },
    async request(pathname, mode = 'navigate') {
      let response;
      const pending = [];
      handlers.get('fetch')({
        request: new MockRequest(origin + pathname, { mode }),
        respondWith(promise) { response = promise; },
        waitUntil(promise) { pending.push(promise); },
      });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
  };
}

test('activation deletes only old ihpe caches and preserves another app cache', async () => {
  const harness = createHarness(['ihpe-offline-v1', 'ihpe-images-v1', 'ihpe-offline-v0', 'other-app-v1']);
  await harness.activate();
  assert.deepEqual([...harness.stores.keys()].sort(), ['ihpe-images-v1', 'ihpe-offline-v1', 'other-app-v1']);
});

test('a static page cannot replace the root shell used for offline navigation', async () => {
  const harness = createHarness();
  await harness.request('/?tab=plants');
  const cache = await harness.caches.open('ihpe-offline-v1');
  assert.equal((await cache.match(shellUrl)).body, 'root shell');
  harness.setNetwork('static detail HTML');
  await harness.request('/meta/plant/example.html');
  assert.equal((await cache.match(origin + '/meta/plant/example.html')).body, 'static detail HTML');
  assert.equal((await cache.match(shellUrl)).body, 'root shell');
  harness.setNetwork('', true);
  assert.equal((await harness.request('/plant/uncached/')).body, 'root shell');
});

test('the separate Pages project is passed through without fetching or caching', async () => {
  const harness = createHarness();
  for (const pathname of ['/hirokiakimoto.github.io', '/hirokiakimoto.github.io/', '/hirokiakimoto.github.io/images/example.png']) {
    assert.equal(await harness.request(pathname), undefined);
  }
  assert.deepEqual(harness.networkCalls, []);
  assert.equal(harness.stores.size, 0);
});
