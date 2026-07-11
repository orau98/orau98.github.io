import fs from 'node:fs';

import Papa from 'papaparse';

export function loadKamikiriMergedTaxonRedirects(filePath) {
  const parsed = Papa.parse(fs.readFileSync(filePath, 'utf8').replace(/^\ufeff/, ''), {
    header: true,
    skipEmptyLines: true,
  });
  if (parsed.errors.length > 0) {
    throw new Error(`${filePath}: ${parsed.errors[0].message}`);
  }

  const redirects = parsed.data
    .filter((row) => String(row.decision || '').trim() === 'merge_duplicate_taxon')
    .map((row) => {
      const legacyJapaneseName = String(row.legacy_japanese_name || '').trim();
      const legacyScientificName = String(row.legacy_scientific_name || '').trim();
      const legacyRouteName = String(row.legacy_route_name || '').trim();
      return {
        auditId: String(row.audit_id || '').trim(),
        duplicateId: String(row.insect_id || '').trim(),
        canonicalId: String(row.merge_into_insect_id || '').trim(),
        duplicateJapaneseName: String(row.current_japanese_name || '').trim(),
        sourceJapaneseName: String(row.source_japanese_name || '').trim(),
        sourceTaxon: String(row.source_taxon || '').trim(),
        legacyJapaneseName,
        legacyScientificName,
        legacyRouteName,
        legacyDisplayName: legacyJapaneseName || legacyScientificName,
      };
    });

  const duplicateIds = new Set();
  for (const redirect of redirects) {
    if (
      !redirect.auditId ||
      !redirect.duplicateId ||
      !redirect.canonicalId ||
      !redirect.sourceTaxon ||
      !redirect.legacyScientificName ||
      !redirect.legacyRouteName ||
      !redirect.legacyDisplayName
    ) {
      throw new Error(`${filePath}: incomplete merged-taxon redirect row ${redirect.auditId || '(unknown)'}`);
    }
    if (redirect.duplicateJapaneseName !== redirect.legacyJapaneseName) {
      throw new Error(
        `${filePath}: merged-taxon Japanese name does not match its legacy row: ${redirect.auditId}`,
      );
    }
    if (redirect.duplicateId === redirect.canonicalId) {
      throw new Error(`${filePath}: merged-taxon redirect points to itself: ${redirect.duplicateId}`);
    }
    if (duplicateIds.has(redirect.duplicateId)) {
      throw new Error(`${filePath}: duplicate merged-taxon source ID: ${redirect.duplicateId}`);
    }
    duplicateIds.add(redirect.duplicateId);
  }

  return redirects;
}
