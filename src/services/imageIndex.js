// Preload and cache image filename indexes shared across components

const ASSET_VERSION = import.meta.env.VITE_ASSET_VERSION || 'dev';

let _plantImageNames = null; // array of strings without extension
let _plantImageLoading = null;
let _plantImageVersion = null;

export const loadPlantImageFilenames = async () => {
  if (_plantImageVersion !== ASSET_VERSION) {
    _plantImageNames = null;
    _plantImageLoading = null;
    _plantImageVersion = ASSET_VERSION;
  }
  if (_plantImageNames) return _plantImageNames;
  if (_plantImageLoading) return _plantImageLoading;
  _plantImageLoading = (async () => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      const ver = import.meta.env.DEV ? `${Date.now()}` : (import.meta.env.VITE_ASSET_VERSION || '');
      const bust = ver ? `?v=${ver}` : '';
      const url = `${base}plant_image_filenames.txt${bust}`;
      const res = await fetch(url, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const list = text.split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(line => (line.includes('→') ? line.split('→')[1].trim() : line));
      _plantImageNames = list;
      _plantImageVersion = ASSET_VERSION;
      return _plantImageNames;
    } catch (e) {
      _plantImageNames = [];
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

const fetchWithRetry = async (url, opts = {}, retries = 2, delay = 250) => {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      lastErr = e;
      if (i < retries) {
        await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
        continue;
      }
    }
  }
  throw lastErr;
};

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
