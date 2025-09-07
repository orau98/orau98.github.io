import { useEffect, useRef } from 'react';

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

export default function useSeoMeta(options = {}) {
  const {
    title,
    description,
    ogType = 'website',
    url,
    imageUrl,
    imageAlt,
    breadcrumbItems, // [{name, url}] order is important
    resetCanonicalTo = 'https://orau98.github.io/',
  } = options;

  const insertedScriptIdsRef = useRef([]);
  const managedMetaSelectorsRef = useRef([
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:type"]',
    'meta[property="og:url"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:alt"]',
  ]);

  useEffect(() => {
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
    if (url) {
      ensureMeta('meta[property="og:url"]', { property: 'og:url' });
      setMetaContent('meta[property="og:url"]', url);
    }
    if (imageUrl) {
      ensureMeta('meta[property="og:image"]', { property: 'og:image' });
      setMetaContent('meta[property="og:image"]', imageUrl);
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
      managedMetaSelectorsRef.current.forEach((sel) => {
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
  }, [title, description, ogType, url, imageUrl, imageAlt, JSON.stringify(breadcrumbItems)]);

  // Expose helper to set/update OG/Twitter image later (e.g., after <img> loads)
  const setOgTwitterImage = (imgUrl, alt) => {
    if (!imgUrl) return;
    ensureMeta('meta[property="og:image"]', { property: 'og:image' });
    setMetaContent('meta[property="og:image"]', imgUrl);
    ensureMeta('meta[name="twitter:image"]', { name: 'twitter:image' });
    setMetaContent('meta[name="twitter:image"]', imgUrl);
    ensureMeta('meta[name="twitter:image:alt"]', { name: 'twitter:image:alt' });
    setMetaContent('meta[name="twitter:image:alt"]', alt || '');
  };

  return { setOgTwitterImage };
}

