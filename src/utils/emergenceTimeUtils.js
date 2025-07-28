// 備考欄から成虫発生時期を抽出するユーティリティ関数

/**
 * 備考文字列から成虫発生時期の情報を抽出
 * @param {string} notes - 備考文字列
 * @returns {object} - { emergenceTime: string, notes: string }
 */
export const extractEmergenceTime = (notes) => {
  if (!notes || typeof notes !== 'string') {
    return { emergenceTime: '', notes: notes || '' };
  }

  // 成虫発生時期のパターンを検出
  const emergencePatterns = [
    /成虫発生時期:\s*([^;。\n]+)/,
    /成虫出現時期:\s*([^;。\n]+)/,
    /羽化時期:\s*([^;。\n]+)/,
    /発生時期:\s*([^;。\n]+)/,
    /出現時期:\s*([^;。\n]+)/,
    /成虫は\s*([0-9～〜~-]+月[^;。\n]*)/,
    /([0-9～〜~-]+月[^;。\n]*(?:発生|出現|羽化))/
  ];

  let emergenceTime = '';
  let remainingNotes = notes;

  // 各パターンをチェック
  for (const pattern of emergencePatterns) {
    const match = notes.match(pattern);
    if (match) {
      emergenceTime = match[1].trim();
      // マッチした部分を除去
      remainingNotes = notes.replace(match[0], '').trim();
      // セミコロンや句点で区切られた場合の処理
      remainingNotes = remainingNotes.replace(/^[;。、\s]+/, '').trim();
      break;
    }
  }

  return {
    emergenceTime: emergenceTime,
    notes: remainingNotes
  };
};

/**
 * 成虫発生時期データの正規化
 * @param {string} emergenceTime - 抽出された成虫発生時期
 * @returns {string} - 正規化された発生時期
 */
export const normalizeEmergenceTime = (emergenceTime) => {
  if (!emergenceTime) return '';

  // 不要な文字や表現を除去
  let normalized = emergenceTime
    .replace(/^[、。;:\s]+/, '')  // 先頭の句読点除去
    .replace(/[、。;:\s]+$/, '')  // 末尾の句読点除去
    .replace(/成虫は/, '')       // 「成虫は」を除去
    .replace(/に発生/, '')       // 「に発生」を除去
    .replace(/頃発生/, '頃')     // 「頃発生」を「頃」に
    .replace(/頃出現/, '頃')     // 「頃出現」を「頃」に
    .replace(/頃羽化/, '頃')     // 「頃羽化」を「頃」に
    .trim();

  return normalized;
};

/**
 * マゲバヒメハマキのようなデータから成虫発生時期を抽出してテスト
 */
export const testExtraction = () => {
  const testCases = [
    "幼虫は新芽を綴ったり、葉の縁を折り返したりする。; 成虫発生時期: 6~9月",
    "幼虫は葉を巻く。成虫出現時期: 4月～8月",
    "越冬後羽化。羽化時期: 3月頃",
    "年2化。発生時期: 5月、8月",
    "夏に発生。成虫は7月頃出現する"
  ];

  console.log('成虫発生時期抽出テスト:');
  testCases.forEach((testCase, index) => {
    const result = extractEmergenceTime(testCase);
    const normalized = normalizeEmergenceTime(result.emergenceTime);
    console.log(`テスト${index + 1}:`, {
      original: testCase,
      extracted: result.emergenceTime,
      normalized: normalized,
      remainingNotes: result.notes
    });
  });
};