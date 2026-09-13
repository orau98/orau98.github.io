import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { isKnownDetailPath } from '../src/utils/siteTaxonomy.js';

// Run the actual hook registration with a minimal DOM event dispatcher. A Router
// Link handles navigation at its target/root before the document bubble listener.
function mountTracker() {
  const listeners = [];
  const cleanup = [];
  const selections = [];
  const context = {
    URL,
    useRef: (current) => ({ current }),
    useLocation: () => ({ pathname: '/', search: '' }),
    useEffect: (effect) => cleanup.push(effect()),
    getPageViewPath: () => '/',
    syncAnalyticsPreference: () => false,
    trackPageView: () => true,
    trackLegacyMetaLanding: () => false,
    trackDetailSelection: (selection) => selections.push(selection),
    isKnownDetailPath,
    window: { location: { origin: 'https://orau98.github.io' }, setTimeout: () => 1, clearTimeout: () => {} },
    document: {
      addEventListener: (type, handler, capture) => listeners.push({ type, handler, capture }),
      removeEventListener: (type, handler, capture) => {
        const index = listeners.findIndex((item) => item.type === type && item.handler === handler && item.capture === capture);
        if (index >= 0) listeners.splice(index, 1);
      },
    },
  };
  const source = fs.readFileSync(new URL('../src/components/PageViewTracker.jsx', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '').replace('export default function', 'function');
  vm.runInNewContext(`${source}\nPageViewTracker();`, context);
  return { listeners, selections, unmount: () => cleanup.filter(Boolean).forEach((fn) => fn()) };
}

function click(tracker, overrides = {}, href = 'https://orau98.github.io/plant/クヌギ/') {
  const anchor = { href, target: '', hasAttribute: () => false, closest: () => null };
  const event = { target: { closest: () => anchor }, button: 0, defaultPrevented: false, ...overrides };
  tracker.listeners.filter((item) => item.capture).forEach((item) => item.handler(event));
  event.defaultPrevented = true; // React Router Link's normal navigation handler
  tracker.listeners.filter((item) => !item.capture).forEach((item) => item.handler(event));
}

test('a normal React Router detail click is recorded once before preventDefault', () => {
  const tracker = mountTracker();
  click(tracker);
  assert.equal(tracker.selections.length, 1);
  assert.equal(decodeURIComponent(tracker.selections[0].path), '/plant/クヌギ/');
  tracker.unmount();
  assert.equal(tracker.listeners.length, 0);
});

test('modified clicks, already cancelled clicks, external and non-detail links are excluded', () => {
  const tracker = mountTracker();
  click(tracker, { ctrlKey: true });
  click(tracker, { button: 1 });
  click(tracker, { defaultPrevented: true });
  click(tracker, {}, 'https://example.org/plant/クヌギ/');
  click(tracker, {}, 'https://orau98.github.io/plant/');
  assert.equal(tracker.selections.length, 0);
  tracker.unmount();
});
