import fetchWithRetryShared from '../utils/fetchWithRetry';
import { buildDataLiteAssetUrl } from '../utils/dataLitePlan';
import { getPlantProfileBucketFile } from '../utils/speciesRecordKey';

/**
 * 画面の途中で追加の小さなデータ（植物プロフィール本文など）を読むための共通口。
 * 版数（?v=）はAppがmanifestを読んだ時点で設定し、本体データと同じ版のファイルを取る。
 */
let versionSuffix = '';
const cache = new Map();

export const setDataLiteVersionSuffix = (suffix = '') => {
  if (suffix !== versionSuffix) cache.clear();
  versionSuffix = suffix || '';
};

export const fetchDataLiteJson = (file) => {
  const url = buildDataLiteAssetUrl(import.meta.env?.BASE_URL || '/', file, versionSuffix);
  if (cache.has(url)) return cache.get(url);
  const task = fetchWithRetryShared(url, { cache: import.meta.env?.DEV ? 'no-store' : 'default' }, { retries: 3, delay: 300 })
    .then((response) => {
      if (!response?.ok) throw new Error(`Dataset request failed: ${file} (${response?.status})`);
      return response.json();
    })
    .catch((error) => {
      cache.delete(url);
      throw error;
    });
  cache.set(url, task);
  return task;
};

/**
 * 植物プロフィール本文を返す。plantDetails の profile が
 * - オブジェクト（完全データ・旧キャッシュ）ならそのまま
 * - 数値（軽量版: バケット番号+1）なら plant-profiles/ から読む
 */
export const loadPlantProfile = async (plantName, profileRef) => {
  if (profileRef && typeof profileRef === 'object') return profileRef;
  const bucketNumber = Number(profileRef);
  if (!plantName || !Number.isInteger(bucketNumber) || bucketNumber < 1) return null;
  const bucket = await fetchDataLiteJson(getPlantProfileBucketFile(bucketNumber - 1));
  const profile = bucket?.[plantName];
  return profile && typeof profile === 'object' ? profile : null;
};
