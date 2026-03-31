import { useEffect, useState } from 'react';

const ROUTE_MAP_FILES = Object.freeze({
  insects: 'seo-route-map.insects.json',
  plants: 'seo-route-map.plants.json',
});

const EMPTY_ROUTE_MAP = Object.freeze({});
const routeMapCache = new Map();
const routeMapPromises = new Map();

const normalizeRouteMap = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return EMPTY_ROUTE_MAP;
  }
  return payload;
};

const getRouteMapUrl = (kind) => {
  const fileName = ROUTE_MAP_FILES[kind];
  if (!fileName) return null;
  const base = import.meta.env.BASE_URL || '/';
  const versionSuffix = import.meta.env.DEV
    ? `?v=${Date.now()}`
    : import.meta.env.VITE_ASSET_VERSION
      ? `?v=${import.meta.env.VITE_ASSET_VERSION}`
      : '';
  return `${base}${fileName}${versionSuffix}`;
};

export const loadSeoRouteMap = async (kind) => {
  if (routeMapCache.has(kind)) {
    return routeMapCache.get(kind);
  }
  if (routeMapPromises.has(kind)) {
    return routeMapPromises.get(kind);
  }

  const routeMapUrl = getRouteMapUrl(kind);
  if (!routeMapUrl) {
    return EMPTY_ROUTE_MAP;
  }

  const loadPromise = fetch(routeMapUrl, {
    cache: import.meta.env.DEV ? 'no-store' : 'default',
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => {
      const normalized = normalizeRouteMap(payload);
      routeMapCache.set(kind, normalized);
      return normalized;
    })
    .catch(() => {
      routeMapCache.set(kind, EMPTY_ROUTE_MAP);
      return EMPTY_ROUTE_MAP;
    })
    .finally(() => {
      routeMapPromises.delete(kind);
    });

  routeMapPromises.set(kind, loadPromise);
  return loadPromise;
};

export default function useSeoRouteMap(kind) {
  const [routeMap, setRouteMap] = useState(() => routeMapCache.get(kind) || EMPTY_ROUTE_MAP);

  useEffect(() => {
    let active = true;
    loadSeoRouteMap(kind).then((nextRouteMap) => {
      if (active) {
        setRouteMap(nextRouteMap);
      }
    });
    return () => {
      active = false;
    };
  }, [kind]);

  return routeMap;
}
