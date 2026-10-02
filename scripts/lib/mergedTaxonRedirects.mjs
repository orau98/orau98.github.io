import fs from 'node:fs';

import { EN_TYPE_LABELS } from './englishNaming.mjs';
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

export function loadButterflyMergedTaxonRedirects(filePath) {
  const audit = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (
    audit.schema_version !== 1
    || audit.audit_name !== '蝶類重複分類群の正準ID統合追補'
    || audit.counts?.mappings !== 1
    || audit.counts?.duplicate_taxon_deletions !== 1
    || audit.counts?.duplicate_hostplant_deletions !== 8
    || audit.counts?.duplicate_note_deletions !== 1
    || audit.mappings?.length !== 1
  ) throw new Error(`${filePath}: unexpected butterfly canonical-merge ledger`);

  return audit.mappings.map((mapping) => {
    const duplicateId = clean(mapping.duplicate_id);
    const canonicalId = clean(mapping.canonical_id);
    const japaneseName = clean(mapping.japanese_name);
    const scientificName = clean(mapping.scientific_name);
    if (
      !duplicateId
      || !canonicalId
      || duplicateId === canonicalId
      || !japaneseName
      || !scientificName
      || clean(mapping.taxon_group) !== 'butterfly'
      || clean(mapping.decision) !== 'merge_duplicate_taxon'
      || !clean(mapping.evidence)
    ) throw new Error(`${filePath}: invalid butterfly redirect ${duplicateId} -> ${canonicalId}`);
    return {
      auditId: `${duplicateId}->${canonicalId}`,
      duplicateId,
      canonicalId,
      duplicateJapaneseName: japaneseName,
      sourceJapaneseName: japaneseName,
      sourceTaxon: scientificName,
      legacyJapaneseName: japaneseName,
      legacyScientificName: scientificName,
      legacyRouteName: japaneseName,
      legacyDisplayName: japaneseName,
      taxonGroup: 'butterfly',
      englishTypeLabel: 'Butterfly',
      // The duplicate and canonical rows had the same scientific name, so
      // there is no distinct legacy English slug to generate.
      skipEnglishScientificRedirect: true,
    };
  });
}

const INSECT_TYPES = new Set(['moth', 'butterfly', 'beetle', 'longhornbeetle', 'barkbeetle', 'leafbeetle', 'aphid']);
const routeNameList = (value, label) => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((name) => !clean(name) || /[/\\?#%]/.test(name))) {
    throw new Error(`${label}: invalid legacy route names`);
  }
  return value.map(clean);
};

// 2026-10-02 の重複ID統合と和名欄の修復。統合した重複IDと、名前が変わってURLが変わる昆虫の
// 旧URL（台帳の legacy_route_names）を、正規ページへの恒久転送として返す。
export function loadInsectNameIntegrityRedirects(filePath) {
  const audit = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (
    audit.schema_version !== 1
    || audit.audit_name !== '昆虫の重複ID統合と和名欄の修復'
    || !Array.isArray(audit.merges)
    || !Array.isArray(audit.renames)
    || audit.counts?.merges !== audit.merges.length
    || audit.counts?.renames !== audit.renames.length
  ) throw new Error(`${filePath}: unexpected insect name-integrity ledger`);

  const merges = audit.merges.map((merge) => {
    const duplicateId = clean(merge.duplicate_id);
    const canonicalId = clean(merge.canonical_id);
    const taxonGroup = clean(merge.taxon_group);
    const duplicateJapaneseName = clean(merge.duplicate_japanese_name);
    const legacyScientificName = clean(merge.duplicate_scientific_name);
    const legacyEnglishMetaSlug = clean(merge.legacy_english_meta_slug);
    const label = `${filePath}: ${duplicateId} -> ${canonicalId}`;
    if (
      !duplicateId
      || !canonicalId
      || duplicateId === canonicalId
      || !INSECT_TYPES.has(taxonGroup)
      || !legacyScientificName
      || !/^[a-z0-9-]+$/.test(legacyEnglishMetaSlug)
      || clean(merge.decision) !== 'merge_duplicate_taxon'
      || !clean(merge.evidence)
    ) throw new Error(`${label}: invalid merge entry`);
    return {
      auditId: `${duplicateId}->${canonicalId}`,
      duplicateId,
      canonicalId,
      duplicateJapaneseName,
      sourceJapaneseName: duplicateJapaneseName,
      sourceTaxon: legacyScientificName,
      legacyJapaneseName: duplicateJapaneseName,
      legacyScientificName,
      legacyRouteName: '',
      legacyDisplayName: duplicateJapaneseName || legacyScientificName,
      legacyRouteNames: routeNameList(merge.legacy_route_names, label),
      legacyEnglishRouteNames: routeNameList(merge.legacy_english_route_names, label),
      canonicalLegacyRouteNames: routeNameList(merge.canonical_legacy_route_names, label),
      canonicalLegacyEnglishRouteNames: routeNameList(merge.canonical_legacy_english_route_names, label),
      legacyEnglishMetaSlug,
      taxonGroup,
      englishTypeLabel: EN_TYPE_LABELS[taxonGroup],
    };
  });

  const renames = audit.renames
    .map((rename) => {
      const insectId = clean(rename.insect_id);
      const label = `${filePath}: ${insectId}`;
      const taxonGroup = clean(rename.taxon_group);
      if (!insectId || !INSECT_TYPES.has(taxonGroup) || !clean(rename.evidence)) {
        throw new Error(`${label}: invalid rename entry`);
      }
      return {
        insectId,
        taxonGroup,
        previousJapaneseName: clean(rename.before_japanese_name),
        legacyRouteNames: routeNameList(rename.legacy_route_names, label),
        legacyEnglishRouteNames: routeNameList(rename.legacy_english_route_names, label),
      };
    })
    .filter(({ legacyRouteNames, legacyEnglishRouteNames }) => (
      legacyRouteNames.length > 0 || legacyEnglishRouteNames.length > 0
    ));
  return { merges, renames };
}

export function loadMergedTaxonRedirects({ kamikiriPath, leafBeetlePath, butterflyPath, nameIntegrityPath }) {
  const redirects = [
    ...loadKamikiriMergedTaxonRedirects(kamikiriPath).map((redirect) => ({
      ...redirect,
      taxonGroup: 'longhornbeetle',
      englishTypeLabel: 'Longhorn Beetle',
    })),
    ...loadLeafBeetleMergedTaxonRedirects(leafBeetlePath),
    ...(butterflyPath ? loadButterflyMergedTaxonRedirects(butterflyPath) : []),
    ...(nameIntegrityPath ? loadInsectNameIntegrityRedirects(nameIntegrityPath).merges : []),
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
