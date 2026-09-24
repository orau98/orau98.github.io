/**
 * 詳細ページ用の「1種ずつのデータ」を小さなファイル（バケット）に分けて置くための共通規則。
 * ビルド（scripts/build-data-lite.mjs）とブラウザ（dataPartitionLoader / HostPlantDetail）が
 * 同じ関数でファイル名を決めるので、どちらか一方だけ変えて食い違うことがない。
 */

// FNV-1a（32bit）。暗号用途ではなく、名前を均等にバケットへ振り分けるためだけに使う
export const hashRecordKey = (value = '') => {
  const text = String(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

export const normalizeRecordKey = (value = '') => String(value ?? '').trim();

export const getRecordBucketIndex = (key, bucketCount) =>
  hashRecordKey(normalizeRecordKey(key)) % Math.max(1, Number(bucketCount) || 1);

/** 1バケットあたりおよそ perBucket 件になる2の累乗のバケット数 */
export const chooseBucketCount = (recordCount, perBucket = 12) => {
  const target = Math.max(1, Math.ceil((Number(recordCount) || 0) / perBucket));
  let count = 1;
  while (count < target) count *= 2;
  return count;
};

export const getSpeciesBucketFile = (collectionKey, key, bucketCount) =>
  `species/${collectionKey}/${getRecordBucketIndex(key, bucketCount)}.json`;

export const getPlantProfileBucketFile = (bucketIndex) => `plant-profiles/${bucketIndex}.json`;
