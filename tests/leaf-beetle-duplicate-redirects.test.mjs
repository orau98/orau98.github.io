import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import Papa from 'papaparse';

import { slugifyScientificLabel } from '../scripts/lib/englishNaming.mjs';
import {
  loadLeafBeetleMergedTaxonRedirects,
  loadMergedTaxonRedirects,
} from '../scripts/lib/mergedTaxonRedirects.mjs';

const LEAF_AUDIT_PATH = 'data/source_audits/leaf-beetle-canonical-taxonomy-merge-2026-07-12.json';
const KAMIKIRI_AUDIT_PATH = 'data/source_audits/japanese-longhorn-beetles-2007.csv';
const BUTTERFLY_AUDIT_PATH = 'data/source_audits/butterfly-canonical-taxonomy-merge-2026-07-12.json';
const parsed = Papa.parse(fs.readFileSync('normalized_data/insects.csv', 'utf8'), {
  header: true,
  skipEmptyLines: true,
});
const insectsById = new Map(parsed.data.map((row) => [row.insect_id, row]));
const redirects = loadLeafBeetleMergedTaxonRedirects(LEAF_AUDIT_PATH);

test('13 leaf-beetle legacy IDs and scientific slugs resolve uniquely to live canonical taxa', () => {
  assert.deepEqual(parsed.errors, []);
  assert.equal(redirects.length, 13);
  assert.equal(new Set(redirects.map(({ duplicateId }) => duplicateId)).size, 13);
  const legacyScientificSlugs = new Set();
  const legacyNamedRoutes = new Set();
  for (const redirect of redirects) {
    assert.equal(insectsById.has(redirect.duplicateId), false, redirect.duplicateId);
    const canonical = insectsById.get(redirect.canonicalId);
    assert.ok(canonical, redirect.canonicalId);
    assert.equal(canonical.family, 'Chrysomelidae');
    assert.equal(redirect.taxonGroup, 'leafbeetle');
    assert.equal(redirect.englishTypeLabel, 'Leaf Beetle');

    const legacySlug = slugifyScientificLabel(redirect.legacyScientificName);
    const canonicalSlug = slugifyScientificLabel(canonical.scientific_name);
    assert.ok(legacySlug, redirect.auditId);
    assert.notEqual(legacySlug, canonicalSlug, redirect.auditId);
    assert.equal(legacyScientificSlugs.has(legacySlug), false, legacySlug);
    legacyScientificSlugs.add(legacySlug);
    legacyNamedRoutes.add(redirect.legacyDisplayName);
    legacyNamedRoutes.add(redirect.legacyRouteName);

    if (redirect.duplicateId !== 'species-H676') {
      assert.ok(canonical.synonyms.split('; ').includes(redirect.legacyScientificName), redirect.auditId);
    }
    if (
      redirect.duplicateJapaneseName
      && redirect.duplicateJapaneseName !== canonical.japanese_name
    ) assert.ok(canonical.other_names.split('; ').includes(redirect.duplicateJapaneseName), redirect.auditId);
  }
  assert.equal(legacyScientificSlugs.size, 13);
  // H033 and H808 share the same historical Japanese route name and both
  // resolve to H032, so that same-target named route is intentionally deduped.
  assert.equal(legacyNamedRoutes.size, 12);
  assert.deepEqual(
    redirects.filter(({ canonicalId }) => canonicalId === 'species-H032')
      .map(({ duplicateId }) => duplicateId),
    ['species-H808', 'species-H033'],
  );
});

test('the fake Hemipyxis spelling redirects old URLs but is never a searchable synonym', () => {
  const redirect = redirects.find(({ duplicateId }) => duplicateId === 'species-H676');
  assert.equal(redirect.canonicalId, 'species-H089');
  assert.equal(redirect.legacyDisplayName, 'ヒゲナガマルノミハムシ');
  assert.equal(redirect.legacyScientificName, 'Hemipyxis hegenagae');
  const canonical = insectsById.get(redirect.canonicalId);
  assert.match(canonical.other_names, /ヒゲナガマルノミハムシ/);
  assert.doesNotMatch(canonical.synonyms, /hegenagae/i);
});

test('the generic redirect inventory preserves all canonical taxon merges', () => {
  const all = loadMergedTaxonRedirects({
    kamikiriPath: KAMIKIRI_AUDIT_PATH,
    leafBeetlePath: LEAF_AUDIT_PATH,
    butterflyPath: BUTTERFLY_AUDIT_PATH,
  });
  assert.equal(all.length, 111);
  assert.equal(all.filter(({ taxonGroup }) => taxonGroup === 'longhornbeetle').length, 97);
  assert.equal(all.filter(({ taxonGroup }) => taxonGroup === 'leafbeetle').length, 13);
  assert.equal(all.filter(({ taxonGroup }) => taxonGroup === 'butterfly').length, 1);
  assert.equal(new Set(all.map(({ duplicateId }) => duplicateId)).size, 111);
});

test('meta generators and the postbuild guard use permanent taxonomy-merge redirects', () => {
  for (const filePath of [
    'scripts/generate-meta-pages.js',
    'scripts/generate-meta-en-pages.mjs',
  ]) {
    const source = fs.readFileSync(filePath, 'utf8');
    assert.match(source, /loadMergedTaxonRedirects/);
    assert.match(source, /redirectKind:\s*'taxonomy-merge'/);
  }
  const postbuild = fs.readFileSync('scripts/postbuild-cleanup.mjs', 'utf8');
  assert.match(postbuild, /x-redirect-kind" content="taxonomy-merge/);
  assert.match(postbuild, /preservedTaxonomyRedirects/);
});
