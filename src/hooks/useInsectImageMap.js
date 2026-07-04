import { useEffect, useState, useCallback } from 'react';
import useInsectImageIndex from './useInsectImageIndex';
import {
  globalJapaneseToScientificMapping,
  INSECT_IMAGE_BASE_OVERRIDES,
} from '../utils/insectImageMappings';
import {
  buildInsectImageBaseCandidates,
  resolveImageBaseCandidates,
} from '../utils/insectImageResolver';

// 昆虫配列（App側stateで参照が安定）ごとの解決結果キャッシュ。
// 詳細ページから一覧へ戻った際に全種の再解決を待たず、初回レンダーから
// 画像付きカードを確定表示するために再マウントをまたいで保持する。
const insectImageMapCache = new WeakMap();

const buildOverrideMap = (insects) => {
  const next = new Map();
  insects?.forEach((insect) => {
    if (!insect || !insect.id) return;
    const override = INSECT_IMAGE_BASE_OVERRIDES.get(insect.id);
    if (override) next.set(insect.id, override);
  });
  return next;
};

const mapsEqual = (a, b) => {
  if (a === b) return true;
  if (!a || !b || a.size !== b.size) return false;
  for (const [key, value] of b) {
    if (a.get(key) !== value) return false;
  }
  return true;
};

// 一覧の全昆虫について「昆虫ID → 表示画像ベース名」を事前解決するフック。
// 並べ替え（写真あり優先）とカード描画がO(1)参照できるようMapで返す。
export default function useInsectImageMap(insects) {
  const {
    imageNames,
    imageExtensions,
    normalizedEntries,
    isReady,
    resolved,
  } = useInsectImageIndex();

  const getBestImageForInsect = useCallback((insect) => {
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
  }, [imageExtensions, imageNames, isReady, normalizedEntries]);

  // 再マウント時は前回計算済みのマップ（insects配列参照＋インデックス参照が
  // 一致する場合のみ）を初期値に使い、戻った直後から確定表示する
  const [insectImageMap, setInsectImageMap] = useState(() => {
    const cached = insects ? insectImageMapCache.get(insects) : null;
    if (cached && cached.names === imageNames && cached.exts === imageExtensions) {
      return cached.map;
    }
    return buildOverrideMap(insects);
  });

  useEffect(() => {
    if (!isReady || !insects || insects.length === 0) {
      const overrides = buildOverrideMap(insects);
      setInsectImageMap((prev) => (mapsEqual(prev, overrides) ? prev : overrides));
      return undefined;
    }

    const cached = insectImageMapCache.get(insects);
    if (cached && cached.names === imageNames && cached.exts === imageExtensions) {
      setInsectImageMap((prev) => (prev === cached.map ? prev : cached.map));
      return undefined;
    }

    // 巨大リストで初回描画を塞がないよう1タスク遅らせて計算する
    const timeoutId = setTimeout(() => {
      const nextMap = new Map();
      insects.forEach((insect) => {
        if (!insect || !insect.id) return;
        const best = getBestImageForInsect(insect);
        if (best) nextMap.set(insect.id, best);
      });
      insectImageMapCache.set(insects, {
        names: imageNames,
        exts: imageExtensions,
        map: nextMap,
      });
      setInsectImageMap(nextMap);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [getBestImageForInsect, isReady, insects, imageNames, imageExtensions]);

  return {
    insectImageMap,
    isImageIndexReady: isReady,
    imageIndexResolved: resolved,
  };
}
