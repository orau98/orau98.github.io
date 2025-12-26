// Filename and plant-name helpers shared across components

// Remove family annotations and special characters to create a safe base filename
export const createSafePlantFilename = (plantName = '') => {
  try {
    let cleanedName = String(plantName)
      // remove family annotations like （○○科） and (○○科)
      .replace(/（[^）]*科[^）]*）/g, '')
      .replace(/\([^)]*科[^)]*\)/g, '')
      // remove any other parentheses content
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      // remove trailing '科'
      .replace(/科$/g, '')
      // strip non-word (keep latin/japanese chars and digits)
      .replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龠]/g, '');
    return cleanedName;
  } catch {
    return String(plantName || '');
  }
};

// Extract base part of an image filename (w/o extension), splitting on ASCII '_' or full-width '＿'
export const splitFilenameBase = (filename = '') => {
  const withoutExt = String(filename).replace(/\.[^.]+$/, '');
  return withoutExt.split(/[_＿]/)[0];
};

// Plant image suffixes with labels (shared ordering/priority)
export const PLANT_IMAGE_SUFFIXES = [
  { suffix: '_葉表', label: '葉表' },
  { suffix: '_葉', label: '葉' },
  { suffix: '_葉裏', label: '葉裏' },
  { suffix: '_ダニ室', label: 'ダニ室' },
  { suffix: '_葉表白化', label: '葉表白化' },
  { suffix: '_羽状複葉', label: '羽状複葉' },
  { suffix: '_樹皮', label: '樹皮' },
  { suffix: '_実', label: '実' },
  { suffix: '_果実', label: '果実' },
  { suffix: '_花', label: '花' },
  { suffix: '_蕾', label: '蕾' },
  { suffix: '_若葉', label: '若葉' },
  { suffix: '_冬芽', label: '冬芽' },
  { suffix: '_芽', label: '芽' },
  { suffix: '_茎', label: '茎' },
  { suffix: '_枝', label: '枝' },
  { suffix: '_枝先', label: '枝先' },
  { suffix: '_断面', label: '断面' },
];
