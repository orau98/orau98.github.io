import fs from 'node:fs';

import { loadKamikiriMergedTaxonRedirects } from './kamikiriAuditRedirects.mjs';

const clean = (value) => String(value ?? '').trim();
const splitSemicolon = (value) => clean(value).split(/[;；]/).map((item) => item.trim()).filter(Boolean);

export function loadLeafBeetleMergedTaxonRedirects(filePath) {
  const audit = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (
    audit.schema_version !== 1
    || audit.audit_name !== 'ハムシ科重複分類群の正準ID統合監査'
    || audit.counts?.mappings !== 13
    || audit.counts?.canonical_search_name_updates !== 12
    || audit.counts?.duplicate_taxon_deletions !== 13
    || audit.counts?.canonical_merge_insect_actions !== 25
    || audit.counts?.verified_name_actions !== 2
    || audit.counts?.insect_actions !== 27
    || audit.mappings?.length !== 13
  ) throw new Error(`${filePath}: unexpected leaf-beetle canonical-merge ledger`);

  const deletedById = new Map(
    audit.insect_actions
      .filter(({ action }) => action === 'delete_duplicate_taxon')
      .map((entry) => [clean(entry.before?.insect_id), entry]),
  );
  const canonicalPatchById = new Map(
    audit.insect_actions
      .filter(({ action }) => action === 'update_canonical_search_names')
      .map((entry) => [clean(entry.after?.insect_id), entry]),
  );
  if (canonicalPatchById.size !== 12 || deletedById.size !== 13) {
    throw new Error(`${filePath}: canonical patches and duplicate deletions do not match the merge graph`);
  }
  const redirects = audit.mappings.map(({ duplicate_id: duplicateIdRaw, canonical_id: canonicalIdRaw }) => {
    const duplicateId = clean(duplicateIdRaw);
    const canonicalId = clean(canonicalIdRaw);
    const deletion = deletedById.get(duplicateId);
    const canonicalPatch = canonicalPatchById.get(canonicalId);
    const duplicate = deletion?.before;
    const canonicalBefore = canonicalPatch?.before;
    const canonicalAfter = canonicalPatch?.after;
    if (!duplicate || !canonicalBefore || !canonicalAfter) {
      throw new Error(`${filePath}: incomplete action chain for ${duplicateId} -> ${canonicalId}`);
    }
    const duplicateJapaneseName = clean(duplicate.japanese_name);
    const legacyScientificName = clean(duplicate.scientific_name);
    const sourceJapaneseName = duplicateJapaneseName || clean(canonicalBefore.japanese_name);
    const legacyDisplayName = duplicateJapaneseName || legacyScientificName;
    const legacyRouteName = duplicateJapaneseName || legacyScientificName;
    if (!duplicateId || !canonicalId || duplicateId === canonicalId || !legacyScientificName || !legacyDisplayName) {
      throw new Error(`${filePath}: invalid leaf-beetle redirect ${duplicateId} -> ${canonicalId}`);
    }
    const retainedSynonyms = splitSemicolon(canonicalAfter.synonyms);
    if (duplicateId === 'species-H676') {
      if (retainedSynonyms.some((name) => /hegenagae/i.test(name))) {
        throw new Error(`${filePath}: fabricated Hemipyxis spelling leaked into synonyms`);
      }
      if (!splitSemicolon(canonicalAfter.other_names).includes(duplicateJapaneseName)) {
        throw new Error(`${filePath}: H676 Japanese route name was not retained`);
      }
    } else if (!retainedSynonyms.includes(legacyScientificName)) {
      throw new Error(`${filePath}: former scientific name is not retained: ${legacyScientificName}`);
    }
    if (
      duplicateJapaneseName
      && duplicateJapaneseName !== clean(canonicalBefore.japanese_name)
      && !splitSemicolon(canonicalAfter.other_names).includes(duplicateJapaneseName)
    ) throw new Error(`${filePath}: former Japanese name is not retained: ${duplicateJapaneseName}`);
    return {
      auditId: clean(deletion.action_id),
      duplicateId,
      canonicalId,
      duplicateJapaneseName,
      sourceJapaneseName,
      sourceTaxon: legacyScientificName,
      legacyJapaneseName: duplicateJapaneseName,
      legacyScientificName,
      legacyRouteName,
      legacyDisplayName,
      taxonGroup: 'leafbeetle',
      englishTypeLabel: 'Leaf Beetle',
    };
  });
  const duplicateIds = new Set(redirects.map(({ duplicateId }) => duplicateId));
  if (duplicateIds.size !== redirects.length || deletedById.size !== redirects.length) {
    throw new Error(`${filePath}: duplicate or unrepresented leaf-beetle redirect ID`);
  }
  return redirects;
}

export function loadMergedTaxonRedirects({ kamikiriPath, leafBeetlePath }) {
  const redirects = [
    ...loadKamikiriMergedTaxonRedirects(kamikiriPath).map((redirect) => ({
      ...redirect,
      taxonGroup: 'longhornbeetle',
      englishTypeLabel: 'Longhorn Beetle',
    })),
    ...loadLeafBeetleMergedTaxonRedirects(leafBeetlePath),
  ];
  const duplicateIds = new Set();
  for (const redirect of redirects) {
    if (duplicateIds.has(redirect.duplicateId)) {
      throw new Error(`merged taxon redirect ID is duplicated across ledgers: ${redirect.duplicateId}`);
    }
    duplicateIds.add(redirect.duplicateId);
  }
  return redirects;
}
