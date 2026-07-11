import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import Papa from 'papaparse';

import { slugifyScientificLabel } from '../scripts/lib/englishNaming.mjs';
import { loadKamikiriMergedTaxonRedirects } from '../scripts/lib/kamikiriAuditRedirects.mjs';

const parsed = Papa.parse(fs.readFileSync('normalized_data/insects.csv', 'utf8'), {
  header: true,
  skipEmptyLines: true,
});
const insectsById = new Map(parsed.data.map((row) => [row.insect_id, row]));
const redirects = loadKamikiriMergedTaxonRedirects(
  'data/source_audits/japanese-longhorn-beetles-2007.csv',
);

test('統合した97旧IDは正本へ一意に対応し、旧学名スラグも衝突しない', () => {
  assert.deepEqual(parsed.errors, []);
  assert.equal(redirects.length, 97);
  assert.equal(new Set(redirects.map((row) => row.duplicateId)).size, redirects.length);

  const legacyEnglishSlugs = new Set();
  const legacyNamedRoutes = new Set();
  for (const redirect of redirects) {
    assert.equal(insectsById.has(redirect.duplicateId), false, redirect.duplicateId);
    const canonical = insectsById.get(redirect.canonicalId);
    assert.ok(canonical, redirect.canonicalId);
    assert.equal(canonical.family, 'Cerambycidae');

    assert.equal(redirect.duplicateJapaneseName, redirect.legacyJapaneseName, redirect.auditId);
    assert.equal(
      redirect.legacyDisplayName,
      redirect.legacyJapaneseName || redirect.legacyScientificName,
      redirect.auditId,
    );
    assert.ok(redirect.legacyRouteName, redirect.auditId);
    legacyNamedRoutes.add(redirect.legacyDisplayName);
    legacyNamedRoutes.add(redirect.legacyRouteName);

    const legacySlug = slugifyScientificLabel(redirect.legacyScientificName);
    const canonicalSlug = slugifyScientificLabel(canonical.scientific_name);
    assert.ok(legacySlug);
    assert.notEqual(legacySlug, canonicalSlug, redirect.auditId);
    assert.equal(legacyEnglishSlugs.has(legacySlug), false, legacySlug);
    legacyEnglishSlugs.add(legacySlug);
  }
  assert.equal(legacyNamedRoutes.size, 98);

  const glaphyra = redirects.find((row) => row.duplicateId === 'species-22101');
  assert.equal(glaphyra.legacyDisplayName, 'オキナワシバタヒゲナガコバネカミキリ');
  assert.equal(
    slugifyScientificLabel(glaphyra.legacyScientificName),
    'glaphyra-glaphyra-shibatai-okinawana',
  );

  const kuri = redirects.find((row) => row.duplicateId === 'species-22610');
  assert.equal(kuri.legacyJapaneseName, '');
  assert.equal(kuri.legacyDisplayName, 'Sybra sakamotoi kuri Ohbayashi & Hayashi, 1962');

  const futaobi = redirects.find((row) => row.duplicateId === 'species-22362');
  assert.equal(futaobi.legacyDisplayName, 'Pidonia (Omphalodera) puziloi (Solsky, 1873)');
  assert.equal(futaobi.legacyRouteName, 'フタオビチビハナカミキリ');
});
