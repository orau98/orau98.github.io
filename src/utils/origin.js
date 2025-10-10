// Centralized base origin helper for absolute URLs used in meta/canonical/JSON-LD.
// On client: prefer window.location.origin when hosted, fallback to env, then hardcoded prod.
// On Node (build-scripts): allow process.env.BASE_ORIGIN override; fallback to prod.

export function getBaseOriginClient() {
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      return window.location.origin;
    }
  } catch (_) {}
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_BASE_ORIGIN) {
      return import.meta.env.VITE_BASE_ORIGIN;
    }
  } catch (_) {}
  return 'https://orau98.github.io';
}

// Small utility to build absolute URL from path (ensures single slash)
export function absUrl(pathname = '/') {
  const base = getBaseOriginClient().replace(/\/$/, '');
  const path = String(pathname || '/').startsWith('/') ? pathname : `/${pathname}`;
  return `${base}${path}`;
}
