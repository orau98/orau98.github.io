import { useCallback } from 'react';
import useInsectImageIndex from './useInsectImageIndex';
import { globalJapaneseToScientificMapping } from '../utils/insectImageMappings';
import { buildResizedImageUrl } from '../utils/imageSrcset';
import {
  getAssetBase,
  getAssetVersionQuery,
  getPlaceholderImageUrl,
} from '../utils/assetPaths';
import {
  buildInsectImageBaseCandidates,
  resolveImageBaseCandidates,
} from '../utils/insectImageResolver';

// 昆虫1体から表示候補URL群（解決済みリサイズ画像）を得るフック。
// インデックスの読み込み・正規化は useInsectImageIndex に集約されている。
const useInsectImageCandidates = () => {
  const { imageNames, imageExtensions, normalizedEntries } = useInsectImageIndex();

  const buildImageUrl = useCallback((base) => {
    if (!base) return '';
    return buildResizedImageUrl({
      baseUrl: getAssetBase(),
      folder: 'insects',
      filename: base,
      width: 1024,
      query: getAssetVersionQuery(),
    });
  }, []);

  const getImageCandidates = useCallback((insect) => {
    if (!insect) return [];
    const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
    const candidateBases = buildInsectImageBaseCandidates(insect, mappedFilename);
    const resolvedBases = resolveImageBaseCandidates(candidateBases, {
      imageExtensions,
      imageNames,
      normalizedEntries,
      includeUnresolved: false,
    });
    const urls = [];
    const seen = new Set();
    resolvedBases.forEach((base) => {
      const url = buildImageUrl(base);
      if (url && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    });
    return urls;
  }, [buildImageUrl, imageNames, imageExtensions, normalizedEntries]);

  return {
    getImageCandidates,
    placeholderSrc: getPlaceholderImageUrl(),
  };
};

export default useInsectImageCandidates;
