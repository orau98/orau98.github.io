const cleanString = (value) => (value ?? '').toString().trim();

export const TAXONOMY_ASSERTIONS = Object.freeze([
  Object.freeze({
    id: 'japanesebeetles-prioninae-ishigaki-toge-usuba-kamikiri',
    sourceUrl: 'https://japanesebeetles.jimdofree.com/目録/131-カミキリムシ科/131-1-ノコギリカミキリ亜科/',
    insectId: '2',
    japaneseName: 'イシガキトゲウスバカミキリ',
    expectedFields: Object.freeze({
      genus: 'Spinimegopis',
      subgenus: '',
      species: 'ishigakiana',
      subspecies: '',
      author: '(Yoshinaga & Nakayama)',
      year: '1972',
      scientific_name: 'Spinimegopis ishigakiana (Yoshinaga & Nakayama, 1972)',
    }),
    synonymsMustContain: Object.freeze([
      'Megopis formosana ishigakiana Yoshinaga & Nakayama, 1972',
    ]),
    synonymsMustNotContain: Object.freeze([
      'Spinimegopis ishigakiana (Yoshinaga & Nakayama, 1972)',
    ]),
  }),
]);

export function collectTaxonomyAssertionFailures(rows = []) {
  const byId = new Map();
  for (const row of rows) {
    const id = cleanString(row?.insect_id);
    if (id) byId.set(id, row);
  }

  const failures = [];
  for (const assertion of TAXONOMY_ASSERTIONS) {
    const row = byId.get(assertion.insectId);
    if (!row) {
      failures.push({
        assertion_id: assertion.id,
        insect_id: assertion.insectId,
        japanese_name: assertion.japaneseName,
        field: 'insect_id',
        expected: assertion.insectId,
        actual: '',
        source: assertion.sourceUrl,
      });
      continue;
    }

    const actualJapaneseName = cleanString(row.japanese_name);
    if (actualJapaneseName !== assertion.japaneseName) {
      failures.push({
        assertion_id: assertion.id,
        insect_id: assertion.insectId,
        japanese_name: actualJapaneseName,
        field: 'japanese_name',
        expected: assertion.japaneseName,
        actual: actualJapaneseName,
        source: assertion.sourceUrl,
      });
    }

    for (const [field, expected] of Object.entries(assertion.expectedFields)) {
      const actual = cleanString(row[field]);
      if (actual !== expected) {
        failures.push({
          assertion_id: assertion.id,
          insect_id: assertion.insectId,
          japanese_name: actualJapaneseName,
          field,
          expected,
          actual,
          source: assertion.sourceUrl,
        });
      }
    }

    const synonyms = cleanString(row.synonyms);
    for (const expectedSynonym of assertion.synonymsMustContain || []) {
      if (!synonyms.includes(expectedSynonym)) {
        failures.push({
          assertion_id: assertion.id,
          insect_id: assertion.insectId,
          japanese_name: actualJapaneseName,
          field: 'synonyms',
          expected: `contains: ${expectedSynonym}`,
          actual: synonyms,
          source: assertion.sourceUrl,
        });
      }
    }
    for (const forbiddenSynonym of assertion.synonymsMustNotContain || []) {
      if (synonyms.includes(forbiddenSynonym)) {
        failures.push({
          assertion_id: assertion.id,
          insect_id: assertion.insectId,
          japanese_name: actualJapaneseName,
          field: 'synonyms',
          expected: `does not contain: ${forbiddenSynonym}`,
          actual: synonyms,
          source: assertion.sourceUrl,
        });
      }
    }
  }
  return failures;
}
