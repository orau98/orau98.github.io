const JAPANESE_CHAR = '\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}々〆ヶ';

const SUBJECTIVE_PATTERNS = [
  {
    code: 'subjective_aesthetic',
    pattern: /美し|上品|品格|シブ|かっこ|格別|素晴らし|魅力|存在感|好感|良さ|よさ|良い蛾/,
  },
  {
    code: 'subjective_emotion',
    pattern: /幸福感|至福|うれし|嬉し|楽しい|感激|たまらない|残念|ドキドキ|憧れ|あこがれ/,
  },
  {
    code: 'collector_advice',
    pattern: /採りたい|採ってお|集めたい|並べたい|押さえたい|狙いたい|頑張りたい|選んで採集|頂戴/,
  },
  {
    code: 'collector_context',
    pattern: /初心者|玄人|蛾屋|冬夜蛾屋|一人前|コレクション|業界用語|珍品|大物|病状|触手/,
  },
];

const PAGE_OR_COLUMN_BLEED = /---\s*ページ|分布図|採集例|よく似た種類の見分け方|近似種との区別点|本誌表紙|裏表紙の写真/;

export function normalizeOcrLayoutWhitespace(value) {
  return (value ?? '')
    .toString()
    .normalize('NFC')
    .replace(/\u3000/g, ' ')
    .replace(new RegExp(`(?<=[${JAPANESE_CHAR}])\\s+(?=[${JAPANESE_CHAR}])`, 'gu'), '')
    .replace(new RegExp(`(?<=[${JAPANESE_CHAR}])\\s+(?=\\d)`, 'gu'), '')
    .replace(new RegExp(`(?<=\\d)\\s+(?=[${JAPANESE_CHAR}])`, 'gu'), '')
    .replace(new RegExp(`(?<=[${JAPANESE_CHAR}])\\s+(?=[♀♂])`, 'gu'), '')
    .replace(new RegExp(`(?<=[♀♂])\\s+(?=[${JAPANESE_CHAR}])`, 'gu'), '')
    .replace(/(?<=\d)\s+(?=℃)/g, '')
    .replace(/(?<=[～〜~])\s+(?=\d)/g, '')
    .replace(/(?<=\d)\s+(?=[～〜~])/g, '')
    .replace(/\s+([。、，．！？）］】])/g, '$1')
    .replace(/([（［【])\s+/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function canonicalizeEcologyNoteType(value) {
  return value === '生態' ? '生態情報' : value;
}

export function collectGeneralNoteIssues(row) {
  const content = (row?.content ?? '').toString().trim();
  const issues = [];

  if (normalizeOcrLayoutWhitespace(content) !== content) {
    issues.push('ocr_layout_gap');
  }
  if (PAGE_OR_COLUMN_BLEED.test(content)) {
    issues.push('page_or_column_bleed');
  }
  SUBJECTIVE_PATTERNS.forEach(({ code, pattern }) => {
    if (pattern.test(content)) issues.push(code);
  });
  if (row?.note_type === '生態') {
    issues.push('legacy_note_type');
  }
  if (row?.note_type === '生態情報' && !(row?.page ?? '').toString().trim()) {
    issues.push('missing_source_page');
  }

  return [...new Set(issues)];
}
