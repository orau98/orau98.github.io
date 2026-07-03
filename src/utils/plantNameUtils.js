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
 * 植物名の全角括弧内の科名注記「（〇〇科）」から科名だけを取り出す。
 * EnhancedHostPlantDisplay と integratedDataParser に重複していたローカル実装を統合したもの。
 * 挙動は従来のローカル実装と同一（全角括弧のみ・該当なしは空文字）。
 * @param {string} plantText - 科名注記を含みうる植物名
 * @returns {string} 科名（例:「バラ科」）。該当しなければ空文字。
 */
export const extractPlantFamily = (plantText) => {
  if (typeof plantText !== 'string') return '';
  const match = plantText.match(/（([^）]+科)）/);
  return match ? match[1] : '';
};

export default {
  normalizePlantKey,
  extractPlantFamily,
};
