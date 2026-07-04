// Preload and cache image filename indexes shared across components
import fetchWithRetryBase from '../utils/fetchWithRetry';

// 索引取得は「HTTPエラーも例外」「過負荷時は最低3秒待つ」契約で共有utilを使う
const fetchWithRetry = (url, opts = {}, retries = 2, delay = 250) =>
  fetchWithRetryBase(url, opts, {
    retries,
    delay,
    throwOnHttpError: true,
    minProtectedDelayMs: 3000,
  });

const ASSET_VERSION = import.meta.env.VITE_ASSET_VERSION || 'dev';

let _plantImageNames = null; // array of strings without extension
let _plantImageLoading = null;
let _plantImageVersion = null;
let _plantImageErrorAt = 0;


// ロード済みなら植物画像ファイル名一覧を同期的に返す（未ロードはnull）。
// 返り値は読み取り専用として扱うこと。
export const getCachedPlantImageFilenames = () => _plantImageNames;

export const loadPlantImageFilenames = async () => {
  if (_plantImageVersion !== ASSET_VERSION) {
    _plantImageNames = null;
    _plantImageLoading = null;
    _plantImageVersion = ASSET_VERSION;
    _plantImageErrorAt = 0;
  }
  // If previous load failed, allow periodic retry instead of caching [] forever.
  if (Array.isArray(_plantImageNames) && _plantImageNames.length === 0) {
    const retryAfterMs = 30 * 1000;
    if (Date.now() - _plantImageErrorAt < retryAfterMs) {
      return _plantImageNames;
    }
    _plantImageNames = null;
  }
  if (_plantImageNames) return _plantImageNames;
  if (_plantImageLoading) return _plantImageLoading;
  _plantImageLoading = (async () => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const ver = import.meta.env.DEV ? `${Date.now()}` : (import.meta.env.VITE_ASSET_VERSION || '');
      const bust = ver ? `?v=${ver}` : '';
      const url = `${base}plant_image_filenames.txt${bust}`;
      const res = await fetchWithRetry(
        url,
        { cache: import.meta.env.DEV ? 'no-store' : 'default' },
        2,
        200
      );
      const text = await res.text();
      const list = text.split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(line => (line.includes('→') ? line.split('→')[1].trim() : line));
      _plantImageNames = list;
      _plantImageVersion = ASSET_VERSION;
      _plantImageErrorAt = 0;
      return _plantImageNames;
    } catch {
      _plantImageNames = [];
      _plantImageErrorAt = Date.now();
      return _plantImageNames;
    } finally {
      _plantImageLoading = null;
    }
  })();
  return _plantImageLoading;
};

let _insectImageNames = null; // set of bases for insects
let _insectExtMap = null; // map base -> extension (e.g., .jpg)
let _insectLoading = null;

// ロード済みならインデックスを同期的に返す（未ロードはnull）。
// 詳細ページから一覧へ戻った際、非同期解決を待たずに初回レンダーから
// 画像ファイル名を確定させるために使う。返り値は読み取り専用として扱うこと。
export const getCachedInsectImageIndexes = () =>
  _insectImageNames && _insectExtMap
    ? { names: _insectImageNames, exts: _insectExtMap }
    : null;

export const loadInsectImageIndexes = async () => {
  if (_insectImageNames && _insectExtMap) return { names: _insectImageNames, exts: _insectExtMap };
  if (_insectLoading) return _insectLoading;
  _insectLoading = (async () => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      // Cache-bust using build asset version in production; DEV uses Date.now()
      const ver = (import.meta.env.DEV ? String(Date.now()) : (import.meta.env.VITE_ASSET_VERSION || ''));
      const bust = ver ? `?v=${ver}` : '';
      // Try combined lite index first
      const liteUrl = `${base}assets/data-lite/image-index.json${bust}`;
      let namesSet = null;
      let extsMap = null;
      try {
        const res = await fetchWithRetry(liteUrl, { cache: import.meta.env.DEV ? 'no-store' : 'default' }, 2, 200);
        if (res.ok) {
          const json = await res.json();
          const arr = Array.isArray(json.names) ? json.names : Object.keys(json.exts || {});
          namesSet = new Set(arr.map(s => String(s).trim()).filter(Boolean));
          extsMap = json.exts || {};
        }
      } catch {}
      if (!namesSet || !extsMap) {
        const [namesRes, extsRes] = await Promise.all([
          fetchWithRetry(`${base}image_filenames.txt${bust}`, {}, 2, 200),
          fetchWithRetry(`${base}image_extensions.json${bust}`, {}, 2, 200),
        ]);
        const namesText = namesRes.ok ? await namesRes.text() : '';
        namesSet = new Set(namesText.split('\n').map(s => s.trim()).filter(Boolean));
        extsMap = extsRes.ok ? await extsRes.json() : {};
      }
      _insectImageNames = namesSet;
      _insectExtMap = extsMap;
      return { names: _insectImageNames, exts: _insectExtMap };
    } catch {
      _insectImageNames = new Set();
      _insectExtMap = {};
      return { names: _insectImageNames, exts: _insectExtMap };
    } finally {
      _insectLoading = null;
    }
  })();
  return _insectLoading;
};
