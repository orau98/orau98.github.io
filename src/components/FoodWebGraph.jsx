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
  return lifeStage === '成虫' && plantPart === '花';
};

const FoodWebGraph = React.memo(function FoodWebGraph({
  currentInsect,
  currentPlantName,
  allInsects,
  hostPlantsMap,
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

  const flowerVisitMap = useMemo(() => {
    const map = new Map();
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
        if (!plantName) return;
        const normalized = normalizePlantName(plantName);
        const keys = new Set([plantName, normalized].filter(Boolean));
        keys.forEach((key) => {
          if (!map.has(key)) map.set(key, new Set());
          map.get(key).add(insectName);
        });
      });
    });
    return map;
  }, [allInsects]);

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
  const [legendFocus, setLegendFocus] = useState(null);
  const [legendDimMode, setLegendDimMode] = useState('fade'); // fade | hide
  const [labelMode, setLabelMode] = useState('auto'); // auto | all | none
  const [relatedLimit, setRelatedLimit] = useState(DEFAULT_RELATED_LIMIT);
  const [showRelatedInsects, setShowRelatedInsects] = useState(true);
  const [linkDistance, setLinkDistance] = useState(48);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [isCompactPanel, setIsCompactPanel] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

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
      const relatedAll = getPlantInsects(currentPlantName);
      const related = relatedAll.filter((name) => {
        const insectDetail = allInsects?.find(i => i.name === name);
        if (!insectDetail) return true;
        return hasLarvalHostForPlant(insectDetail, currentPlantName)
          || hasFlowerVisitForPlant(insectDetail, currentPlantName);
      });
      related.slice(0, relatedLimitSafe).forEach(name => {
        const insectDetail = allInsects?.find(i => i.name === name);
        const insectId = `insect:${name}`;
        addNode(insectId, name, 'insect', insectDetail);
        links.push({ source: centerId, target: insectId });
      });
    } else if (currentInsect) {
      const centerId = `insect:${currentInsect.name}`;
      addNode(centerId, currentInsect.name, 'insect-current', currentInsect);

      let plants = [];
      if (Array.isArray(currentInsect.hostPlantsDetailed) && currentInsect.hostPlantsDetailed.length > 0) {
        const plantSet = new Set();
        currentInsect.hostPlantsDetailed.forEach((record) => {
          const raw = record?.name || record?.plant || record?.displayName || '';
          const plantName = String(raw).trim();
          if (!plantName) return;
          if (plantName === '不明') return;
          plantSet.add(plantName);
        });
        plants = Array.from(plantSet);
      } else if (Array.isArray(currentInsect.hostPlants)) {
        plants = currentInsect.hostPlants.filter(p => p && p !== '不明');
      } else if (typeof currentInsect.hostPlants === 'string') {
        plants = currentInsect.hostPlants.split(/[、，,]/).map(s => s.trim()).filter(Boolean);
      }

      const limitedPlants = plants.slice(0, relatedLimitSafe);
      const relatedPerPlant = Math.max(4, Math.floor(relatedLimitSafe / Math.max(1, limitedPlants.length)));

      limitedPlants.forEach(plantName => {
        const plantId = `plant:${plantName}`;
        addNode(plantId, plantName, 'plant');
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
  }, [currentInsect, currentPlantName, hostPlantsMap, allInsects, insectImageCandidates, plantImageCandidates, relatedLimit, showRelatedInsects, getPlantInsects, hasFlowerVisitForPlant, hasLarvalHostForPlant]);

  // selection safety: clear when graph changes
  useEffect(() => {
    if (!selectedNodeId) return;
    if (graphData.nodes.some(n => n.id === selectedNodeId)) return;
    setSelectedNodeId(null);
  }, [graphData.nodes, selectedNodeId]);

  const nodeTypeById = useMemo(() => {
    const map = new Map();
    graphData.nodes.forEach((n) => map.set(n.id, n.type));
    return map;
  }, [graphData.nodes]);

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

  const selectedInsectHostPlants = useMemo(() => {
    if (!selectedNode?.type?.startsWith('insect')) return [];
    const detail = selectedNode.raw;
    if (!detail) return [];

    const items = [];
    if (Array.isArray(detail.hostPlantsDetailed) && detail.hostPlantsDetailed.length > 0) {
      for (const p of detail.hostPlantsDetailed) {
        if (isFlowerVisitRecord(p)) continue;
        const name = String(p?.name || p?.plant || p?.hostPlant || p?.hostPlantName || '').trim();
        if (!name || name === '不明') continue;
        const part = String(p?.part || p?.organ || p?.site || p?.parasiticPart || '').trim();
        items.push({ name, part });
      }
    } else if (Array.isArray(detail.hostPlants) && detail.hostPlants.length > 0) {
      for (const raw of detail.hostPlants) {
        const name = String(raw || '').trim();
        if (!name || name === '不明') continue;
        items.push({ name, part: '' });
      }
    } else if (typeof detail.hostPlants === 'string' && detail.hostPlants.trim()) {
      detail.hostPlants.split(/[;；、，,]/).map(s => s.trim()).filter(Boolean).forEach((name) => {
        if (name !== '不明') items.push({ name, part: '' });
      });
    }

    const seen = new Set();
    const deduped = [];
    for (const item of items) {
      const key = `${item.name}__${item.part || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
    }
    return deduped;
  }, [selectedNode]);

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
      insect: '#38bdf8',
      'plant-current': '#22c55e',
      plant: '#10b981'
    };
    const isCurrent = node.type.includes('current');
    const baseR = isCurrent ? 13 : 8;
    const radius = baseR / Math.sqrt(globalScale);
    const inHighlight = highlightNodeIds.size > 0 && highlightNodeIds.has(node.id);
    const dimByHighlight = highlightNodeIds.size > 0 && !inHighlight;
    const dimByLegend = legendFocus && !node.type.includes(legendFocus) && node.id !== selectedNodeId;
    const dim = dimByHighlight || dimByLegend;
    const dimAlpha = legendDimMode === 'hide' ? 0.06 : 0.25;
    const alpha = dim ? dimAlpha : 1;
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
  }, [activeNodeId, graphData.nodes.length, highlightNodeIds, legendFocus, legendDimMode, isDark, labelMode, selectedNodeId]);

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
  const reheatLayout = useCallback(() => {
    markUserInteracted();
    if (fgRef.current) fgRef.current.d3ReheatSimulation();
  }, [markUserInteracted]);
  const unpinAll = useCallback(() => {
    for (const node of graphData.nodes) {
      node.fx = undefined;
      node.fy = undefined;
    }
    markUserInteracted();
    try { fgRef.current && fgRef.current.d3ReheatSimulation(); } catch { /* ignore */ }
  }, [graphData.nodes, markUserInteracted]);
  const toggleLegendFocus = useCallback((key) => {
    setLegendFocus((prev) => (prev === key ? null : key));
  }, []);

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
          const sType = nodeTypeById.get(sId);
          const tType = nodeTypeById.get(tId);
          const legendDim = legendFocus && !(sType?.includes(legendFocus) || tType?.includes(legendFocus));
          const dim = (activeNodeId && !highlighted) || legendDim;
          const dimAlpha = legendDimMode === 'hide' ? 0.08 : 0.25;
          if (dim) return `rgba(148,163,184,${dimAlpha})`;
          return highlighted ? '#38bdf8' : 'rgba(148,163,184,0.65)';
        }}
        linkWidth={link => (highlightLinks.has(link) ? 2.2 : (legendFocus ? 0.7 : 1.1))}
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
          <button
            type="button"
            onClick={unpinAll}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
            title="固定解除（pin解除）"
          >
            固定解除
          </button>
          <button
            type="button"
            onClick={reheatLayout}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
            title="再レイアウト（reheat）"
          >
            再レイアウト
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
                onClick={() => setLabelMode('all')}
                aria-pressed={labelMode === 'all'}
                className={`px-2.5 py-1.5 text-[12px] font-semibold border-l border-slate-200 dark:border-slate-600 ${labelMode === 'all' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800'}`}
              >
                全部
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
          <button
            type="button"
            onClick={() => setShowRelatedInsects((prev) => !prev)}
            disabled={!currentInsect}
            className={`px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 dark:border-slate-600 ${
              showRelatedInsects ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-200' : 'bg-white/70 dark:bg-slate-900/40'
            } ${!currentInsect ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white dark:hover:bg-slate-800'}`}
            title="食草から関連昆虫を表示/非表示"
          >
            関連昆虫{showRelatedInsects ? 'ON' : 'OFF'}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">間隔</span>
            <input
              type="range"
              min="32"
              max="80"
              step="4"
              value={linkDistance}
              onChange={(e) => setLinkDistance(parseInt(e.target.value, 10))}
              className="w-20"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowHelp((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 dark:border-slate-600 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
            title="操作ヘルプ"
          >
            ？ヘルプ
          </button>
        </div>
      </div>

      {showHelp && (
        <div data-fg-ui className="absolute top-16 left-3 right-3 sm:right-auto sm:w-[360px] bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 text-xs text-slate-700 dark:text-slate-200">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-bold text-sm mb-2">操作ガイド</div>
              <ul className="space-y-1 list-disc list-inside text-[12px]">
                <li>ドラッグで移動、ホイール/ピンチでズーム</li>
                <li>タップ/クリックで選択、同じノードを素早く2回で詳細</li>
                <li>長押しでノード固定（モバイル）</li>
                <li>ラベル/関連数/間隔を調整して密度をコントロール</li>
              </ul>
            </div>
            <button
              type="button"
              className="shrink-0 p-1 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white"
              onClick={() => setShowHelp(false)}
              aria-label="ヘルプを閉じる"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div data-fg-ui className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow border border-slate-200 dark:border-slate-600 p-3 text-xs text-slate-700 dark:text-slate-200 space-y-2">
        {currentInsect && (
          <button
            type="button"
            className={`w-full flex items-center gap-2 cursor-pointer px-1 py-1 rounded text-left ${legendFocus === 'insect-current' ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}
            onClick={() => toggleLegendFocus('insect-current')}
            aria-pressed={legendFocus === 'insect-current'}
          >
            <span className="w-3 h-3 rounded-full bg-rose-400"></span>現在の昆虫
          </button>
        )}
        {currentPlantName && (
          <button
            type="button"
            className={`w-full flex items-center gap-2 cursor-pointer px-1 py-1 rounded text-left ${legendFocus === 'plant-current' ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}
            onClick={() => toggleLegendFocus('plant-current')}
            aria-pressed={legendFocus === 'plant-current'}
          >
            <span className="w-3 h-3 rounded-full bg-emerald-400"></span>現在の植物
          </button>
        )}
        <button
          type="button"
          className={`w-full flex items-center gap-2 cursor-pointer px-1 py-1 rounded text-left ${legendFocus === 'plant' ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}
          onClick={() => toggleLegendFocus('plant')}
          aria-pressed={legendFocus === 'plant'}
        >
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>食草
        </button>
        <button
          type="button"
          className={`w-full flex items-center gap-2 cursor-pointer px-1 py-1 rounded text-left ${legendFocus === 'insect' ? 'bg-slate-100 dark:bg-slate-700' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}
          onClick={() => toggleLegendFocus('insect')}
          aria-pressed={legendFocus === 'insect'}
        >
          <span className="w-3 h-3 rounded-full bg-sky-400"></span>関連する昆虫
        </button>
        <div className="pt-2 mt-2 border-t border-slate-200/70 dark:border-slate-700/70 flex items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-300">絞り込み</span>
          <div className="inline-flex rounded-md overflow-hidden border border-slate-200 dark:border-slate-600">
            <button
              type="button"
              onClick={() => setLegendDimMode('fade')}
              aria-pressed={legendDimMode === 'fade'}
              className={`px-2 py-1 text-[11px] font-semibold ${legendDimMode === 'fade' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800'}`}
            >
              薄く
            </button>
            <button
              type="button"
              onClick={() => setLegendDimMode('hide')}
              aria-pressed={legendDimMode === 'hide'}
              className={`px-2 py-1 text-[11px] font-semibold border-l border-slate-200 dark:border-slate-600 ${legendDimMode === 'hide' ? 'bg-slate-100 dark:bg-slate-700' : 'bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800'}`}
            >
              隠す
            </button>
          </div>
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
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${selectedNode.type.startsWith('plant') ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60' : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60'}`}>
                  {selectedNode.type.startsWith('plant') ? '植物' : '昆虫'}
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
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">食草</div>
                    {selectedInsectHostPlants.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">不明 / 未登録</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedInsectHostPlants.slice(0, MAX_PANEL_ITEMS).map((p, idx) => (
                          <button
                            type="button"
                            key={`${p.name}_${p.part}_${idx}`}
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
