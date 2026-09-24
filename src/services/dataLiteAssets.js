import fetchWithRetryShared from '../utils/fetchWithRetry';
import { buildDataLiteAssetUrl } from '../utils/dataLitePlan';
import { getPlantProfileBucketFile } from '../utils/speciesRecordKey';

/**
 * 画面の途中で追加の小さなデータ（植物プロフィール本文など）を読むための共通口。
 * 版数（?v=）はAppがmanifestを読んだ時点で設定し、本体データと同じ版のファイルを取る。
 */
let versionSuffix = '';
const cache = new Map();
// 読み終えたプロフィールのバケット（番号 → { 植物名: 本文 }）。描画時に同期で引けるようにする
const resolvedProfileBuckets = new Map();

export const setDataLiteVersionSuffix = (suffix = '') => {
  if (suffix !== versionSuffix) {
    cache.clear();
    resolvedProfileBuckets.clear();
  }
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
  if (bucket && typeof bucket === 'object') resolvedProfileBuckets.set(bucketNumber, bucket);
  const profile = bucket?.[plantName];
  return profile && typeof profile === 'object' ? profile : null;
};

/** 既に読み終えていれば同期で本文を返す（未取得なら undefined）。初回描画から解説を出して表示のずれを防ぐ */
export const getCachedPlantProfile = (plantName, profileRef) => {
  if (profileRef && typeof profileRef === 'object') return profileRef;
  const bucket = resolvedProfileBuckets.get(Number(profileRef));
  if (!bucket) return undefined;
  const profile = bucket[plantName];
  return profile && typeof profile === 'object' ? profile : null;
};

/** 植物ページを開いたら、ページの描画を待たずに解説本文の取得を始める */
export const prefetchPlantProfile = (plantName, profileRef) => {
  if (!plantName || !profileRef || typeof profileRef === 'object') return;
  loadPlantProfile(plantName, profileRef).catch(() => {});
};
