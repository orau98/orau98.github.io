import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getAlternateLocalePath,
  getLocaleFromPath,
  localizePath,
  stripLocalePrefix,
} from '../src/utils/locale.js';

test('getLocaleFromPath detects english paths', () => {
  assert.equal(getLocaleFromPath('/'), 'ja');
  assert.equal(getLocaleFromPath('/moth/species-1'), 'ja');
  assert.equal(getLocaleFromPath('/en'), 'en');
  assert.equal(getLocaleFromPath('/en/plant/Fagus%20crenata'), 'en');
});

test('stripLocalePrefix removes only the english prefix', () => {
  assert.equal(stripLocalePrefix('/en'), '/');
  assert.equal(stripLocalePrefix('/en/moth/species-1'), '/moth/species-1');
  assert.equal(stripLocalePrefix('/plant/Fagus%20crenata'), '/plant/Fagus%20crenata');
});

test('localizePath preserves query strings and toggles locale prefixes', () => {
  assert.equal(localizePath('/?tab=plants', 'ja'), '/?tab=plants');
  assert.equal(localizePath('/?tab=plants', 'en'), '/en?tab=plants');
  assert.equal(localizePath('/moth/species-1', 'en'), '/en/moth/species-1');
  assert.equal(localizePath('/en/moth/species-1', 'ja'), '/moth/species-1');
});

test('getAlternateLocalePath swaps between japanese and english routes', () => {
  assert.equal(getAlternateLocalePath('/en/moth/species-1?q=test', 'en'), '/moth/species-1?q=test');
  assert.equal(getAlternateLocalePath('/plant/Fagus%20crenata', 'ja'), '/en/plant/Fagus%20crenata');
});
