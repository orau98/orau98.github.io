// Preload and cache image filename indexes shared across components

let _plantImageNames = null; // array of strings without extension
let _plantImageLoading = null;

export const loadPlantImageFilenames = async () => {
  if (_plantImageNames) return _plantImageNames;
  if (_plantImageLoading) return _plantImageLoading;
  _plantImageLoading = (async () => {
    try {
      const url = import.meta.env.DEV
        ? `${import.meta.env.BASE_URL}plant_image_filenames.txt?v=${Date.now()}`
        : `${import.meta.env.BASE_URL}plant_image_filenames.txt`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const list = text.split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(line => (line.includes('→') ? line.split('→')[1].trim() : line));
      _plantImageNames = list;
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

export const loadInsectImageIndexes = async () => {
  if (_insectImageNames && _insectExtMap) return { names: _insectImageNames, exts: _insectExtMap };
  if (_insectLoading) return _insectLoading;
  _insectLoading = (async () => {
    try {
      const base = import.meta.env.BASE_URL || '/';
      // Add cache-busting even in production to avoid stale indexes on Pages
      const bust = `?v=${Date.now()}`;
      // Try combined lite index first
      const liteUrl = `${base}assets/data-lite/image-index.json${bust}`;
      let namesSet = null;
      let extsMap = null;
      try {
        const res = await fetch(liteUrl, { cache: import.meta.env.DEV ? 'no-store' : 'default' });
        if (res.ok) {
          const json = await res.json();
          const arr = Array.isArray(json.names) ? json.names : Object.keys(json.exts || {});
          namesSet = new Set(arr.map(s => String(s).trim()).filter(Boolean));
          extsMap = json.exts || {};
        }
      } catch {}
      if (!namesSet || !extsMap) {
        const [namesRes, extsRes] = await Promise.all([
          fetch(`${base}image_filenames.txt${bust}`),
          fetch(`${base}image_extensions.json${bust}`),
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
