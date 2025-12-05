import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import { loadInsectImageIndexes, loadPlantImageFilenames } from '../services/imageIndex';
import { createSafeInsectFilename } from '../utils/image';

// ネットワーク図: 画像がある種はサムネで表示。画像が無い場合は従来の円にフォールバック。
// 依存の fetch 失敗や画像読み込み失敗があっても必ず描画が続くように防御的に実装。

const MAX_RELATED = 40;
const IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

const normalizePlantName = (name = '') =>
  name
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/の(花|実|葉|枝|茎|根|蕾).*/, '')
    .trim();

const FoodWebGraph = React.memo(function FoodWebGraph({
  currentInsect,
  currentPlantName,
  allInsects,
  hostPlantsMap,
  width = 720,
  height = 520
}) {
  const fgRef = useRef(null);
  const navigate = useNavigate();

  // image index caches
  const [imageExtMap, setImageExtMap] = useState({});
  const [imageBaseSet, setImageBaseSet] = useState(new Set());
  const [plantImageNames, setPlantImageNames] = useState([]);

  const loadingImagesRef = useRef(new Set());
  const failedImagesRef = useRef(new Set());
  const imageCacheRef = useRef({});

  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  const [legendFocus, setLegendFocus] = useState(null);

  const assetBase = useMemo(() => import.meta.env.BASE_URL || '/', []);
  const cacheBust = useMemo(() => {
    if (import.meta.env.DEV) return `?v=${Date.now()}`;
    return import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : '';
  }, []);

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
        urls.push(`${assetBase}images/insects/${encodeURIComponent(base)}${ext}${cacheBust}`);
      } else if (imageBaseSet.has(base)) {
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
      const hasExt = IMG_EXTS.some(ext => base.endsWith(ext));
      if (hasExt) {
        urls.push(`${assetBase}images/plants/${encodeURIComponent(base)}${cacheBust}`);
      } else {
        IMG_EXTS.forEach(ext => {
          urls.push(`${assetBase}images/plants/${encodeURIComponent(base)}${ext}${cacheBust}`);
        });
      }
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

    if (currentPlantName) {
      const centerId = `plant:${currentPlantName}`;
      addNode(centerId, currentPlantName, 'plant-current');
      const related = hostPlantsMap[currentPlantName] || [];
      related.slice(0, MAX_RELATED).forEach(name => {
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
        plants = currentInsect.hostPlantsDetailed.map(p => p.name || p.plant).filter(Boolean);
      } else if (Array.isArray(currentInsect.hostPlants)) {
        plants = currentInsect.hostPlants.filter(p => p && p !== '不明');
      } else if (typeof currentInsect.hostPlants === 'string') {
        plants = currentInsect.hostPlants.split(/[、，,]/).map(s => s.trim()).filter(Boolean);
      }

      plants.forEach(plantName => {
        const plantId = `plant:${plantName}`;
        addNode(plantId, plantName, 'plant');
        links.push({ source: centerId, target: plantId });

        const related = (hostPlantsMap[plantName] || []).filter(n => n !== currentInsect.name);
        related.slice(0, MAX_RELATED).forEach(name => {
          const insectDetail = allInsects?.find(i => i.name === name);
          const insectId = `insect:${name}`;
          addNode(insectId, name, 'insect', insectDetail);
          links.push({ source: plantId, target: insectId });
        });
      });
    }

    return { nodes, links };
  }, [currentInsect, currentPlantName, hostPlantsMap, allInsects, insectImageCandidates, plantImageCandidates]);

  // initial fit
  useEffect(() => {
    if (!fgRef.current) return;
    const t = setTimeout(() => {
      try { fgRef.current.zoomToFit(400, 60); } catch (_) {}
    }, 250);
    return () => clearTimeout(t);
  }, [graphData]);

  // hover highlight
  const handleNodeHover = useCallback((node) => {
    if (!node) {
      setHoverNode(null);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }
    const nSet = new Set([node]);
    const lSet = new Set();
    graphData.links.forEach(link => {
      const sId = link.source.id || link.source;
      const tId = link.target.id || link.target;
      if (sId === node.id || tId === node.id) {
        lSet.add(link);
        const neighborId = sId === node.id ? tId : sId;
        const neighbor = graphData.nodes.find(n => n.id === neighborId);
        if (neighbor) nSet.add(neighbor);
      }
    });
    setHoverNode(node);
    setHighlightNodes(nSet);
    setHighlightLinks(lSet);
  }, [graphData]);

  // click navigation
  const handleNodeClick = useCallback((node) => {
    if (!node) return;
    if (node.type.startsWith('insect') && node.raw) {
      const type = node.raw.type || 'moth';
      navigate(`/${type}/${node.raw.id}`);
    } else if (node.type.startsWith('plant')) {
      navigate(`/plant/${encodeURIComponent(node.name)}`);
    } else if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 600);
      fgRef.current.zoom(2.4, 800);
    }
  }, [navigate]);

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
    for (const url of candidates) {
      if (imageCacheRef.current[url]) return url;
      if (failedImagesRef.current.has(url)) continue;
      if (!loadingImagesRef.current.has(url)) {
        loadingImagesRef.current.add(url);
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          loadingImagesRef.current.delete(url);
          imageCacheRef.current[url] = img;
        };
        img.onerror = () => {
          loadingImagesRef.current.delete(url);
          failedImagesRef.current.add(url);
        };
        img.src = url;
      }
    }
    return null;
  };

  // node renderer with image fallback
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const drawLabel = (x, y, label, dim) => {
      const fontSize = 13 / Math.sqrt(globalScale);
      ctx.font = `${fontSize}px "Helvetica Neue", "Segoe UI", sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padding = 4 / Math.sqrt(globalScale);
      const labelWidth = textWidth + padding * 2;
      const labelHeight = fontSize + padding * 2;
      const top = y - labelHeight - 4;
      ctx.fillStyle = `rgba(248,250,252,${dim ? 0.4 : 0.9})`;
      ctx.strokeStyle = `rgba(148,163,184,${dim ? 0.3 : 0.7})`;
      ctx.lineWidth = 1 / Math.sqrt(globalScale);
      drawRoundedRect(ctx, x - labelWidth / 2, top, labelWidth, labelHeight, 4 / Math.sqrt(globalScale));
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#0f172a';
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
    const baseR = node.type.includes('current') ? 12 : 8;
    const radius = baseR / Math.sqrt(globalScale);
    const dim = (hoverNode && !highlightNodes.has(node)) || (legendFocus && !node.type.includes(legendFocus));
    const alpha = dim ? 0.25 : 1;

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
      ctx.strokeStyle = 'rgba(15,23,42,0.35)';
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
      ctx.strokeStyle = 'rgba(15,23,42,0.2)';
      ctx.stroke();
    }

    drawLabel(node.x, node.y, node.name, dim);
  }, [hoverNode, highlightNodes, legendFocus]);

  // zoom controls
  const zoomIn = useCallback(() => { if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() * 1.4, 350); }, []);
  const zoomOut = useCallback(() => { if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() / 1.4, 350); }, []);
  const zoomFit = useCallback(() => { if (fgRef.current) fgRef.current.zoomToFit(400, 60); }, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 dark:from-slate-900 dark:via-slate-850 dark:to-slate-950 relative shadow-md">
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeLabel="name"
        nodeCanvasObject={nodeCanvasObject}
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        linkColor={link => {
          const highlighted = highlightLinks.has(link);
          const dim = hoverNode && !highlighted;
          if (dim) return 'rgba(148,163,184,0.25)';
          return highlighted ? '#38bdf8' : 'rgba(148,163,184,0.65)';
        }}
        linkWidth={link => (highlightLinks.has(link) ? 2.2 : 1.1)}
        linkDirectionalParticles={link => (highlightLinks.has(link) ? 3 : 0)}
        linkDirectionalParticleWidth={1.6}
        linkCurvature={0.18}
        backgroundColor="#f8fafc"
        cooldownTicks={80}
        d3VelocityDecay={0.35}
        onEngineStop={() => fgRef.current && fgRef.current.zoomToFit(400, 60)}
      />

      {/* Zoom buttons */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 text-slate-700 dark:text-slate-200">
        <button onClick={zoomIn} className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" title="拡大">＋</button>
        <button onClick={zoomOut} className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" title="縮小">－</button>
        <button onClick={zoomFit} className="p-2 bg-white/90 dark:bg-slate-800/90 rounded-lg shadow border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700" title="全体表示">⤢</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow border border-slate-200 dark:border-slate-600 p-3 text-xs text-slate-700 dark:text-slate-200 space-y-2">
        <div
          className={`flex items-center gap-2 cursor-pointer px-1 py-1 rounded ${legendFocus === 'insect-current' ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
          onMouseEnter={() => setLegendFocus('insect-current')}
          onMouseLeave={() => setLegendFocus(null)}
        >
          <span className="w-3 h-3 rounded-full bg-rose-400"></span>現在の昆虫
        </div>
        <div
          className={`flex items-center gap-2 cursor-pointer px-1 py-1 rounded ${legendFocus === 'plant' ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
          onMouseEnter={() => setLegendFocus('plant')}
          onMouseLeave={() => setLegendFocus(null)}
        >
          <span className="w-3 h-3 rounded-full bg-emerald-500"></span>食草
        </div>
        <div
          className={`flex items-center gap-2 cursor-pointer px-1 py-1 rounded ${legendFocus === 'insect' ? 'bg-slate-100 dark:bg-slate-700' : ''}`}
          onMouseEnter={() => setLegendFocus('insect')}
          onMouseLeave={() => setLegendFocus(null)}
        >
          <span className="w-3 h-3 rounded-full bg-sky-400"></span>関連する昆虫
        </div>
      </div>
    </div>
  );
});

export default FoodWebGraph;
