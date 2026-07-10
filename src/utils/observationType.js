const PRESENTATIONS = {
  domestic: {
    labels: { ja: '国内', en: 'Japan' },
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    textColor: 'text-green-700 dark:text-green-300',
    borderColor: 'border-green-200 dark:border-green-700',
  },
  domesticInferred: {
    labels: { ja: '国内推定', en: 'Japan inferred' },
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-700',
  },
  literature: {
    labels: { ja: '文献', en: 'Literature' },
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-700 dark:text-amber-300',
    borderColor: 'border-amber-200 dark:border-amber-700',
  },
  reared: {
    labels: { ja: '飼育', en: 'Reared' },
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    textColor: 'text-blue-700 dark:text-blue-300',
    borderColor: 'border-blue-200 dark:border-blue-700',
  },
  overseas: {
    labels: { ja: '海外', en: 'Overseas' },
    bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    textColor: 'text-purple-700 dark:text-purple-300',
    borderColor: 'border-purple-200 dark:border-purple-700',
  },
  unknownRegion: {
    labels: { ja: '地域不明', en: 'Region unclear' },
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
  other: {
    labels: { ja: 'その他', en: 'Other' },
    bgColor: 'bg-gray-50 dark:bg-gray-900/20',
    textColor: 'text-gray-700 dark:text-gray-300',
    borderColor: 'border-gray-200 dark:border-gray-700',
  },
};

export const getObservationTypeCategory = (observationType = '') => {
  const value = String(observationType || '').trim();

  if (value.includes('地域不明')) return 'unknownRegion';
  if (value.includes('国内') && value.includes('論文範囲')) return 'domesticInferred';
  if (value === '国内' || value.includes('国内')) return 'domestic';
  if (value.includes('海外') || value.includes('国外')) return 'overseas';
  if (value === '飼育' || value === '飼育記録') return 'reared';
  if (value === '文献') return 'literature';
  return 'other';
};

export const getObservationTypePresentation = (observationType, isEnglish = false) => {
  const category = getObservationTypeCategory(observationType);
  const presentation = PRESENTATIONS[category];
  const isDomesticFieldRecord = String(observationType || '').trim() === '野外（国内）';
  return {
    ...presentation,
    label: isDomesticFieldRecord
      ? (isEnglish ? 'Field' : '野外')
      : presentation.labels[isEnglish ? 'en' : 'ja'],
  };
};

export const getObservationTypePriority = (observationType) => ({
  domestic: 1,
  domesticInferred: 2,
  literature: 3,
  reared: 3,
  overseas: 4,
  unknownRegion: 5,
  other: 6,
})[getObservationTypeCategory(observationType)];

export const isDomesticObservationType = (observationType) => {
  const category = getObservationTypeCategory(observationType);
  return category === 'domestic' || category === 'domesticInferred';
};
