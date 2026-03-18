import logger from '../utils/logger';

const DATA_CACHE_DB = 'ihpe-cache';
const DATA_CACHE_STORE = 'datasets';
const DATA_CACHE_KEY = 'full-dataset';
const CACHE_SCHEMA_VERSION = 1;

const openCacheDb = () => {
  if (typeof window === 'undefined' || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATA_CACHE_DB, CACHE_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DATA_CACHE_STORE)) {
        db.createObjectStore(DATA_CACHE_STORE);
      }
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
};

export const loadDatasetFromCache = async () => {
  try {
    const db = await openCacheDb();
    if (!db) return null;
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(DATA_CACHE_STORE, 'readonly');
      const store = tx.objectStore(DATA_CACHE_STORE);
      const req = store.get(DATA_CACHE_KEY);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || null);
    });
  } catch (error) {
    logger.debug('Dataset cache load failed:', error);
    return null;
  }
};

export const saveDatasetToCache = async (version, payload) => {
  try {
    const db = await openCacheDb();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(DATA_CACHE_STORE, 'readwrite');
      const store = tx.objectStore(DATA_CACHE_STORE);
      const req = store.put(
        {
          version,
          timestamp: Date.now(),
          payload,
        },
        DATA_CACHE_KEY,
      );
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  } catch (error) {
    logger.debug('Dataset cache save failed:', error);
  }
};
