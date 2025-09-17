import { VersionedCache } from './versionedCache.js'

// Simple HTTP fetcher with versioned local cache.
// Usage: const html = await fetchWithCache(url, { key: 'jbeetles-134-6', version: '2025-08-29', force: false })
export async function fetchWithCache(
  url,
  { key, version = '1', force = false, ext = 'html' } = {}
) {
  if (!key) {
    // default key from URL
    try {
      const u = new URL(url)
      key = `http-${u.hostname}${u.pathname}`
    } catch {
      key = `http-generic`
    }
  }
  const cache = new VersionedCache()
  const cacheExists = cache.has(key, version, ext)
  if (!force && cacheExists) {
    return cache.readText(key, version, ext)
  }
  try {
    // Node 18+ has global fetch
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
    }
    const text = await res.text()
    cache.writeText(key, version, text, ext)
    return text
  } catch (err) {
    if (cacheExists) {
      console.warn(
        `fetchWithCache: falling back to cached ${key}@${version}.${ext}:`,
        err instanceof Error ? err.message : err
      )
      return cache.readText(key, version, ext)
    }
    throw err
  }
}
