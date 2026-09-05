import test from 'node:test';
import assert from 'node:assert/strict';
import { fitNetworkBounds, groupNetwork, networkGroup, searchNetworkNodes, endpointId } from '../src/utils/networkView.js';

const plant = { id: 'plant:p', name: 'ハンノキ', type: 'plant-current', x: 0, y: 0 };
const insect = (i, family = 'ヤガ科') => ({ id: `insect:${i}`, name: `昆虫${i}`, type: 'insect-host', x: Math.cos(i) * 160, y: Math.sin(i) * 160, raw: { classification: { familyJapanese: family, family: family === 'ヤガ科' ? 'Noctuidae' : 'Geometridae' } } });
const makeData = (n = 77) => {
  const nodes = [plant, ...Array.from({ length: n }, (_, i) => insect(i, i < 40 ? 'ヤガ科' : 'シャクガ科'))];
  return { nodes, links: nodes.slice(1).map((node, i) => ({ source: plant.id, target: node.id, relation: ['host', 'flower', 'both', 'unknown'][i % 4] })), summary: { primaryTotal: n } };
};

test('small networks remain individual and keep the exact source graph', () => {
  const data = makeData(8);
  const view = groupNetwork(data);
  assert.equal(view.nodes, data.nodes);
  assert.equal(view.links, data.links);
  assert.deepEqual(view.groups, []);
});

test('dense network groups preserve every species and relationship category', () => {
  const data = makeData();
  const before = JSON.stringify(data);
  const view = groupNetwork(data);
  assert.equal(view.groups.length, 2);
  assert.equal(view.nodes.length, 3);
  assert.equal(view.nodes[0].id, plant.id);
  assert.equal(view.groups.reduce((n, group) => n + group.members.length, 0), 77);
  for (const relation of ['host', 'flower', 'both', 'unknown']) {
    assert.equal(view.links.filter(link => link.relation === relation).reduce((n, link) => n + link.count, 0), data.links.filter(link => link.relation === relation).length);
  }
  assert.equal(JSON.stringify(data), before);
  assert.ok(view.links.every(link => view.nodes.some(node => node.id === link.source) && view.nodes.some(node => node.id === link.target)));
});

test('expanding a family reveals all its species without losing other families', () => {
  const data = makeData();
  const id = networkGroup(data.nodes[1]).id;
  const view = groupNetwork(data, { expanded: new Set([id]) });
  assert.equal(view.nodes.filter(node => node.type.startsWith('insect')).length, 40);
  assert.equal(view.nodes.filter(node => node.type === 'group').length, 1);
  assert.equal(view.links.reduce((n, link) => n + link.count, 0), 77);
  const all = groupNetwork(data, { enabled: false });
  assert.equal(all.nodes.length, 78);
  assert.equal(all.links.length, 77);
});

test('one species shared by multiple plants is counted once, its links separately', () => {
  const data = makeData();
  const secondPlant = { ...plant, id: 'plant:q', name: 'アカソ', type: 'plant-host' };
  data.nodes.push(secondPlant);
  data.links.push({ source: secondPlant.id, target: data.nodes[1].id, relation: 'host' });
  const view = groupNetwork(data);
  assert.equal(view.groups.reduce((n, group) => n + group.members.length, 0), 77);
  assert.equal(view.links.reduce((n, link) => n + link.count, 0), 78);
});

test('grouping supports force-graph object endpoints and does not mutate them', () => {
  const data = makeData();
  data.links[0].source = plant;
  data.links[0].target = data.nodes[1];
  const view = groupNetwork(data);
  assert.equal(endpointId(data.links[0].source), plant.id);
  assert.equal(view.links.reduce((n, link) => n + link.count, 0), 77);
  assert.equal(data.links[0].target, data.nodes[1]);
});

test('unclassified species stay explicitly unclassified; current insect is never grouped', () => {
  const nodes = Array.from({ length: 40 }, (_, i) => ({ ...insect(i), raw: null }));
  nodes[0].type = 'insect-current';
  const data = { nodes, links: [] };
  const view = groupNetwork(data);
  assert.equal(view.nodes[0].id, nodes[0].id);
  assert.equal(view.groups[0].label, '昆虫（分類未登録）');
  assert.equal(view.groups[0].members.length, 39);
});

test('search includes grouped species and Japanese, scientific, family names', () => {
  const data = makeData();
  data.nodes[1] = { ...data.nodes[1], name: 'サカハチチョウ', raw: { scientificName: 'Araschnia burejana', classification: { familyJapanese: 'タテハチョウ科' } } };
  assert.equal(searchNetworkNodes(data.nodes, 'さかはち')[0].id, data.nodes[1].id);
  assert.equal(searchNetworkNodes(data.nodes, 'ARASCHNIA BUREJANA')[0].id, data.nodes[1].id);
  assert.equal(searchNetworkNodes(data.nodes, 'タテハチョウ科')[0].id, data.nodes[1].id);
  assert.equal(searchNetworkNodes(data.nodes, '').length, 78);
  assert.equal(searchNetworkNodes(data.nodes, '該当しない種').length, 0);
});

for (const [width, height] of [[1190, 640], [880, 640], [366, 250], [620, 410]]) {
  test(`fit includes painted circles and full labels at ${width}x${height}`, () => {
    const nodes = [plant, ...makeData(8).nodes.slice(1).map(node => ({ ...node, name: 'タイワンキシタアツバ' }))];
    const fit = fitNetworkBounds(nodes, width, height);
    assert.ok(fit.zoom <= 2.1);
    assert.ok(fit.bounds.right - fit.bounds.left <= width - 32 + 0.001);
    assert.ok(fit.bounds.bottom - fit.bounds.top <= height - 32 + 0.001);
    const left = fit.bounds.left - fit.x * fit.zoom + width / 2;
    const top = fit.bounds.top - fit.y * fit.zoom + height / 2;
    assert.ok(left >= 15.99 && top >= 15.99);
  });
}

test('empty and unpositioned graphs are safe; single nodes do not overzoom', () => {
  assert.equal(fitNetworkBounds([], 500, 500), null);
  assert.equal(fitNetworkBounds([{ name: '不明', type: 'insect' }], 500, 500), null);
  assert.equal(fitNetworkBounds([plant], 0, 500), null);
  assert.equal(fitNetworkBounds([plant], 20, 500), null);
  assert.ok(fitNetworkBounds([plant], 1200, 800).zoom <= 2.1);
});
