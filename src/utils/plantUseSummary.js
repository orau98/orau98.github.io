// 昆虫ページの「食草・寄主植物」「成虫の訪花」を短くまとめるための集計。
// 以前は植物1件ごとに高さ約150pxの枠（名前・利用部位・記録の種類・出典）を並べ、
// アゲハ（49件）では食草欄だけでスマホ約9画面になっていた。出典や利用部位が全件同じでも毎回出ていた。
// ここでは植物を科ごとにまとめ、全件に共通する利用部位・記録の種類・出典は1回だけ出せるようにする。

const uniqueSorted = (values) => Array.from(new Set(values.filter(Boolean))).sort();

const splitReferences = (value) => String(value || '')
  .split(/[;；]/)
  .map((item) => item.trim())
  .filter(Boolean);

const isFamilyName = (name) => /科$/.test(String(name || '').trim());

/**
 * groups: [{ name, family, records: [{ observationType, lifeStage, plantPart, reference, notes }] }]
 * options:
 *  - usageLabelOf(record) → 利用の表示（例: 「幼虫・葉」）。空なら数えない
 *  - observationOf(group) → { key, label, priority }（その植物で最も優先する記録の種類）
 *  - notesOf(group) → 植物ごとの備考の配列
 */
export const buildPlantUseSummary = (groups = [], { usageLabelOf, observationOf, notesOf } = {}) => {
  const items = groups.map((group) => {
    const records = Array.isArray(group.records) ? group.records : [];
    const usageLabels = uniqueSorted(records.map((record) => (usageLabelOf ? usageLabelOf(record) : '')));
    const references = [];
    records.forEach((record) => {
      splitReferences(record.reference).forEach((ref) => {
        if (!references.includes(ref)) references.push(ref);
      });
    });
    const name = String(group.name || '').trim();
    const family = String(group.family || '').trim();
    const familyKey = family && family !== name && family !== '不明'
      ? family
      : (isFamilyName(name) ? name : '');
    return {
      group,
      name,
      familyKey,
      // 植物名そのものが科の記録（例:「カバノキ科」）
      isFamilyRecord: familyKey !== '' && familyKey === name,
      usage: usageLabels.join('／'),
      observation: observationOf ? observationOf(group) : { key: '', label: '', priority: 99 },
      references,
      notes: notesOf ? notesOf(group) : [],
    };
  });

  const allSame = (getKey) => items.length > 0 && items.every((item) => getKey(item) === getKey(items[0]));
  const commonUsage = allSame((item) => item.usage) ? items[0].usage : null;
  const commonObservation = allSame((item) => item.observation.key) ? items[0].observation : null;
  const commonReferences = allSame((item) => item.references.join('|')) ? items[0].references : null;

  // 出典が植物ごとに違うときは、出典を番号付きで最後にまとめ、植物には番号だけ付ける
  const referenceOrder = [];
  items.forEach((item) => {
    item.references.forEach((ref) => {
      if (!referenceOrder.includes(ref)) referenceOrder.push(ref);
    });
  });
  const referenceNumber = new Map(referenceOrder.map((ref, index) => [ref, index + 1]));
  items.forEach((item) => {
    item.referenceNumbers = commonReferences ? [] : item.references.map((ref) => referenceNumber.get(ref));
  });

  const familyMap = new Map();
  items.forEach((item) => {
    if (!familyMap.has(item.familyKey)) familyMap.set(item.familyKey, []);
    familyMap.get(item.familyKey).push(item);
  });
  const families = Array.from(familyMap.entries())
    .map(([key, familyItems]) => ({
      key,
      hasFamilyRecord: familyItems.some((item) => item.isFamilyRecord),
      // 科そのものの記録は見出しで表すので、植物の並びからは外す
      items: familyItems
        .filter((item) => !item.isFamilyRecord)
        .sort((a, b) => (a.observation.priority - b.observation.priority) || a.name.localeCompare(b.name, 'ja')),
      count: familyItems.length,
    }))
    .sort((a, b) => {
      if (!a.key !== !b.key) return a.key ? -1 : 1; // 科の分からない植物は最後
      return (b.count - a.count) || a.key.localeCompare(b.key, 'ja');
    });

  return {
    items,
    families,
    plantCount: items.length,
    familyCount: families.filter((family) => family.key).length,
    commonUsage,
    commonObservation,
    commonReferences,
    referenceOrder: commonReferences ? [] : referenceOrder,
  };
};
