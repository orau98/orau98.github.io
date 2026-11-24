const PRESENTATIONS = {
  field: {
    labels: { ja: '野外', en: 'Field' },
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-700',
  },
  reared: {
    labels: { ja: '飼育', en: 'Captive rearing' },
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-700',
  },
  unknown: {
    labels: { ja: '不明', en: 'Unknown' },
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
};

const REGION_LABELS = {
  domestic: { ja: '国内', en: 'Japan' },
  domesticInferred: { ja: '国内推定', en: 'Japan inferred' },
  overseas: { ja: '国外', en: 'Outside Japan' },
  unknown: { ja: '地域不明', en: 'Region unknown' },
};

const FIELD_TYPE = /^野外(?:記録)?(?:[（(](?:国内|国外|海外)[）)])?$/;
const REARED_TYPE = /^飼育(?:記録)?(?:[（(](?:国内|国外|海外)[）)])?$/;

export function getObservationTypeCategory(observationType = '') {
  const value = String(observationType || '').trim();
  if (FIELD_TYPE.test(value)) return 'field';
  if (REARED_TYPE.test(value)) return 'reared';
  return 'unknown';
}

export function getObservationRegion(observationType = '') {
  const value = String(observationType || '').trim();
  if (value.includes('地域不明')) return 'unknown';
  if (value.includes('国内') && value.includes('論文範囲')) return 'domesticInferred';
  if (value.includes('国内')) return 'domestic';
  if (value.includes('国外') || value.includes('海外')) return 'overseas';
  return '';
}

export function getObservationTypePresentation(observationType, isEnglish = false) {
  const category = getObservationTypeCategory(observationType);
  const region = getObservationRegion(observationType);
  const presentation = PRESENTATIONS[category];
  const language = isEnglish ? 'en' : 'ja';
  return {
    ...presentation,
    category,
    region,
    label: presentation.labels[language],
    regionLabel: REGION_LABELS[region]?.[language] || '',
  };
}

export function getObservationTypePriority(observationType) {
  const category = getObservationTypeCategory(observationType);
  if (category === 'field') {
    const region = getObservationRegion(observationType);
    return { domestic: 0, '': 1, overseas: 2 }[region] ?? 1;
  }
  return category === 'reared' ? 3 : 4;
}

export function groupObservationEvidence(records, isEnglish = false) {
  const groups = new Map();
  for (const record of records) {
    const presentation = getObservationTypePresentation(record.observationType, isEnglish);
    const key = `${presentation.category}:${presentation.region}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        presentation,
        priority: getObservationTypePriority(record.observationType),
        records: [],
      });
    }
    groups.get(key).records.push(record);
  }
  return [...groups.values()].sort((a, b) => a.priority - b.priority);
}
