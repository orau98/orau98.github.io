import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const dist = path.resolve('dist');
const read = (name) => fs.readFileSync(path.join(dist, name), 'utf8');
const section = (html, name) => html.match(new RegExp(`<section class="${name}">([\\s\\S]*?)<\\/section>`))?.[1] || '';
const listCount = (html) => [...html.matchAll(/<li[ >]/g)].length;
const ja = read('meta/butterfly/species-20176.html');
const canonical = ja.match(/<link rel="canonical" href="https:\/\/orau98.github.io([^"?#]+)"/)?.[1];
assert.ok(canonical, 'Graphium canonical is present');
const clean = read(`${decodeURIComponent(canonical).replace(/^\//, '')}index.html`);
for (const html of [clean]) {
  assert.equal(listCount(section(html, 'host-plants')), 15, 'Graphium host list: 15 entries');
  assert.equal(listCount(section(html, 'flower-visits')), 8, 'Graphium flower list: 8 entries');
  assert.doesNotMatch(section(html, 'host-plants'), /ヤブガラシ|ダイコン/);
  assert.match(section(html, 'flower-visits'), /ヤブガラシ/);
  assert.match(html, /<dd>15項目<\/dd>/);
  assert.doesNotMatch(html, /食草[^<>\n]{0,40}23種/);
}
// Compatibility shells retain the head; the clean route retains static body content.
for (const html of [ja, clean]) {
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  const species = schemas.find((item) => Array.isArray(item['@type']) && item['@type'].includes('Animal'));
  assert.match(species.description, /15項目/);
  assert.match(species.description, /訪花記録を8項目/);
}
const enLegacy = read('en/meta/butterfly/graphium-sarpedon-linnaeus-1758.html');
const enCanonical = enLegacy.match(/<link rel="canonical" href="https:\/\/orau98.github.io([^"?#]+)"/)?.[1];
assert.ok(enCanonical);
const en = read(`${decodeURIComponent(enCanonical).replace(/^\//, '')}index.html`);
assert.equal(listCount(section(en, 'host-plants')), 15);
assert.equal(listCount(section(en, 'flower-visits')), 8);
assert.doesNotMatch(en, /Recorded larval host plants/);
const vine = read('plant/ヤブガラシ/index.html');
const insectRows = [...section(vine, 'related-insects').matchAll(/<li>([\s\S]*?)<\/li>/g)];
const graphiumRows = insectRows.filter((match) => match[1].includes('アオスジアゲハ'));
assert.equal(graphiumRows.length, 1, 'one insect row per species, regardless of source count');
assert.match(graphiumRows[0][1], /<div class="plant-use">成虫の訪花<\/div>/);
let checked = 0;
for (const name of fs.readdirSync(path.join(dist, 'meta/plant'))) {
  if (!name.endsWith('.html')) continue;
  const html = fs.readFileSync(path.join('public/meta/plant', name), 'utf8');
  if (!html.includes('class="plant-use"')) continue;
  assert.doesNotMatch(html, /<div class="plant-use">\s*<\/div>/, `unclassified relation in ${name}`);
  checked += 1;
}
const fruit = read('guides/categories/fruit-trees.html');
assert.match(fruit, /<link rel="canonical" href="https:\/\/orau98.github.io\/plant\/">/);
assert.match(fruit, /content="0;url=https:\/\/orau98.github.io\/plant\/"/);
console.log(`[audit-plant-usage] Graphium JA/EN, clean/legacy, reverse lookup and fruit entry OK; ${checked} plant pages checked`);
