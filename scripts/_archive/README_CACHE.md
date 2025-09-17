Versioned Local Cache
=====================

This repo now includes a tiny versioned local cache under `cache/` to snapshot inputs/outputs and to cache fetched HTML when scraping.

Files
- `scripts/lib/versionedCache.js`: Minimal helper for reading/writing `v<version>` files per key.
- `scripts/lib/fetchWithCache.js`: Wrapper around `fetch()` that stores responses in the cache.

LB Classification workflow
- Run `npm run fill-lb` (or `node scripts/fill_lb_classification.js --cache --cache-version=<v>`)
- Outputs:
  - `cache/lb-before/v<v>.json`: LB rows before update
  - `cache/lb-after/v<v>.json`: LB rows after update
  - `cache/lb-changes/v<v>.json`: per-row before/after diff
  - `cache/insects-csv/v<v>.csv`: full CSV snapshot after update

HTTP caching example
```bash
node -e "import('./lib/fetchWithCache.js').then(async m => { const html = await m.fetchWithCache('https://example.com', { key: 'example', version: '2025-08-29' }); console.log(html.slice(0,80)); })"
```

Notes
- Bump the cache version (`--cache-version`) to create a new snapshot set.
- Cache manifest: `cache/manifest.json` lists stored versions and paths.
- When a fetch fails and a cached `key@version` exists, `fetchWithCache()` now logs a warning and falls back to the cached contents so data workflows remain resilient offline.
