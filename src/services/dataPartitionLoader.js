import { INSECT_COLLECTION_KEYS } from '../utils/siteTaxonomy.js';
import {
  getCollectionPartitionFile,
  getDetailRecordStateKey,
  normalizeDatasetPayload,
} from '../utils/dataLitePlan.js';
import { getSpeciesBucketFile } from '../utils/speciesRecordKey.js';

// plantDetails は画面用の軽量版（プロフィール本文は plant-profiles/ に分離）
const PLANT_FILES = {
  hostPlants: 'hostplants.json',
  plantDetails: 'plant-details-lite.json',
  flowerVisitPlants: 'flower-visit-plants.json',
};
const isMap = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

// A truncated combined file/cache must not turn omitted partitions into verified zeroes.
export const isCompleteDatasetPayload = (payload) => Boolean(
  payload && INSECT_COLLECTION_KEYS.every((key) => Array.isArray(payload[key])) &&
  Object.keys(PLANT_FILES).every((key) => isMap(payload[key])),
);

/** State machine shared by initial loads, SPA navigation and explicit retries.
 * Successful partitions survive other failures. In-flight work is deduplicated;
 * failed work is released so the next request can retry it.
 */
export const createDataPartitionLoader = ({
  readJson,
  onCollection = () => {},
  onPlants = () => {},
  onState = () => {},
  onComplete = () => {},
  isActive = () => true,
  initialPayload = null,
  summaryCounts = null,
  speciesBuckets = null,
}) => {
  const levels = new Map();
  const collections = {};
  const plants = {};
  const pending = new Map();
  const errors = new Map();
  const errorLevels = new Map();
  const requestedLevels = new Map();
  // 詳細ページ用に先に届いた完全な1件（分類ごと id → レコード）と、その到着状況
  const detailRecordsById = new Map();
  const detailRecords = new Map();
  let revision = 0;
  let savedRevision = -1;

  const getState = () => ({
    collectionLevels: Object.fromEntries(levels),
    plantsReady: Object.keys(PLANT_FILES).every((key) => key in plants),
    errors: Object.fromEntries(errors),
    errorLevels: Object.fromEntries(errorLevels),
    detailRecords: Object.fromEntries(detailRecords),
  });
  const emit = () => {
    if (!isActive()) return;
    const state = getState();
    onState(state);
    if (levels.size === INSECT_COLLECTION_KEYS.length && state.plantsReady && savedRevision !== revision) {
      savedRevision = revision;
      onComplete({ ...collections, ...plants, summaryCounts });
    }
  };

  const ensureCollection = async (key, detailLevel) => {
    if (!INSECT_COLLECTION_KEYS.includes(key) || !isActive()) return;
    // Serialize catalog/full requests for the same classification only.
    // An older catalog response can never overwrite a successful full response.
    const existing = pending.get(key);
    if (existing) {
      await existing.promise;
      if (levels.get(key) === 'full' || levels.get(key) === detailLevel) return;
      // Share a failed request at the same level, but still allow the other
      // level to be tried (e.g. a working catalog after a failed full file).
      if (existing.level === detailLevel) return;
      return ensureCollection(key, detailLevel);
    }
    if (!isActive() || levels.get(key) === 'full' || levels.get(key) === detailLevel) return;
    requestedLevels.set(key, detailLevel);
    if (errorLevels.get(key) === detailLevel) errors.delete(key);
    const file = getCollectionPartitionFile(key, detailLevel);
    const task = Promise.resolve().then(async () => {
      try {
        const records = await readJson(file);
        if (!isActive()) return;
        if (!Array.isArray(records) || (detailLevel === 'full' && records.some((row) => row?._detail === false))) {
          throw new Error(`Invalid collection: ${file}`);
        }
        collections[key] = detailLevel === 'catalog' ? mergeDetailRecords(key, records) : records;
        levels.set(key, detailLevel);
        if (detailLevel === 'full' || errorLevels.get(key) !== 'full') {
          errors.delete(key);
          errorLevels.delete(key);
        }
        revision += 1;
        onCollection(key, collections[key]);
      } catch (error) {
        if (isActive()) {
          errors.set(key, error);
          errorLevels.set(key, detailLevel);
        }
      } finally {
        pending.delete(key);
        emit();
      }
    });
    pending.set(key, { promise: task, level: detailLevel });
    emit();
    return task;
  };

  // 一覧用の軽量データ（catalog）に、先に読んだ完全な1件を差し戻す
  // （後から届いたcatalogで詳細表示中の種が軽量版に戻らないように）
  function mergeDetailRecords(key, records) {
    const byId = detailRecordsById.get(key);
    if (!byId || byId.size === 0) return records;
    return records.map((row) => (row?.id && byId.has(row.id) ? byId.get(row.id) : row));
  }

  const ensureDetailRecord = async ({ collectionKey, routeKey } = {}) => {
    if (!INSECT_COLLECTION_KEYS.includes(collectionKey) || !routeKey || !isActive()) return;
    const stateKey = getDetailRecordStateKey({ collectionKey, routeKey });
    if (levels.get(collectionKey) === 'full' || detailRecords.get(stateKey) === true) return;
    const bucketCount = Number(speciesBuckets?.[collectionKey]) || 0;
    // 1件用のファイルが無い（旧データ・同名で曖昧・読み込み失敗）ときは従来どおり分類の完全データ
    const fallbackToFull = () => ensureCollection(collectionKey, 'full');
    if (!bucketCount || detailRecords.get(stateKey) === false) return fallbackToFull();
    const pendingKey = `detail:${stateKey}`;
    if (pending.has(pendingKey)) return pending.get(pendingKey).promise;
    const task = Promise.resolve().then(async () => {
      let record = null;
      try {
        const bucket = await readJson(getSpeciesBucketFile(collectionKey, routeKey, bucketCount));
        if (!isActive()) return;
        const id = bucket?.keys?.[routeKey];
        const candidate = id ? bucket?.records?.[id] : null;
        if (candidate && candidate.id === id && candidate._detail !== false) record = candidate;
      } catch {
        record = null;
      } finally {
        pending.delete(pendingKey);
      }
      if (!isActive()) return;
      if (!record) {
        detailRecords.set(stateKey, false);
        await fallbackToFull();
        return;
      }
      if (levels.get(collectionKey) === 'full') {
        emit();
        return;
      }
      if (!detailRecordsById.has(collectionKey)) detailRecordsById.set(collectionKey, new Map());
      detailRecordsById.get(collectionKey).set(record.id, record);
      detailRecords.set(stateKey, true);
      if (collections[collectionKey]) {
        const current = collections[collectionKey];
        const merged = mergeDetailRecords(collectionKey, current);
        collections[collectionKey] = merged.some((row) => row?.id === record.id)
          ? merged
          : [...merged, record];
        revision += 1;
        onCollection(collectionKey, collections[collectionKey]);
      } else {
        // 分類のデータがまだ無い間は、その1件だけを画面へ渡す（collections には入れない）
        onCollection(collectionKey, [record]);
      }
      emit();
    });
    pending.set(pendingKey, { promise: task });
    return task;
  };

  const ensurePlant = async (key) => {
    if (!isActive() || key in plants) return;
    if (pending.has(key)) return pending.get(key).promise;
    errors.delete(key);
    const task = Promise.resolve().then(async () => {
      try {
        const payload = await readJson(PLANT_FILES[key]);
        if (!isActive()) return;
        if (!isMap(payload)) throw new Error(`Invalid plant partition: ${key}`);
        plants[key] = payload;
        errors.delete(key);
        revision += 1;
        onPlants({ ...plants });
      } catch (error) {
        if (isActive()) errors.set(key, error);
      } finally {
        pending.delete(key);
        emit();
      }
    });
    pending.set(key, { promise: task });
    emit();
    return task;
  };

  const ensureTypes = (keys = INSECT_COLLECTION_KEYS, level = 'catalog') =>
    Promise.all(keys.map((key) => ensureCollection(key, level)));
  const ensurePlants = () => Promise.all(Object.keys(PLANT_FILES).map(ensurePlant));
  const retryFailures = (plan = null) => Promise.all([...errors.keys()]
    .filter((key) => !plan || errorLevels.get(key) !== 'full' ||
      (plan.immediateDetailLevel === 'full' && plan.immediateCollectionKeys.includes(key)) ||
      (plan.requiredFullCollectionKeys || []).includes(key))
    .map((key) => key in PLANT_FILES ? ensurePlant(key) :
      ensureCollection(key, errorLevels.get(key) || requestedLevels.get(key))));
  const ensurePlan = (plan) => {
    const detail = plan.detailRecord;
    const useDetailRecord = Boolean(detail && plan.loadTypesImmediately);
    // 詳細の分類は、完全データ(full)の代わりに該当種の1件だけを読む
    const immediateKeys = useDetailRecord && plan.immediateDetailLevel === 'full'
      ? plan.immediateCollectionKeys.filter((key) => key !== detail.collectionKey)
      : plan.immediateCollectionKeys;
    return Promise.all([
      plan.loadTypesImmediately && immediateKeys.length
        ? ensureTypes(immediateKeys, plan.immediateDetailLevel) : null,
      useDetailRecord ? ensureDetailRecord(detail) : null,
      plan.requiredFullCollectionKeys?.length ? ensureTypes(plan.requiredFullCollectionKeys, 'full') : null,
      plan.loadPlantsImmediately ? ensurePlants() : null,
    ]);
  };

  if (isCompleteDatasetPayload(initialPayload)) {
    const normalized = normalizeDatasetPayload(initialPayload);
    for (const key of INSECT_COLLECTION_KEYS) {
      const records = normalized.collections[key];
      collections[key] = records;
      levels.set(key, records.some((row) => row?._detail === false) ? 'catalog' : 'full');
      onCollection(key, records);
    }
    Object.assign(plants, {
      hostPlants: normalized.hostPlants,
      plantDetails: normalized.plantDetails,
      flowerVisitPlants: normalized.flowerVisitPlants,
    });
    onPlants({ ...plants });
  }
  emit();
  return { ensureTypes, ensurePlants, ensurePlan, ensureDetailRecord, retryFailures, getState };
};
