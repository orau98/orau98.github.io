import { useEffect, useMemo, useRef } from 'react';

// Small helpers
const ensureMeta = (selector, attrs) => {
  let el = document.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  return el;
};

const setMetaContent = (selector, content) => {
  const el = document.querySelector(selector);
  if (el) el.setAttribute('content', content);
};

import { absUrl } from '../utils/origin';

export default function useSeoMeta(rawOptions) {
  const options = rawOptions ?? {};
  const {
    enabled = true,
    title,
    description,
    ogType = 'website',
    url,
    imageUrl,
    imageAlt,
    siteName = '昆虫植物図鑑',
    locale = 'ja_JP',
    breadcrumbItems, // [{name, url}] order is important
    resetCanonicalTo = absUrl('/'),
  } = options;

  const isActive = enabled !== false;

  const insertedScriptIdsRef = useRef([]);
  const managedMetaSelectorsRef = useRef([
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:type"]',
    'meta[property="og:url"]',
    'meta[property="og:image"]',
    'meta[property="og:image:alt"]',
    'meta[property="og:site_name"]',
    'meta[property="og:locale"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:alt"]',
  ]);

  const breadcrumbSignature = useMemo(() => JSON.stringify(breadcrumbItems), [breadcrumbItems]);

  useEffect(() => {
    if (!isActive) {
      return undefined;
    }
    const managedMetaSelectors = managedMetaSelectorsRef.current;
    if (title) document.title = title;

    // description
    let descMeta = document.querySelector('meta[name="description"]');
    if (!descMeta) {
      descMeta = document.createElement('meta');
      descMeta.name = 'description';
      document.head.appendChild(descMeta);
    }
    if (description) descMeta.content = description;

    // OG/Twitter
    ensureMeta('meta[property="og:title"]', { property: 'og:title' });
    setMetaContent('meta[property="og:title"]', title || '');
    ensureMeta('meta[property="og:description"]', { property: 'og:description' });
    setMetaContent('meta[property="og:description"]', description || '');
    ensureMeta('meta[property="og:type"]', { property: 'og:type' });
    setMetaContent('meta[property="og:type"]', ogType);
    ensureMeta('meta[property="og:site_name"]', { property: 'og:site_name' });
    setMetaContent('meta[property="og:site_name"]', siteName || '');
    ensureMeta('meta[property="og:locale"]', { property: 'og:locale' });
    setMetaContent('meta[property="og:locale"]', locale || '');
    if (url) {
      ensureMeta('meta[property="og:url"]', { property: 'og:url' });
      setMetaContent('meta[property="og:url"]', url);
    }
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card' });
    setMetaContent('meta[name="twitter:card"]', imageUrl ? 'summary_large_image' : 'summary');
    ensureMeta('meta[name="twitter:title"]', { name: 'twitter:title' });
    setMetaContent('meta[name="twitter:title"]', title || '');
    ensureMeta('meta[name="twitter:description"]', { name: 'twitter:description' });
    setMetaContent('meta[name="twitter:description"]', description || '');
    if (imageUrl) {
      ensureMeta('meta[property="og:image"]', { property: 'og:image' });
      setMetaContent('meta[property="og:image"]', imageUrl);
      ensureMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' });
      setMetaContent('meta[property="og:image:alt"]', imageAlt || title || '');
      ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image' });
      setMetaContent('meta[name="twitter:image"]', imageUrl);
      ensureMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' });
      setMetaContent('meta[name="twitter:image:alt"]', imageAlt || title || '');
    }

    // canonical
    if (url) {
      let canon = document.querySelector('link[rel="canonical"]');
      if (!canon) {
        canon = document.createElement('link');
        canon.rel = 'canonical';
        document.head.appendChild(canon);
      }
      canon.href = url;
    }

    // Minimal WebPage structured data fallback for better eligibility
    try {
      const id = 'webpage-structured-data';
      let s = document.querySelector('#' + id);
      if (!s) {
        s = document.createElement('script');
        s.id = id;
        s.type = 'application/ld+json';
        document.head.appendChild(s);
      }
      const pageUrl = url || (typeof window !== 'undefined' ? window.location.href : undefined) || '';
      const schemaLanguage = locale ? String(locale).replace('_', '-') : 'ja-JP';
      const pageLastModified = (() => {
        try {
          const raw = typeof document !== 'undefined' ? document.lastModified : '';
          const ms = Date.parse(raw || '');
          return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
        } catch {
          return undefined;
        }
      })();
      s.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        url: pageUrl,
        name: title || '',
        description: description || '',
        inLanguage: schemaLanguage,
        ...(pageLastModified ? { dateModified: pageLastModified } : {}),
      });
      insertedScriptIdsRef.current.push(id);
    } catch {}

    // breadcrumb JSON-LD
    if (Array.isArray(breadcrumbItems) && breadcrumbItems.length > 0) {
      const id = 'breadcrumb-structured-data';
      let s = document.querySelector('#' + id);
      if (!s) {
        s = document.createElement('script');
        s.id = id;
        s.type = 'application/ld+json';
        document.head.appendChild(s);
      }
      s.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((it, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: it.name,
          item: it.url,
        })),
      });
      insertedScriptIdsRef.current.push(id);
    }

    return () => {
      // reset canonical (if requested)
      if (resetCanonicalTo) {
        const c = document.querySelector('link[rel="canonical"]');
        if (c) c.href = resetCanonicalTo;
      }
      // remove managed meta tags we may have inserted
      managedMetaSelectors.forEach((sel) => {
        const el = document.querySelector(sel);
        if (el) el.parentElement && el.parentElement.removeChild(el);
      });
      // remove inserted scripts
      insertedScriptIdsRef.current.forEach((id) => {
        const s = document.querySelector('#' + id);
        if (s) s.remove();
      });
      insertedScriptIdsRef.current = [];
    };
  }, [isActive, title, description, ogType, url, imageUrl, imageAlt, breadcrumbItems, breadcrumbSignature, resetCanonicalTo]);

  // Expose helper to set/update OG/Twitter image later (e.g., after <img> loads)
  const setOgTwitterImage = (imgUrl, alt) => {
    if (!isActive) return;
    if (!imgUrl) return;
    ensureMeta('meta[property="og:image"]', { property: 'og:image' });
    setMetaContent('meta[property="og:image"]', imgUrl);
    ensureMeta('meta[property="og:image:alt"]', { property: 'og:image:alt' });
    setMetaContent('meta[property="og:image:alt"]', alt || '');
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card' });
    setMetaContent('meta[name="twitter:card"]', 'summary_large_image');
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image' });
    setMetaContent('meta[name="twitter:image"]', imgUrl);
    ensureMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' });
    setMetaContent('meta[name="twitter:image:alt"]', alt || '');
  };

  return { setOgTwitterImage };
}
