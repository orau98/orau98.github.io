import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { loadInsectImageIndexes, loadPlantImageFilenames } from '../services/imageIndex';
import { createSafeInsectFilename } from '../utils/image';
import { buildInsectPath } from '../utils/insectSlug';
import { makeDetailLinkState } from '../utils/navState';

// ネットワーク図: 画像がある種はサムネで表示。画像が無い場合は従来の円にフォールバック。
// 依存の fetch 失敗や画像読み込み失敗があっても必ず描画が続くように防御的に実装。

const DEFAULT_RELATED_LIMIT = 24;
const RELATED_LIMIT_OPTIONS = [12, 24, 40, 60];
const MAX_PANEL_ITEMS = 12;

const normalizePlantName = (name = '') =>
  name
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/の(花|実|葉|枝|茎|根|蕾).*/, '')
    .trim();

const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  const lifeStage = (record.lifeStage || '').trim();
  const plantPart = (record.plantPart || '').trim();
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
};

const FoodWebGraph = React.memo(function FoodWebGraph({
  currentInsect,
  currentPlantName,
  plantInsects,
  allInsects,
  hostPlantsMap,
  flowerVisitPlants,
  theme,
  width = 720,
  height = 520
}) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme === 'dark';

  const matchesPlantName = useCallback((plantName, targetName) => {
    if (!plantName || !targetName) return false;
    if (plantName === targetName) return true;
    return normalizePlantName(plantName) === normalizePlantName(targetName);
  }, []);

  const hasLarvalHostForPlant = useCallback((insect, plantName) => {
    if (!insect || !plantName) return false;
    if (Array.isArray(insect.hostPlantsDetailed) && insect.hostPlantsDetailed.length > 0) {
      return insect.hostPlantsDetailed.some((record) => {
        if (isFlowerVisitRecord(record)) return false;
        const raw = record?.name || record?.plant || record?.displayName || '';
        return matchesPlantName(String(raw).trim(), plantName);
      });
    }
    if (Array.isArray(insect.hostPlants) && insect.hostPlants.length > 0) {
      return insect.hostPlants.some((raw) => matchesPlantName(String(raw || '').trim(), plantName));
    }
    if (typeof insect.hostPlants === 'string' && insect.hostPlants.trim()) {
      return insect.hostPlants.split(/[;；、，,]/).some((raw) => matchesPlantName(raw.trim(), plantName));
    }
    return false;
  }, [matchesPlantName]);

  const flowerVisitByInsect = useMemo(() => {
    const map = new Map();
    if (!flowerVisitPlants || typeof flowerVisitPlants !== 'object') return map;
    Object.entries(flowerVisitPlants).forEach(([plantName, insects]) => {
      if (!plantName || !Array.isArray(insects)) return;
      const normalizedPlant = normalizePlantName(plantName) || String(plantName).trim();
      if (!normalizedPlant || normalizedPlant === '不明') return;
      insects.forEach((insectName) => {
        const key = String(insectName || '').trim();
        if (!key) return;
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(normalizedPlant);
      });
    });
    return map;
  }, [flowerVisitPlants]);

  const flowerVisitMap = useMemo(() => {
    const map = new Map();
    const addVisit = (plantName, insectName) => {
      if (!plantName || !insectName) return;
      const normalized = normalizePlantName(plantName);
      const keys = new Set([plantName, normalized].filter(Boolean));
      keys.forEach((key) => {
        if (!map.has(key)) map.set(key, new Set());
        map.get(key).add(insectName);
      });
    };
    if (flowerVisitPlants && typeof flowerVisitPlants === 'object') {
      Object.entries(flowerVisitPlants).forEach(([plantName, insects]) => {
        if (!plantName || !Array.isArray(insects)) return;
        insects.forEach((insectName) => addVisit(plantName, insectName));
      });
    }
    if (!Array.isArray(allInsects)) return map;
    allInsects.forEach((insect) => {
      const insectName = String(insect?.name || insect?.japaneseName || '').trim();
      if (!insectName) return;
      const records = insect?.hostPlantsDetailed;
      if (!Array.isArray(records) || records.length === 0) return;
      records.forEach((record) => {
        if (!isFlowerVisitRecord(record)) return;
        const rawPlant = record?.name || record?.plant || record?.displayName || '';
        const plantName = String(rawPlant).trim();
        addVisit(plantName, insectName);
      });
    });
    return map;
  }, [allInsects, flowerVisitPlants]);

  const hasFlowerVisitForPlant = useCallback((insect, plantName) => {
    if (!insect || !plantName) return false;
    const insectName = String(insect?.name || insect?.japaneseName || '').trim();
    if (!insectName) return false;
    const normalized = normalizePlantName(plantName);
    const fromMap = (key) => {
      if (!key) return false;
      const set = flowerVisitMap.get(key);
      return set ? set.has(insectName) : false;
    };
    if (fromMap(plantName) || (normalized && fromMap(normalized))) return true;
    if (Array.isArray(insect.hostPlantsDetailed) && insect.hostPlantsDetailed.length > 0) {
      return insect.hostPlantsDetailed.some((record) => {
        if (!isFlowerVisitRecord(record)) return false;
        const raw = record?.name || record?.plant || record?.displayName || '';
        return matchesPlantName(String(raw).trim(), plantName);
      });
    }
    return false;
  }, [flowerVisitMap, matchesPlantName]);

  const insectLookup = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(allInsects)) return map;
    allInsects.forEach((insect) => {
      const names = [insect?.name, insect?.japaneseName]
        .filter(Boolean)
        .map((n) => String(n).trim())
        .filter(Boolean);
      names.forEach((name) => {
        if (!map.has(name)) map.set(name, insect);
      });
    });
    return map;
  }, [allInsects]);

  const plantInsectMeta = useMemo(() => {
    if (!currentPlantName) return { orderedNames: [], metaByName: new Map() };
    const metaByName = new Map();
    const orderedNames = [];
    const seen = new Set();

    const pushName = (name) => {
      const key = String(name || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      orderedNames.push(key);
    };

    const addMeta = (name, detail, host, flower) => {
      const key = String(name || '').trim();
      if (!key) return;
      const existing = metaByName.get(key) || {
        name: key,
        detail: detail || insectLookup.get(key) || null,
        hasHost: false,
        hasFlowerVisit: false
      };
      existing.hasHost = existing.hasHost || !!host;
      existing.hasFlowerVisit = existing.hasFlowerVisit || !!flower;
      if (!existing.detail && detail) existing.detail = detail;
      metaByName.set(key, existing);
    };

    const hostSet = new Set();
    const flowerSet = new Set();
    const addListToSet = (list, target) => {
      if (!Array.isArray(list)) return;
      list.forEach((name) => {
        const key = String(name || '').trim();
        if (key) target.add(key);
      });
    };

    const normalized = normalizePlantName(currentPlantName);
    addListToSet(hostPlantsMap?.[currentPlantName], hostSet);
    if (normalized && normalized !== currentPlantName) {
      addListToSet(hostPlantsMap?.[normalized], hostSet);
    }
    const addFlowerFromMap = (key) => {
      if (!key) return;
      const set = flowerVisitMap.get(key);
      if (set) {
        set.forEach((name) => {
          const value = String(name || '').trim();
          if (value) flowerSet.add(value);
        });
      }
    };
    addFlowerFromMap(currentPlantName);
    if (normalized && normalized !== currentPlantName) {
      addFlowerFromMap(normalized);
    }

    if (Array.isArray(plantInsects) && plantInsects.length > 0) {
      plantInsects.forEach((insect) => {
        const name = String(insect?.name || insect?.japaneseName || '').trim();
        if (!name) return;
        const hostFlag = typeof insect.hasHost === 'boolean' ? insect.hasHost : hostSet.has(name);
        const flowerFlag = typeof insect.hasFlowerVisit === 'boolean' ? insect.hasFlowerVisit : flowerSet.has(name);
        addMeta(name, insect, hostFlag, flowerFlag);
        if (hostFlag) hostSet.add(name);
        if (flowerFlag) flowerSet.add(name);
        pushName(name);
      });
    }

    hostSet.forEach((name) => {
      addMeta(name, null, true, false);
      pushName(name);
    });
    flowerSet.forEach((name) => {
      addMeta(name, null, false, true);
      pushName(name);
    });

    if (orderedNames.length === 0 && Array.isArray(allInsects)) {
      allInsects.forEach((insect) => {
        const name = String(insect?.name || insect?.japaneseName || '').trim();
        if (!name) return;
        const hostFlag = hasLarvalHostForPlant(insect, currentPlantName);
        const flowerFlag = hasFlowerVisitForPlant(insect, currentPlantName);
        if (!hostFlag && !flowerFlag) return;
        addMeta(name, insect, hostFlag, flowerFlag);
        pushName(name);
      });
    }

    metaByName.forEach((meta, name) => {
      if (!meta.detail) meta.detail = insectLookup.get(name) || null;
      if (!meta.hasHost && meta.detail) {
        meta.hasHost = hasLarvalHostForPlant(meta.detail, currentPlantName);
      }
      if (!meta.hasFlowerVisit && meta.detail) {
        meta.hasFlowerVisit = hasFlowerVisitForPlant(meta.detail, currentPlantName);
      }
    });

    return { orderedNames, metaByName };
  }, [allInsects, currentPlantName, flowerVisitMap, hasFlowerVisitForPlant, hasLarvalHostForPlant, hostPlantsMap, insectLookup, plantInsects]);

  const getInsectPlantItems = useCallback((insect) => {
    const hostMap = new Map();
    const flowerMap = new Map();
    const order = [];
    const seen = new Set();
    if (!insect) {
      return {
        hostItems: [],
        flowerItems: [],
        plantOrder: order,
        hostSet: new Set(),
        flowerSet: new Set()
      };
    }

    const addItem = (map, name, part) => {
      if (!map.has(name)) map.set(name, new Set());
      if (part) map.get(name).add(part);
    };

    const addPlant = (rawName, kind, part = '') => {
      const raw = String(rawName || '').trim();
      if (!raw || raw === '不明') return;
      const normalized = normalizePlantName(raw) || raw;
      if (!normalized || normalized === '不明') return;
      if (kind === 'flower') {
        addItem(flowerMap, normalized, part);
      } else {
        addItem(hostMap, normalized, part);
      }
      if (!seen.has(normalized)) {
        seen.add(normalized);
        order.push(normalized);
      }
    };

    if (Array.isArray(insect.hostPlantsDetailed) && insect.hostPlantsDetailed.length > 0) {
      for (const p of insect.hostPlantsDetailed) {
        const raw = p?.name || p?.plant || p?.displayName || p?.hostPlant || p?.hostPlantName || '';
        const part = String(p?.part || p?.organ || p?.site || p?.parasiticPart || p?.plantPart || '').trim();
        if (isFlowerVisitRecord(p)) {
          addPlant(raw, 'flower', part);
        } else {
          addPlant(raw, 'host', part);
        }
      }
    } else if (Array.isArray(insect.hostPlants) && insect.hostPlants.length > 0) {
      insect.hostPlants.forEach((raw) => addPlant(raw, 'host'));
    } else if (typeof insect.hostPlants === 'string' && insect.hostPlants.trim()) {
      insect.hostPlants
        .split(/[;；、，,]/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach((raw) => addPlant(raw, 'host'));
    }

    const insectNames = new Set([insect.name, insect.japaneseName]
      .filter(Boolean)
      .map((n) => String(n).trim())
      .filter(Boolean));
    insectNames.forEach((name) => {
      const plants = flowerVisitByInsect.get(name);
      if (!plants) return;
      plants.forEach((plantName) => addPlant(plantName, 'flower'));
    });

    const toList = (map) => {
      const items = [];
      map.forEach((parts, name) => {
        if (!parts || parts.size === 0) {
          items.push({ name, part: '' });
          return;
        }
        parts.forEach((part) => items.push({ name, part: part || '' }));
      });
      return items;
    };

    return {
      hostItems: toList(hostMap),
      flowerItems: toList(flowerMap),
      plantOrder: order,
      hostSet: new Set(hostMap.keys()),
      flowerSet: new Set(flowerMap.keys())
    };
  }, [flowerVisitByInsect]);

  const getPlantInsects = useCallback((plantName) => {
    if (!plantName) return [];
    const names = new Set();
    const addList = (list) => {
      if (Array.isArray(list)) {
        list.forEach((name) => name && names.add(name));
      } else if (typeof list === 'string' && list.trim()) {
        list
          .split(/[;；、，,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach((name) => names.add(name));
      }
    };
    const normalized = normalizePlantName(plantName);
    addList(hostPlantsMap?.[plantName]);
    if (normalized && normalized !== plantName) {
      addList(hostPlantsMap?.[normalized]);
    }
    const addFromFlowerMap = (key) => {
      if (!key) return;
      const set = flowerVisitMap.get(key);
      if (set) {
        set.forEach((name) => name && names.add(name));
      }
    };
    addFromFlowerMap(plantName);
    if (normalized && normalized !== plantName) {
      addFromFlowerMap(normalized);
    }
    return Array.from(names);
  }, [hostPlantsMap, flowerVisitMap]);

  // image index caches
  const [imageExtMap, setImageExtMap] = useState({});
  const [imageBaseSet, setImageBaseSet] = useState(new Set());
  const [plantImageNames, setPlantImageNames] = useState([]);

  const loadingImagesRef = useRef(new Set());
  const failedImagesRef = useRef(new Set());
  const imageCacheRef = useRef({});

  const ignoreNextNodeClickRef = useRef(false);
  const activeTouchPointersRef = useRef(new Set());
  const longPressTimerRef = useRef(null);
  const longPressStartRef = useRef(null);
  const isPinDraggingRef = useRef(false);
  const pinDragPointerIdRef = useRef(null);
  const pinDragNodeIdRef = useRef(null);
  const hasUserInteractedRef = useRef(false);
  const lastClickRef = useRef({ id: null, ts: 0 });
  const [hoverNodeId, setHoverNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [labelMode, setLabelMode] = useState('auto'); // auto | none
  const [relatedLimit, setRelatedLimit] = useState(DEFAULT_RELATED_LIMIT);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [isCompactPanel, setIsCompactPanel] = useState(false);
  const showRelatedInsects = true;
  const linkDistance = 48;

  const [ylistData, setYlistData] = useState(null);

  const assetBase = useMemo(() => import.meta.env.BASE_URL || '/', []);
  const cacheBust = useMemo(() => {
    if (import.meta.env.DEV) return `?v=${Date.now()}`;
    return import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : '';
  }, []);

  useEffect(() => {
    hasUserInteractedRef.current = false;
  }, [currentInsect?.name, currentPlantName]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsCompactPanel(mq.matches);
    update();
    if (mq.addEventListener) {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    if (!selectedNodeId) return;
    setPanelCollapsed(isCompactPanel);
  }, [selectedNodeId, isCompactPanel]);

  // load image indexes once
  useEffect(() => {
    let canceled = false;
    loadInsectImageIndexes().then(({ names, exts }) => {
      if (canceled) return;
      setImageBaseSet(new Set(Array.from(names || [])));
      setImageExtMap(exts || {});
    }).catch(() => {
      if (!canceled) {
        setImageBaseSet(new Set());
        setImageExtMap({});
      }
    });

    loadPlantImageFilenames().then(list => {
      if (!canceled) setPlantImageNames(Array.isArray(list) ? list : []);
    }).catch(() => {
      if (!canceled) setPlantImageNames([]);
    });

    return () => {
      canceled = true;
    };
  }, []);

  const insectImageCandidates = useCallback((detail) => {
    if (!detail) return [];
    if (detail.image) return [detail.image];

    const candidates = [
      detail.scientificFilename,
      detail.scientificName ? createSafeInsectFilename(detail.scientificName) : null,
      detail.name ? createSafeInsectFilename(detail.name) : null,
      detail.name
    ].filter(Boolean);

    const urls = [];
    for (const base of candidates) {
      const ext = imageExtMap[base];
      if (ext) {
        // Prefer resized thumbnails first (used for node avatars)
        urls.push(`${assetBase}images/resized/insects/${encodeURIComponent(base)}.320.jpg${cacheBust}`);
        urls.push(`${assetBase}images/resized/insects/${encodeURIComponent(base)}.640.jpg${cacheBust}`);
        urls.push(`${assetBase}images/insects/${encodeURIComponent(base)}${ext}${cacheBust}`);
      } else if (imageBaseSet.has(base)) {
        urls.push(`${assetBase}images/resized/insects/${encodeURIComponent(base)}.320.jpg${cacheBust}`);
        urls.push(`${assetBase}images/resized/insects/${encodeURIComponent(base)}.640.jpg${cacheBust}`);
        urls.push(`${assetBase}images/insects/${encodeURIComponent(base)}.jpg${cacheBust}`);
      }
    }
    return urls;
  }, [assetBase, cacheBust, imageBaseSet, imageExtMap]);

  const plantImageCandidates = useCallback((plantName) => {
    if (!plantName || plantImageNames.length === 0) return [];
    const norm = normalizePlantName(plantName);
    const variants = [plantName, norm, plantName.replace(/＿/g, '_'), norm.replace(/＿/g, '_')];

    const hits = plantImageNames.filter(n => variants.some(v => v && n.startsWith(v)));
    if (hits.length === 0) return [];
    const urls = [];
    hits.slice(0, 2).forEach(base => {
      // Use resized thumbnails only to avoid extension guessing and heavy originals
      urls.push(`${assetBase}images/resized/plants/${encodeURIComponent(base)}.320.jpg${cacheBust}`);
      urls.push(`${assetBase}images/resized/plants/${encodeURIComponent(base)}.640.jpg${cacheBust}`);
    });
    return urls;
  }, [assetBase, cacheBust, plantImageNames]);

  // graph data with image candidates embedded
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    if (!hostPlantsMap || (!currentInsect && !currentPlantName)) return { nodes, links };

    const addNode = (id, name, type, raw) => {
      if (!nodes.find(n => n.id === id)) {
        const imgCandidates = type.includes('plant')
          ? plantImageCandidates(name)
          : insectImageCandidates(raw || { name });
        nodes.push({ id, name, type, raw, imgCandidates });
      }
    };

    const relatedLimitSafe = Math.max(6, relatedLimit || DEFAULT_RELATED_LIMIT);

    if (currentPlantName) {
      const centerId = `plant:${currentPlantName}`;
      addNode(centerId, currentPlantName, 'plant-current');
      const related = (plantInsectMeta.orderedNames || []).slice(0, relatedLimitSafe);
      related.forEach((name) => {
        const meta = plantInsectMeta.metaByName.get(name) || {};
        const insectDetail = meta.detail || insectLookup.get(name) || null;
        const insectId = `insect:${name}`;
        const hasHost = !!meta.hasHost;
        const hasFlower = !!meta.hasFlowerVisit;
        const insectType = hasHost && hasFlower
          ? 'insect-both'
          : hasFlower
            ? 'insect-flower'
            : hasHost
              ? 'insect-host'
              : 'insect';
        addNode(insectId, name, insectType, insectDetail);
        links.push({ source: centerId, target: insectId, relation: insectType });
      });
    } else if (currentInsect) {
      const centerId = `insect:${currentInsect.name}`;
      addNode(centerId, currentInsect.name, 'insect-current', currentInsect);

      const { plantOrder, hostSet, flowerSet } = getInsectPlantItems(currentInsect);
      const limitedPlants = (plantOrder || []).slice(0, relatedLimitSafe);
      const relatedPerPlant = Math.max(4, Math.floor(relatedLimitSafe / Math.max(1, limitedPlants.length)));

      limitedPlants.forEach(plantName => {
        const isHost = hostSet.has(plantName);
        const isFlower = flowerSet.has(plantName);
        const plantType = isHost && isFlower
          ? 'plant-both'
          : isFlower
            ? 'plant-flower'
            : 'plant-host';
        const plantId = `plant:${plantName}`;
        addNode(plantId, plantName, plantType);
        links.push({ source: centerId, target: plantId });

        if (showRelatedInsects) {
          const related = getPlantInsects(plantName)
            .filter(n => n !== currentInsect.name)
            .filter((name) => {
              const insectDetail = allInsects?.find(i => i.name === name);
              if (!insectDetail) return true;
              return hasLarvalHostForPlant(insectDetail, plantName)
                || hasFlowerVisitForPlant(insectDetail, plantName);
            });
          related.slice(0, relatedPerPlant).forEach(name => {
            const insectDetail = allInsects?.find(i => i.name === name);
            const insectId = `insect:${name}`;
            addNode(insectId, name, 'insect', insectDetail);
            links.push({ source: plantId, target: insectId });
          });
        }
      });
    }

    return { nodes, links };
  }, [currentInsect, currentPlantName, hostPlantsMap, allInsects, insectImageCandidates, insectLookup, plantImageCandidates, plantInsectMeta, relatedLimit, getPlantInsects, hasFlowerVisitForPlant, hasLarvalHostForPlant, getInsectPlantItems]);

  // selection safety: clear when graph changes
  useEffect(() => {
    if (!selectedNodeId) return;
    if (graphData.nodes.some(n => n.id === selectedNodeId)) return;
    setSelectedNodeId(null);
  }, [graphData.nodes, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [graphData.nodes, selectedNodeId]);

  // lazy-load plant scientific names (YList lite) only when needed
  useEffect(() => {
    if (!selectedNode) return;
    if (!selectedNode.type?.startsWith('plant')) return;
    if (ylistData) return;

    let canceled = false;
    fetch(`${assetBase}assets/data-lite/ylist-lite.json${cacheBust}`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to load ylist-lite.json'))))
      .then((data) => {
        if (!canceled) setYlistData(data);
      })
      .catch(() => {
        // optional enhancement only; ignore errors
      });

    return () => { canceled = true; };
  }, [assetBase, cacheBust, selectedNode, ylistData]);

  const getYlistPlantInfo = useCallback((plantName) => {
    if (!ylistData || !plantName) return null;
    const plants = ylistData?.plants;
    const aliasToCanonical = ylistData?.aliasToCanonical;
    if (!plants || !aliasToCanonical) return null;

    const candidates = [
      plantName,
      normalizePlantName(plantName),
      plantName.replace(/＿/g, '_'),
      normalizePlantName(plantName).replace(/＿/g, '_')
    ].filter(Boolean);

    for (const key of candidates) {
      const canonical = aliasToCanonical[key] || key;
      const info = plants[canonical];
      if (info) return { canonical, info };
    }
    return null;
  }, [ylistData]);

  const activeHoverNodeId = selectedNodeId ? null : hoverNodeId;
  const activeNodeId = selectedNodeId || activeHoverNodeId;
  const { highlightNodeIds, highlightLinks } = useMemo(() => {
    const nodeIds = new Set();
    const linkSet = new Set();
    if (!activeNodeId) return { highlightNodeIds: nodeIds, highlightLinks: linkSet };

    nodeIds.add(activeNodeId);
    for (const link of graphData.links) {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      if (!sId || !tId) continue;
      if (sId === activeNodeId || tId === activeNodeId) {
        linkSet.add(link);
        nodeIds.add(sId);
        nodeIds.add(tId);
      }
    }
    return { highlightNodeIds: nodeIds, highlightLinks: linkSet };
  }, [activeNodeId, graphData.links]);

  const selectedStats = useMemo(() => {
    if (!selectedNode) return null;
    const degree = graphData.links.reduce((acc, link) => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sId === selectedNode.id || tId === selectedNode.id) return acc + 1;
      return acc;
    }, 0);
    return { degree };
  }, [graphData.links, selectedNode]);

  const selectedInsectPlantData = useMemo(() => {
    if (!selectedNode?.type?.startsWith('insect')) {
      return { hostItems: [], flowerItems: [] };
    }
    const detail = selectedNode.raw;
    if (!detail) return { hostItems: [], flowerItems: [] };
    return getInsectPlantItems(detail);
  }, [selectedNode, getInsectPlantItems]);

  const selectedInsectHostPlants = selectedInsectPlantData.hostItems || [];
  const selectedInsectFlowerPlants = selectedInsectPlantData.flowerItems || [];

  const selectedPlantInsects = useMemo(() => {
    if (!selectedNode?.type?.startsWith('plant')) return [];
    return getPlantInsects(selectedNode.name)
      .filter(Boolean)
      .filter((name) => {
        const insectDetail = allInsects?.find(i => i.name === name);
        if (!insectDetail) return true;
        return hasLarvalHostForPlant(insectDetail, selectedNode.name)
          || hasFlowerVisitForPlant(insectDetail, selectedNode.name);
      });
  }, [getPlantInsects, selectedNode, allInsects, hasLarvalHostForPlant, hasFlowerVisitForPlant]);

  const selectedPlantBadge = useMemo(() => {
    if (!selectedNode?.type?.startsWith('plant')) return null;
    if (selectedNode.type === 'plant-current') {
      return {
        label: '植物',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60'
      };
    }
    if (selectedNode.type === 'plant-flower') {
      return {
        label: '訪花植物',
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60'
      };
    }
    if (selectedNode.type === 'plant-both') {
      return {
        label: '食草＋訪花',
        className: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:border-lime-900/60'
      };
    }
    return {
      label: '食草',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60'
    };
  }, [selectedNode]);

  const selectedInsectBadge = useMemo(() => {
    if (!selectedNode?.type?.startsWith('insect')) return null;
    if (selectedNode.type === 'insect-current') {
      return {
        label: '現在の昆虫',
        className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60'
      };
    }
    if (selectedNode.type === 'insect-flower') {
      return {
        label: '訪花昆虫',
        className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60'
      };
    }
    if (selectedNode.type === 'insect-both') {
      return {
        label: '食草＋訪花',
        className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900/60'
      };
    }
    if (selectedNode.type === 'insect-host') {
      return {
        label: '食草昆虫',
        className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60'
      };
    }
    return {
      label: '昆虫',
      className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60'
    };
  }, [selectedNode]);

  const legendTypeSet = useMemo(() => new Set(graphData.nodes.map((n) => n.type)), [graphData.nodes]);
  const showHostPlantLegend = legendTypeSet.has('plant-host');
  const showFlowerPlantLegend = legendTypeSet.has('plant-flower');
  const showBothPlantLegend = legendTypeSet.has('plant-both');
  const showInsectLegend = legendTypeSet.has('insect');
  const showInsectHostLegend = legendTypeSet.has('insect-host');
  const showInsectFlowerLegend = legendTypeSet.has('insect-flower');
  const showInsectBothLegend = legendTypeSet.has('insect-both');

  const focusNodeById = useCallback((nodeId) => {
    if (!nodeId) return;
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    hasUserInteractedRef.current = true;
    setSelectedNodeId(nodeId);
    setHoverNodeId(null);
    try {
      if (fgRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
        fgRef.current.centerAt(node.x, node.y, 280);
      }
    } catch { /* ignore */ }
  }, [graphData.nodes]);

  const focusNodeByName = useCallback((name, typeHint) => {
    if (!name) return;
    const id = typeHint === 'plant' ? `plant:${name}` : `insect:${name}`;
    focusNodeById(id);
  }, [focusNodeById]);

  // initial fit
  useEffect(() => {
    if (!fgRef.current) return;
    if (hasUserInteractedRef.current) return;
    const t = setTimeout(() => {
      try { fgRef.current.zoomToFit(400, 60); } catch { /* ignore */ }
    }, 250);
    return () => clearTimeout(t);
  }, [graphData]);

  // hover highlight (preview only; selection takes precedence)
  const handleNodeHover = useCallback((node) => {
    if (selectedNodeId) return;
    setHoverNodeId(node ? node.id : null);
  }, [selectedNodeId]);

  const markUserInteracted = useCallback(() => {
    hasUserInteractedRef.current = true;
  }, []);

  // click toggles selection (navigation moved to the detail panel)
  const handleNodeClick = useCallback((node) => {
    if (!node) return;
    if (ignoreNextNodeClickRef.current) {
      ignoreNextNodeClickRef.current = false;
      return;
    }
    markUserInteracted();
    const now = Date.now();
    if (lastClickRef.current.id === node.id && now - lastClickRef.current.ts < 420) {
      // double click/tap: go to detail
      if (node.type.startsWith('insect')) {
        const path = node.raw?.path || buildInsectPath(node.raw || { name: node.name });
        navigate(path, { state: makeDetailLinkState(location) });
      } else {
        navigate(`/plant/${encodeURIComponent(node.name)}`, { state: makeDetailLinkState(location) });
      }
      lastClickRef.current = { id: null, ts: 0 };
      return;
    }
    lastClickRef.current = { id: node.id, ts: now };
    setSelectedNodeId(prev => (prev === node.id ? null : node.id));
    setHoverNodeId(null);
  }, [location, markUserInteracted, navigate]);

  const handleBackgroundClick = useCallback(() => {
    markUserInteracted();
    setSelectedNodeId(null);
    setHoverNodeId(null);
  }, [markUserInteracted]);

  // draw helper: rounded rect
  const drawRoundedRect = (c, x, y, w, h, r) => {
    const radius = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + radius, y);
    c.lineTo(x + w - radius, y);
    c.arcTo(x + w, y, x + w, y + radius, radius);
    c.lineTo(x + w, y + h - radius);
    c.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    c.lineTo(x + radius, y + h);
    c.arcTo(x, y + h, x, y + h - radius, radius);
    c.lineTo(x, y + radius);
    c.arcTo(x, y, x + radius, y, radius);
    c.closePath();
  };

  // request image load if needed
  const ensureImage = (candidates) => {
    if (typeof Image === 'undefined') return null;
    if (!candidates || candidates.length === 0) return null;
    // If any cached candidate exists, use it
    for (const url of candidates) {
      if (imageCacheRef.current[url]) return url;
    }

    // Otherwise, try the first not-failed candidate (load one at a time to avoid bandwidth spikes)
    const nextUrl = candidates.find((u) => u && !failedImagesRef.current.has(u));
    if (!nextUrl) return null;
    if (!loadingImagesRef.current.has(nextUrl)) {
      loadingImagesRef.current.add(nextUrl);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadingImagesRef.current.delete(nextUrl);
        imageCacheRef.current[nextUrl] = img;
        try { fgRef.current && fgRef.current.refresh(); } catch { /* ignore */ }
      };
      img.onerror = () => {
        loadingImagesRef.current.delete(nextUrl);
        failedImagesRef.current.add(nextUrl);
      };
      img.src = nextUrl;
    }
    return null;
  };

  // node renderer with image fallback
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const drawLabel = (x, y, label, dim) => {
      const fontSize = 12 / globalScale;
      ctx.font = `${fontSize}px "Helvetica Neue", "Segoe UI", sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padding = 4 / globalScale;
      const labelWidth = textWidth + padding * 2;
      const labelHeight = fontSize + padding * 2;
      const top = y - labelHeight - 4;
      ctx.fillStyle = isDark
        ? `rgba(15,23,42,${dim ? 0.35 : 0.82})`
        : `rgba(248,250,252,${dim ? 0.4 : 0.9})`;
      ctx.strokeStyle = isDark
        ? `rgba(148,163,184,${dim ? 0.18 : 0.35})`
        : `rgba(148,163,184,${dim ? 0.3 : 0.7})`;
      ctx.lineWidth = 1 / globalScale;
      drawRoundedRect(ctx, x - labelWidth / 2, top, labelWidth, labelHeight, 4 / globalScale);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isDark ? '#e2e8f0' : '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, top + labelHeight / 2);
    };

    const colors = {
      'insect-current': '#fb7185',
      'insect-host': '#38bdf8',
      'insect-flower': '#fb7185',
      'insect-both': '#a78bfa',
      insect: '#38bdf8',
      'plant-current': '#22c55e',
      'plant-host': '#10b981',
      'plant-flower': '#f59e0b',
      'plant-both': '#84cc16',
      plant: '#10b981'
    };
    const isCurrent = node.type.includes('current');
    const baseR = isCurrent ? 13 : 8;
    const radius = baseR / Math.sqrt(globalScale);
    const inHighlight = highlightNodeIds.size > 0 && highlightNodeIds.has(node.id);
    const dimByHighlight = highlightNodeIds.size > 0 && !inHighlight;
    const dim = dimByHighlight;
    const alpha = dim ? 0.25 : 1;
    const dense = labelMode === 'auto' && graphData.nodes.length > 28;
    const showLabel = labelMode !== 'none' && (
      labelMode === 'all'
      || isCurrent
      || selectedNodeId === node.id
      || (activeNodeId && inHighlight)
      || (!dense && !dim)
      || (globalScale > 1.8 && !dim)
    );

    // try to ensure image is loaded
    const foundUrl = ensureImage(node.imgCandidates);
    const img = foundUrl ? imageCacheRef.current[foundUrl] : null;

    // glow
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = colors[node.type] || '#94a3b8';
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, node.x - radius, node.y - radius, radius * 2, radius * 2);
      ctx.restore();
      ctx.lineWidth = 1.2 / Math.sqrt(globalScale);
      ctx.strokeStyle = isDark ? 'rgba(226,232,240,0.35)' : 'rgba(15,23,42,0.35)';
      if (selectedNodeId === node.id) ctx.strokeStyle = isDark ? 'rgba(251,113,133,0.8)' : 'rgba(244,63,94,0.85)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors[node.type] || '#94a3b8';
      ctx.globalAlpha = alpha;
      ctx.fill();
      ctx.lineWidth = 1.2 / Math.sqrt(globalScale);
      ctx.strokeStyle = isDark ? 'rgba(226,232,240,0.22)' : 'rgba(15,23,42,0.2)';
      if (selectedNodeId === node.id) ctx.strokeStyle = isDark ? 'rgba(251,113,133,0.8)' : 'rgba(244,63,94,0.85)';
      ctx.stroke();
    }

    if (isCurrent) {
      ctx.save();
      ctx.lineWidth = 2.2 / Math.sqrt(globalScale);
      ctx.strokeStyle = isDark ? 'rgba(248,250,252,0.9)' : 'rgba(15,23,42,0.85)';
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius * 1.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (showLabel) drawLabel(node.x, node.y, node.name, dim);
  }, [activeNodeId, graphData.nodes.length, highlightNodeIds, isDark, labelMode, selectedNodeId]);

  // zoom controls
  const zoomIn = useCallback(() => {
    if (!fgRef.current) return;
    markUserInteracted();
    fgRef.current.zoom(fgRef.current.zoom() * 1.4, 350);
  }, [markUserInteracted]);
  const zoomOut = useCallback(() => {
    if (!fgRef.current) return;
    markUserInteracted();
    fgRef.current.zoom(fgRef.current.zoom() / 1.4, 350);
  }, [markUserInteracted]);
  const resetView = useCallback(() => {
    if (!fgRef.current) return;
    markUserInteracted();
    fgRef.current.zoomToFit(400, 60);
  }, [markUserInteracted]);
  // touch interactions: long-press to pin-drag
  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  useEffect(() => {
    return () => cancelLongPress();
  }, [cancelLongPress]);

  const getRelativePoint = useCallback((event) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const findNearestNode = useCallback((screenX, screenY) => {
    if (!fgRef.current) return null;
    if (!graphData.nodes || graphData.nodes.length === 0) return null;

    try {
      const graphPt = fgRef.current.screen2GraphCoords(screenX, screenY);
      const graphPt2 = fgRef.current.screen2GraphCoords(screenX + 26, screenY);
      const threshold = Math.max(8, Math.abs(graphPt2.x - graphPt.x));

      let best = null;
      let bestDist = Infinity;
      for (const node of graphData.nodes) {
        if (typeof node?.x !== 'number' || typeof node?.y !== 'number') continue;
        const dist = Math.hypot(node.x - graphPt.x, node.y - graphPt.y);
        if (dist < bestDist) {
          best = node;
          bestDist = dist;
        }
      }
      if (!best || bestDist > threshold) return null;
      return best;
    } catch {
      return null;
    }
  }, [graphData.nodes]);

  const beginPinDrag = useCallback((node, pointerId) => {
    if (!node) return;
    ignoreNextNodeClickRef.current = true;
    isPinDraggingRef.current = true;
    pinDragNodeIdRef.current = node.id;
    pinDragPointerIdRef.current = pointerId;
    setSelectedNodeId(node.id);
    setHoverNodeId(null);
    node.fx = typeof node.x === 'number' ? node.x : 0;
    node.fy = typeof node.y === 'number' ? node.y : 0;
    try { fgRef.current && fgRef.current.d3ReheatSimulation(); } catch { /* ignore */ }
  }, []);

  const handlePointerDownCapture = useCallback((event) => {
    if (event.pointerType !== 'touch') return;
    if (event.target instanceof Element && event.target.closest('[data-fg-ui]')) return;
    markUserInteracted();

    activeTouchPointersRef.current.add(event.pointerId);
    if (activeTouchPointersRef.current.size > 1) {
      cancelLongPress();
      return;
    }

    const pt = getRelativePoint(event);
    if (!pt) return;

    longPressStartRef.current = { pointerId: event.pointerId, x: pt.x, y: pt.y };
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    const pointerId = event.pointerId;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      if (activeTouchPointersRef.current.size !== 1) return;
      const origin = longPressStartRef.current;
      if (!origin || origin.pointerId !== pointerId) return;

      const node = findNearestNode(origin.x, origin.y);
      if (!node) return;
      longPressStartRef.current = null;
      beginPinDrag(node, pointerId);
    }, 450);
  }, [beginPinDrag, cancelLongPress, findNearestNode, getRelativePoint, markUserInteracted]);

  const handlePointerMoveCapture = useCallback((event) => {
    if (event.pointerType !== 'touch') return;

    const pt = getRelativePoint(event);
    if (!pt) return;

    if (isPinDraggingRef.current && pinDragPointerIdRef.current === event.pointerId) {
      event.preventDefault();
      const nodeId = pinDragNodeIdRef.current;
      const node = nodeId ? graphData.nodes.find(n => n.id === nodeId) : null;
      if (!node || !fgRef.current) return;
      try {
        const coords = fgRef.current.screen2GraphCoords(pt.x, pt.y);
        node.fx = coords.x;
        node.fy = coords.y;
      } catch {
        // ignore
      }
      return;
    }

    const origin = longPressStartRef.current;
    if (!origin || origin.pointerId !== event.pointerId) return;
    const dx = pt.x - origin.x;
    const dy = pt.y - origin.y;
    if (Math.hypot(dx, dy) > 12) cancelLongPress();
  }, [cancelLongPress, getRelativePoint, graphData.nodes]);

  const handlePointerUpCapture = useCallback((event) => {
    if (event.pointerType !== 'touch') return;
    activeTouchPointersRef.current.delete(event.pointerId);

    if (pinDragPointerIdRef.current === event.pointerId) {
      isPinDraggingRef.current = false;
      pinDragPointerIdRef.current = null;
      pinDragNodeIdRef.current = null;
      cancelLongPress();
      window.setTimeout(() => { ignoreNextNodeClickRef.current = false; }, 260);
      return;
    }

    const origin = longPressStartRef.current;
    if (origin?.pointerId === event.pointerId) cancelLongPress();
  }, [cancelLongPress]);

  const allowPanZoom = useCallback(() => !isPinDraggingRef.current, []);

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-850 dark:to-slate-950 relative shadow-md"
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerUpCapture}
    >
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeLabel="name"
        nodeCanvasObject={nodeCanvasObject}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        enablePanInteraction={allowPanZoom}
        enableZoomInteraction={allowPanZoom}
        linkDistance={linkDistance}
        linkColor={link => {
          const highlighted = highlightLinks.has(link);
          const sId = typeof link.source === 'object' ? link.source.id : link.source;
          const tId = typeof link.target === 'object' ? link.target.id : link.target;
          if (!sId || !tId) return 'rgba(148,163,184,0.65)';
          const dim = activeNodeId && !highlighted;
          if (dim) return 'rgba(148,163,184,0.25)';
          return highlighted ? '#38bdf8' : 'rgba(148,163,184,0.65)';
        }}
        linkWidth={link => (highlightLinks.has(link) ? 2.2 : 1.1)}
        linkDirectionalParticles={link => (highlightLinks.has(link) ? 3 : 0)}
        linkDirectionalParticleWidth={1.6}
        linkCurvature={0.18}
        backgroundColor={isDark ? '#0b1220' : '#f8fafc'}
        cooldownTicks={80}
        d3VelocityDecay={0.35}
        onZoom={markUserInteracted}
        onEngineStop={() => {
          if (!fgRef.current) return;
          if (hasUserInteractedRef.current) return;
          fgRef.current.zoomToFit(400, 60);
        }}
      />

      {/* Toolbar */}
      <div data-fg-ui className="absolute top-3 left-3 right-3 z-20 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-xl shadow border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-700 dark:text-slate-200">
          <button
            type="button"
            onClick={resetView}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
            title="リセット（ズーム/中心）"
          >
            リセット
          </button>
          <button
            type="button"
            onClick={zoomOut}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
            title="縮小"
          >
            －
          </button>
          <button
            type="button"
            onClick={zoomIn}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
            title="拡大"
          >
            ＋
          </button>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">ラベル</span>
            <div className="inline-flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
              <button
                type="button"
                onClick={() => setLabelMode('auto')}
                aria-pressed={labelMode === 'auto'}
                className={`px-2.5 py-1.5 text-[12px] font-semibold ${labelMode === 'auto' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800'}`}
              >
                自動
              </button>
              <button
                type="button"
                onClick={() => setLabelMode('none')}
                aria-pressed={labelMode === 'none'}
                className={`px-2.5 py-1.5 text-[12px] font-semibold border-l border-slate-200 dark:border-slate-600 ${labelMode === 'none' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800'}`}
              >
                なし
              </button>
            </div>
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">関連数</span>
            <select
              value={relatedLimit}
              onChange={(e) => setRelatedLimit(parseInt(e.target.value, 10))}
              className="text-[12px] rounded-md border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 px-2 py-1"
            >
              {RELATED_LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div data-fg-ui className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow border border-slate-200 dark:border-slate-600 p-3 text-xs text-slate-700 dark:text-slate-200 space-y-2">
        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">凡例</div>
        <div className="space-y-1">
          {currentInsect && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400"></span>
              <span>現在の昆虫</span>
            </div>
          )}
          {currentPlantName && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
              <span>現在の植物</span>
            </div>
          )}
          {showHostPlantLegend && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
              <span>食草（幼虫）</span>
            </div>
          )}
          {showFlowerPlantLegend && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-400"></span>
              <span>訪花植物</span>
            </div>
          )}
          {showBothPlantLegend && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-lime-400"></span>
              <span>食草＋訪花</span>
            </div>
          )}
          {showInsectHostLegend && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400"></span>
              <span>食草昆虫</span>
            </div>
          )}
          {showInsectFlowerLegend && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400"></span>
              <span>訪花昆虫</span>
            </div>
          )}
          {showInsectBothLegend && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-violet-400"></span>
              <span>食草＋訪花昆虫</span>
            </div>
          )}
          {showInsectLegend && (
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-sky-400"></span>
              <span>関連する昆虫</span>
            </div>
          )}
        </div>
      </div>

      {/* Selection panel */}
      {selectedNode && (
        <div
          data-fg-ui
          className={`absolute bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] bg-white/95 dark:bg-slate-900/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-800 dark:text-slate-100 transition-all ${
            panelCollapsed ? 'max-h-20 overflow-hidden' : 'max-h-[70vh]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    selectedNode.type.startsWith('plant')
                      ? (selectedPlantBadge?.className || 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60')
                      : (selectedInsectBadge?.className || 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60')
                  }`}
                >
                  {selectedNode.type.startsWith('plant')
                    ? (selectedPlantBadge?.label || '植物')
                    : (selectedInsectBadge?.label || '昆虫')}
                </span>
                <h3 className="font-bold truncate">{selectedNode.name}</h3>
              </div>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                {selectedNode.type.startsWith('plant') ? (() => {
                  const yinfo = getYlistPlantInfo(selectedNode.name);
                  return yinfo?.info?.scientificName ? <span className="italic">{yinfo.info.scientificName}</span> : <span className="opacity-70">学名: 不明</span>;
                })() : (
                  selectedNode.raw?.scientificName
                    ? <span className="italic">{selectedNode.raw.scientificName}</span>
                    : <span className="opacity-70">学名: 不明</span>
                )}
              </div>
              {selectedStats && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-600 dark:text-slate-300">
                  <span>接続: {selectedStats.degree}</span>
                  {selectedNode.type.startsWith('plant') && <span>利用種: {selectedPlantInsects.length}</span>}
                  {selectedNode.type.startsWith('insect') && <span>食草: {selectedInsectHostPlants.length}</span>}
                  {selectedNode.type.startsWith('insect') && selectedInsectFlowerPlants.length > 0 && (
                    <span>訪花: {selectedInsectFlowerPlants.length}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {isCompactPanel && (
                <button
                  type="button"
                  className="shrink-0 px-2 py-1 rounded-md text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
                  onClick={() => setPanelCollapsed((prev) => !prev)}
                  aria-label={panelCollapsed ? '詳細を表示' : '縮小'}
                >
                  {panelCollapsed ? '詳細' : '縮小'}
                </button>
              )}
              <button
                type="button"
                className="shrink-0 p-2 -m-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={() => setSelectedNodeId(null)}
                aria-label="選択を解除"
                title="解除"
              >
                ✕
              </button>
            </div>
          </div>

          {!panelCollapsed && (
            <>
              <div className="mt-3 space-y-2">
                {selectedNode.type.startsWith('insect') ? (
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">食草（幼虫）</div>
                      {selectedInsectHostPlants.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">不明 / 未登録</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedInsectHostPlants.slice(0, MAX_PANEL_ITEMS).map((p, idx) => (
                            <button
                              type="button"
                              key={`host-${p.name}_${p.part}_${idx}`}
                              onClick={() => focusNodeByName(p.name, 'plant')}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                              title={`${p.name}へフォーカス`}
                            >
                              {p.name}{p.part ? `（${p.part}）` : ''}
                            </button>
                          ))}
                          {selectedInsectHostPlants.length > MAX_PANEL_ITEMS && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">ほか {selectedInsectHostPlants.length - MAX_PANEL_ITEMS}</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">訪花</div>
                      {selectedInsectFlowerPlants.length === 0 ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400">不明 / 未登録</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedInsectFlowerPlants.slice(0, MAX_PANEL_ITEMS).map((p, idx) => (
                            <button
                              type="button"
                              key={`flower-${p.name}_${p.part}_${idx}`}
                              onClick={() => focusNodeByName(p.name, 'plant')}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                              title={`${p.name}へフォーカス`}
                            >
                              {p.name}{p.part ? `（${p.part}）` : ''}
                            </button>
                          ))}
                          {selectedInsectFlowerPlants.length > MAX_PANEL_ITEMS && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">ほか {selectedInsectFlowerPlants.length - MAX_PANEL_ITEMS}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">この植物を利用する昆虫</div>
                    {selectedPlantInsects.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">不明 / 未登録</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPlantInsects.slice(0, MAX_PANEL_ITEMS).map((name, idx) => (
                          <button
                            type="button"
                            key={`${name}_${idx}`}
                            onClick={() => focusNodeByName(name, 'insect')}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] border bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title={`${name}へフォーカス`}
                          >
                            {name}
                          </button>
                        ))}
                        {selectedPlantInsects.length > MAX_PANEL_ITEMS && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">ほか {selectedPlantInsects.length - MAX_PANEL_ITEMS}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className={`px-3 py-2 rounded-lg text-[12px] font-semibold text-white shadow ${selectedNode.type.startsWith('plant') ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'}`}
                  onClick={() => {
                    if (!selectedNode) return;
                    if (selectedNode.type.startsWith('insect')) {
                      const path = selectedNode.raw?.path || buildInsectPath(selectedNode.raw || { name: selectedNode.name });
                      navigate(path, { state: makeDetailLinkState(location) });
                    } else {
                      navigate(`/plant/${encodeURIComponent(selectedNode.name)}`, { state: makeDetailLinkState(location) });
                    }
                  }}
                >
                  詳細へ
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
});

export default FoodWebGraph;
