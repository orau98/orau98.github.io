import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loadInsectImageIndexes } from '../services/imageIndex';
import { globalJapaneseToScientificMapping } from '../utils/insectImageMappings';
import {
  buildInsectImageBaseCandidates,
  buildNormalizedEntries,
  resolveImageBaseCandidates,
} from '../utils/insectImageResolver';

const createCacheBustQuery = (useAssetVersionInProd) => {
  if (import.meta.env.DEV) return `?v=${Date.now()}`;
  if (useAssetVersionInProd && import.meta.env.VITE_ASSET_VERSION) {
    return `?v=${import.meta.env.VITE_ASSET_VERSION}`;
  }
  return '';
};

const useInsectImageCandidates = (options = {}) => {
  const { useAssetVersionInProd = false } = options;
  const [imageExtensions, setImageExtensions] = useState({});
  const [imageBases, setImageBases] = useState(new Set());

  useEffect(() => {
    loadInsectImageIndexes()
      .then(({ names, exts }) => {
        setImageExtensions(exts || {});
        setImageBases(new Set(names || []));
      })
      .catch(() => {
        setImageExtensions({});
        setImageBases(new Set());
      });
  }, []);

  const cacheBustRef = useRef(createCacheBustQuery(useAssetVersionInProd));
  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const placeholderSrc = `${normalizedBase}images/placeholder.jpg${cacheBustRef.current}`;

  const normalizedEntries = useMemo(
    () => buildNormalizedEntries(imageBases, imageExtensions),
    [imageBases, imageExtensions],
  );

  const buildImageUrl = useCallback((base) => {
    if (!base) return '';
    const ext = imageExtensions[base] || '.jpg';
    return `${normalizedBase}images/insects/${encodeURIComponent(base)}${ext}${cacheBustRef.current}`;
  }, [imageExtensions, normalizedBase]);

  const getImageCandidates = useCallback((insect) => {
    if (!insect) return [];
    const mappedFilename = globalJapaneseToScientificMapping.get(insect.name);
    const candidateBases = buildInsectImageBaseCandidates(insect, mappedFilename);
    const resolvedBases = resolveImageBaseCandidates(candidateBases, {
      imageExtensions,
      imageNames: imageBases,
      normalizedEntries,
    });
    if (resolvedBases.length === 0 && candidateBases.length > 0) {
      resolvedBases.push(candidateBases[0]);
    }
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
  }, [buildImageUrl, imageBases, imageExtensions, normalizedEntries]);

  return {
    getImageCandidates,
    placeholderSrc,
  };
};

export default useInsectImageCandidates;
