// 備考欄から成虫発生時期を抽出するユーティリティ関数

/**
 * 備考文字列から成虫発生時期の情報を抽出
 * @param {string} notes - 備考文字列
 * @returns {object} - { emergenceTime: string, notes: string }
 */
import logger from './logger.js';

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

  // 簡易な「3-10月」のみでも拾うフォールバック
  if (!emergenceTime) {
    const simple = notes.match(/([0-9０-９]{1,2}(?:[~〜－ーｰ-][0-9０-９]{1,2})?月[^;。\n]*)/);
    if (simple) {
      emergenceTime = simple[1].trim();
      remainingNotes = notes.replace(simple[0], '').trim().replace(/^[;。、\s]+/, '').trim();
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
    .replace(/初旬/g, '上旬')     // 「初旬」を「上旬」に統一
    .replace(/成虫は/, '')       // 「成虫は」を除去
    .replace(/に発生/, '')       // 「に発生」を除去
    .replace(/頃発生/, '頃')     // 「頃発生」を「頃」に
    .replace(/頃出現/, '頃')     // 「頃出現」を「頃」に
    .replace(/頃羽化/, '頃')     // 「頃羽化」を「頃」に
    .trim();

  return normalized;
};

/**
 * 出現期の文字列から「何月に出現するか」を月番号の配列で返す。
 * フィルタ用に大まかな月情報さえ取れれば良いので、簡易的に範囲・リストを解釈する。
 *
 * 例:
 *  - "4月下旬-6月中旬" -> [4,5,6]
 *  - "7~9月" -> [7,8,9]
 *  - "6, 9月" -> [6,9]
 */
export const getEmergenceMonths = (emergenceTime) => {
  if (!emergenceTime) return [];

  let text = `${emergenceTime}`;

  // 全角数字を半角に、波ダッシュ類をハイフンに統一
  text = text.replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));
  text = text.replace(/[〜～－ーｰ—–−]/g, '-');
  // 区切り記号をスペースに統一（読点・スラッシュ・中黒など）
  text = text.replace(/[、，,／/・]/g, ' ');
  // 「上旬・中旬・下旬・頃」など月の後に付く語はフィルタ判定では無視
  text = text.replace(/月\s*(上旬|中旬|下旬|初旬|頃|ごろ|前半|後半|中頃|中盤)/g, '月');

  const months = new Set();

  // 範囲指定（4-6月 / 4月-6月 / 10-3月 など）
  const rangeRe = /(\d{1,2})\s*(?:月)?\s*-\s*(\d{1,2})\s*(?:月)?/g;
  let m;
  while ((m = rangeRe.exec(text)) !== null) {
    let start = parseInt(m[1], 10);
    let end = parseInt(m[2], 10);
    if (start < 1 || start > 12 || end < 1 || end > 12) continue;

    if (start <= end) {
      for (let mm = start; mm <= end; mm++) months.add(mm);
    } else {
      // 年をまたぐ場合 (例: 10-3月)
      for (let mm = start; mm <= 12; mm++) months.add(mm);
      for (let mm = 1; mm <= end; mm++) months.add(mm);
    }
  }

  // 個別月指定（6月・7月など）。範囲で既に追加されていても Set なので重複なし。
  const singleRe = /(\d{1,2})\s*月/g;
  while ((m = singleRe.exec(text)) !== null) {
    const val = parseInt(m[1], 10);
    if (val >= 1 && val <= 12) months.add(val);
  }

  return Array.from(months).sort((a, b) => a - b);
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

  logger.debug('成虫発生時期抽出テスト:');
  testCases.forEach((testCase, index) => {
    const result = extractEmergenceTime(testCase);
    const normalized = normalizeEmergenceTime(result.emergenceTime);
    logger.debug(`テスト${index + 1}:`, {
      original: testCase,
      extracted: result.emergenceTime,
      normalized: normalized,
      remainingNotes: result.notes
    });
  });
};
