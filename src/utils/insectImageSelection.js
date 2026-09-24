import {
  globalJapaneseToScientificMapping,
  INSECT_IMAGE_BASE_OVERRIDES,
} from './insectImageMappings.js';
import {
  buildInsectImageBaseCandidates,
  resolveImageBaseCandidates,
} from './insectImageResolver.js';

/**
 * 1種の昆虫に表示する画像ベース名を決める（見つからなければ null）。
 * 一覧の「写真あり優先」の並びとカード画像はこの結果で決まる。
 * ブラウザ（useInsectImageMap）とビルド（トップの先読み用の最初の結果）で同じ関数を使う。
 */
export const selectInsectImageBase = (insect, { imageNames, imageExtensions, normalizedEntries, isReady = true }) => {
  try {
    if (!insect) return null;
    // Index未準備でも重要種は即座にファイル名を返して表示を試みる
    const override = INSECT_IMAGE_BASE_OVERRIDES.get(insect.id);
    if (!isReady) return override || null;

    if (override && (imageNames.has(override) || imageExtensions[override])) {
      return override;
    }

    const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
    const candidates = [
      override,
      ...buildInsectImageBaseCandidates(insect, mappedFilename),
    ].filter(Boolean);
    const resolvedBases = resolveImageBaseCandidates(candidates, {
      imageExtensions,
      imageNames,
      normalizedEntries,
      includeUnresolved: false,
    });
    return resolvedBases[0] || null;
  } catch {
    return null;
  }
};
