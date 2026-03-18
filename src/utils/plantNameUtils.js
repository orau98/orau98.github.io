/**
 * 植物名正規化ユーティリティ
 * 複数のコンポーネントで使用される植物名の正規化ロジックを統一
 */

/**
 * 植物名を正規化してキーとして使用可能な形式にする
 * @param {string} plantName - 正規化する植物名
 * @returns {string} 正規化された植物名
 */
export const normalizePlantKey = (plantName) => {
  if (!plantName || typeof plantName !== "string") {
    return plantName || "";
  }
  // 「〇〇科」のみの場合はそのまま返す
  if (plantName.match(/^[^（(]+科$/)) {
    return plantName.trim();
  }
  let normalized = plantName;
  // 「〇〇科の〇〇」から「〇〇」を抽出
  normalized = normalized.replace(/^([^（(科]+科)([のに]?)([^（(].+)$/, "$3");
  // 「〇〇（〇〇科）」から「〇〇」を抽出（全角括弧）
  normalized = normalized.replace(/^([^（(]+)（[^）]*科[^）]*）(.*)$/g, "$1$2");
  // 「〇〇(〇〇科)」から「〇〇」を抽出（半角括弧）
  normalized = normalized.replace(/^([^（(]+)\([^)]*科[^)]*\)(.*)$/g, "$1$2");
  // 「(以上〇〇科)」を除去
  normalized = normalized.replace(/\(以上[^)]*科\)/g, "");
  normalized = normalized.replace(/（以上[^）]*科）/g, "");
  // 未閉じの括弧を除去
  normalized = normalized.replace(/（[^）]*$/g, "");
  normalized = normalized.replace(/\([^)]*$/g, "");
  // 括弧の後半のみを除去
  normalized = normalized.replace(/^[^（(]*[）)]/g, "");
  // 末尾の ? / ？ は植物名ではなく注記として扱う
  normalized = normalized.replace(/[？?]+$/g, "");
  return normalized.trim();
};

/**
 * 植物名を表示用に正規化する（科名を保持する場合がある）
 * @param {string} plantName - 正規化する植物名
 * @returns {string} 表示用に正規化された植物名
 */
export const normalizePlantName = (plantName) => {
  if (!plantName || typeof plantName !== 'string') return plantName || '';

  let normalized = plantName.trim();

  // 「科の」「科に」パターンを処理
  normalized = normalized.replace(/^([^（(科]+科)([のに])([^（(].+)$/, '$3');

  // 括弧内の科名を除去（内容は保持）
  normalized = normalized.replace(/^([^（(]+)（[^）]*科[^）]*）(.*)$/g, '$1$2');
  normalized = normalized.replace(/^([^（(]+)\([^)]*科[^)]*\)(.*)$/g, '$1$2');

  // 以上〇〇科のパターンを除去
  normalized = normalized.replace(/\(以上[^)]*科\)/g, '');
  normalized = normalized.replace(/（以上[^）]*科）/g, '');

  // 不完全な括弧を除去
  normalized = normalized.replace(/（[^）]*$/g, '');
  normalized = normalized.replace(/\([^)]*$/g, '');
  normalized = normalized.replace(/^[^（(]*[）)]/g, '');
  normalized = normalized.replace(/[？?]+$/g, '');

  return normalized.trim();
};

/**
 * 植物名から科名を抽出する
 * @param {string} plantName - 植物名
 * @returns {string|null} 科名またはnull
 */
export const extractFamilyFromPlantName = (plantName) => {
  if (!plantName || typeof plantName !== 'string') return null;

  // 「〇〇（〇〇科）」パターン
  const fullWidthMatch = plantName.match(/（([^）]*科)）/);
  if (fullWidthMatch) return fullWidthMatch[1];

  // 「〇〇(〇〇科)」パターン
  const halfWidthMatch = plantName.match(/\(([^)]*科)\)/);
  if (halfWidthMatch) return halfWidthMatch[1];

  // 「〇〇科」のみ
  if (plantName.match(/^[^（(]+科$/)) {
    return plantName.trim();
  }

  return null;
};

export default {
  normalizePlantKey,
  normalizePlantName,
  extractFamilyFromPlantName,
};
