import revisions from '../../normalized_data/general_note_display_revisions.json' with { type: 'json' };

const sourceFields = ['insect_id', 'note_type', 'content', 'reference', 'page', 'year'];

// 保存済みの監査行は原文で保持し、公開出力に原ページの再照合と区分の修正を適用する。
export function projectInsectNotes(rows) {
  return rows.flatMap((row) => {
    const id = row?.record_id;
    if (!Object.hasOwn(revisions, id)) return [row];

    const [expected, replacement] = revisions[id];
    if (!sourceFields.every((field, i) => (row[field] || '') === expected[i])) return [row];

    return replacement.map(([recordId, ...values]) => ({
      ...row,
      record_id: recordId,
      ...Object.fromEntries(sourceFields.map((field, i) => [field, values[i]])),
    }));
  });
}
