import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';
import { loadInsectImageIndexes, loadPlantImageFilenames } from '../services/imageIndex';
import { createSafeInsectFilename } from '../utils/image';

// Helper to normalize plant names for lookup
const normalizePlantName = (name) => {
  if (!name) return '';
  return name
    .replace(/（[^）]*）/g, '') // Remove full-width parentheses content
    .replace(/\([^)]*\)/g, '') // Remove half-width parentheses content
    .replace(/の(花|実|葉|枝|茎|根|蕾).*/, '') // Remove parts suffix
    .trim();
};

const FoodWebGraph = ({
  currentInsect,
  currentPlantName,
  allInsects,
  hostPlantsMap,
  width,
  height
}) => {
  const navigate = useNavigate();
  const fgRef = useRef();
  
  // State for interaction and images
  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  
  // Image loading state
  const [images, setImages] = useState({});
  const [imageExtMap, setImageExtMap] = useState({});
  const [imageBaseSet, setImageBaseSet] = useState(new Set());
  const [plantImageNames, setPlantImageNames] = useState([]);
  
  const loadingImagesRef = useRef(new Set());
  const failedImagesRef = useRef(new Set());
  const cacheBustRef = useRef(import.meta.env.DEV ? `?v=${Date.now()}` : (import.meta.env.VITE_ASSET_VERSION ? `?v=${import.meta.env.VITE_ASSET_VERSION}` : ''));
  const assetBase = import.meta.env.BASE_URL || '/';

  // Use dark mode detection
  const isBrowser = typeof document !== 'undefined';
  const isDarkMode = isBrowser && document.documentElement.classList.contains('dark');

  // Load Image Indexes
  useEffect(() => {
    let aborted = false;
    loadInsectImageIndexes()
      .then(({ names, exts }) => {
        if (aborted) return;
        setImageExtMap(exts || {});
        setImageBaseSet(new Set(Array.from(names || [])));
      })
      .catch(() => {
        if (aborted) return;
        setImageExtMap({});
        setImageBaseSet(new Set());
      });
      
    loadPlantImageFilenames()
      .then((names) => {
        if (aborted) return;
        setPlantImageNames(Array.isArray(names) ? names : []);
      })
      .catch(() => {
        if (aborted) return;
        setPlantImageNames([]);
      });
      
    return () => { aborted = true; };
  }, []);

  // Helper: Resolve insect image candidates
  const resolveInsectImageCandidates = useCallback((detail) => {
    if (!detail) return [];
    if (detail.image) return [detail.image]; // direct URL if available
    
    const candidates = [
      detail.scientificFilename,
      detail.scientificName ? createSafeInsectFilename(detail.scientificName) : null,
      detail.name ? createSafeInsectFilename(detail.name) : null,
      detail.name
    ].filter(Boolean);

    const urls = [];
    for (const cand of candidates) {
      const ext = imageExtMap[cand];
      if (ext) {
        urls.push(`${assetBase}images/insects/${encodeURIComponent(cand)}${ext}${cacheBustRef.current}`);
      } else if (imageBaseSet.has(cand)) {
        // fallback assumption jpg
        urls.push(`${assetBase}images/insects/${encodeURIComponent(cand)}.jpg${cacheBustRef.current}`);
      }
    }
    return urls;
  }, [assetBase, imageExtMap, imageBaseSet]);

  // Helper: Resolve plant image candidates
  const resolvePlantImageCandidates = useCallback((plantName) => {
    if (!plantName || plantImageNames.length === 0) return [];
    const normalized = normalizePlantName(plantName);
    const variants = [
      plantName,
      normalized,
      plantName.replace(/＿/g, '_'),
      normalized.replace(/＿/g, '_'),
      plantName.replace(/_/g, '＿'),
      normalized.replace(/_/g, '＿')
    ].filter(Boolean);

    const hits = plantImageNames.filter(n =>
      variants.some(v => v && n.startsWith(v))
    );
    if (hits.length === 0) return [];
    
    const exts = ['.jpg', '.JPG', '.jpeg', '.png', '.webp'];
    const urls = [];
    // Sort hits by length (shortest match usually best?) or just take first
    hits.slice(0, 3).forEach(base => {
      exts.forEach(ext => {
        urls.push(`${assetBase}images/plants/${encodeURIComponent(base)}${ext}${cacheBustRef.current}`);
      });
    });
    return urls;
  }, [assetBase, plantImageNames]);

  // --- Data Processing ---
  const graphData = useMemo(() => {
    const isPlantMode = !!currentPlantName;
    if ((!currentInsect && !currentPlantName) || !hostPlantsMap) return { nodes: [], links: [] };

    const nodes = new Map();
    const links = [];

    if (isPlantMode) {
      const centerId = `plant:${currentPlantName}`;
      nodes.set(centerId, {
        id: centerId,
        name: currentPlantName,
        type: 'current-plant',
        group: 1,
        val: 30,
        imgCandidates: resolvePlantImageCandidates(currentPlantName),
        raw: { name: currentPlantName }
      });
    } else {
      // 1. Central Node (Current Insect)
      const centerId = `insect:${currentInsect.name}`;
      nodes.set(centerId, {
        id: centerId,
        name: currentInsect.name,
        type: 'current-insect',
        group: 0,
        val: 30,
        imgCandidates: resolveInsectImageCandidates(currentInsect),
        raw: currentInsect
      });
    }

    // Helper to add insect node
    const addInsectNode = (name, group = 2) => {
      const id = `insect:${name}`;
      if (!nodes.has(id)) {
        const detail = allInsects.find(i => i.name === name);
        nodes.set(id, {
          id,
          name,
          type: 'insect',
          group,
          val: 12,
          raw: detail,
          imgCandidates: resolveInsectImageCandidates(detail || { name })
        });
      }
      return id;
    };

    // Helper to add plant node
    const addPlantNode = (name, isCenter = false) => {
      const id = `plant:${name}`;
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          name,
          type: isCenter ? 'current-plant' : 'plant',
          group: 1,
          val: isCenter ? 30 : 20,
          imgCandidates: resolvePlantImageCandidates(name)
        });
      }
      return id;
    };

    let plants = [];
    let centerId = null;
    if (isPlantMode) {
      centerId = addPlantNode(currentPlantName, true);
      const normalized = normalizePlantName(currentPlantName);
      const feederNames = [
        ...(hostPlantsMap[currentPlantName] || []),
        ...(hostPlantsMap[normalized] || [])
      ];
      const uniqueFeeders = Array.from(new Set(feederNames));
      const TOP_INSECTS = 120;
      uniqueFeeders.slice(0, TOP_INSECTS).forEach(name => {
        const insectId = addInsectNode(name, 2);
        links.push({ source: centerId, target: insectId, value: 2, color: isDarkMode ? '#60a5fa' : '#3b82f6' });
        const detail = allInsects.find(i => i.name === name);
        let otherPlants = [];
        if (detail?.hostPlantsDetailed?.length) {
          otherPlants = detail.hostPlantsDetailed.map(p => p.plant || p.name).filter(Boolean);
        } else if (Array.isArray(detail?.hostPlants)) {
          otherPlants = detail.hostPlants;
        } else if (typeof detail?.hostPlants === 'string') {
          otherPlants = detail.hostPlants.split(/[、，,]/).map(s => s.trim());
        }
        otherPlants = otherPlants.filter(p => p && p !== '不明' && normalizePlantName(p) !== normalized);
        otherPlants.slice(0, 8).forEach(p => {
          const pid = addPlantNode(p);
          links.push({ source: insectId, target: pid, value: 1, color: isDarkMode ? '#34d399' : '#10b981' });
        });
      });
    } else {
      const center = nodes.values().next().value;
      centerId = center.id;
      // 2. Host Plants
      if (Array.isArray(currentInsect.hostPlantsDetailed) && currentInsect.hostPlantsDetailed.length > 0) {
        plants = currentInsect.hostPlantsDetailed.map(p => p.plant || p.name);
      } else if (Array.isArray(currentInsect.hostPlants)) {
        plants = currentInsect.hostPlants;
      } else if (typeof currentInsect.hostPlants === 'string') {
        plants = currentInsect.hostPlants.split(/[、，,]/).map(s => s.trim());
      }
      plants = plants.filter(p => p && p !== '不明' && p !== 'undefined');
    }

    let totalTruncated = 0;

    if (!isPlantMode) {
      plants.forEach(plantName => {
        const plantId = addPlantNode(plantName);
        links.push({ source: centerId, target: plantId, value: 3, color: isDarkMode ? '#34d399' : '#10b981' });

        // 3. Related Insects
        const normalizedPlantName = normalizePlantName(plantName);
        let relatedInsectNames = hostPlantsMap[plantName] || 
                                 hostPlantsMap[normalizedPlantName] || [];
                                 
        if (!relatedInsectNames || relatedInsectNames.length === 0) {
           const potentialKeys = Object.keys(hostPlantsMap).filter(k => k.includes(normalizedPlantName) || normalizedPlantName.includes(k));
           potentialKeys.forEach(k => {
               relatedInsectNames = [...relatedInsectNames, ...hostPlantsMap[k]];
           });
           relatedInsectNames = [...new Set(relatedInsectNames)];
        }
        
        const scoredInsects = relatedInsectNames
          .filter(name => name !== currentInsect.name)
          .map(name => {
            const detail = allInsects.find(i => i.name === name);
            let score = 1;
            if (detail) {
              if (currentInsect.classification?.family && detail.classification?.family === currentInsect.classification.family) score += 10;
              if (currentInsect.type === detail.type) score += 5;
            }
            return { name, score, detail };
          })
          .sort((a, b) => b.score - a.score);

        const TOP_N = 30; // Show more when many insects share a plant (e.g., ブナ科)
        if (scoredInsects.length > TOP_N) {
          totalTruncated += (scoredInsects.length - TOP_N);
        }
        
        scoredInsects.slice(0, TOP_N).forEach(item => {
          const insectId = addInsectNode(item.name);
          links.push({ source: plantId, target: insectId, value: 1, color: isDarkMode ? '#60a5fa' : '#3b82f6' });
        });
      });
    }

    const nodesArray = Array.from(nodes.values());

    // --- 初期配置: 重なり回避のために極座標でざっくり配置してから物理演算 ---
    const plantNodes = nodesArray.filter(n => n.type === 'plant' || n.type === 'current-plant');
    const insectNodes = nodesArray.filter(n => n.type === 'insect');
    const centerNode = nodesArray.find(n => n.type === 'current-insect' || n.type === 'current-plant');

    const R_PLANT = Math.max(200, plantNodes.length * 14);
    plantNodes.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, plantNodes.length);
      p.x = R_PLANT * Math.cos(angle);
      p.y = R_PLANT * Math.sin(angle);
    });

    // plant 周りに子昆虫を円配置
    const linksArray = links;
    const nodeById = new Map(nodesArray.map(n => [n.id, n]));
    plantNodes.forEach(p => {
      const neighbors = linksArray
        .filter(l => (l.source === p.id || l.target === p.id))
        .map(l => (l.source === p.id ? l.target : l.source))
        .map(id => nodeById.get(typeof id === 'object' ? id.id : id))
        .filter(n => n && n.type === 'insect');
      if (neighbors.length === 0) return;
      const r = Math.max(70, neighbors.length * 6);
      neighbors.forEach((n, idx) => {
        const a = (2 * Math.PI * idx) / neighbors.length;
        n.x = (p.x || 0) + r * Math.cos(a);
        n.y = (p.y || 0) + r * Math.sin(a);
      });
    });

    // 中央ノード
    if (centerNode) {
      centerNode.x = 0;
      centerNode.y = 0;
    }

    return {
      nodes: nodesArray,
      links: linksArray,
      truncatedCount: totalTruncated
    };
  }, [currentInsect, currentPlantName, allInsects, hostPlantsMap, isDarkMode, resolveInsectImageCandidates, resolvePlantImageCandidates]);

  // --- Force layout tuning to reduce overlap ---
  useEffect(() => {
    if (!fgRef.current) return;
    
    // 衝突回避（forceCollide）は外部依存が必要なため削除し、
    // 標準の反発力（charge）とリンク距離で調整する
    
    // リンク距離を食草中心に少し長めに
    const linkForce = fgRef.current.d3Force('link');
    if (linkForce) {
      linkForce.distance(link => (link.source?.type === 'plant' ? 120 : 90));
    }
    // 反発力を強めて重なりを軽減
    const chargeForce = fgRef.current.d3Force('charge');
    if (chargeForce && chargeForce.strength) {
      chargeForce.strength(-200);
    }
    
    fgRef.current.d3ReheatSimulation();
  }, [graphData]);

  // --- Interaction Handlers ---
  
  const handleNodeHover = useCallback((node) => {
    if ((!node && !hoverNode) || (node && hoverNode === node)) return;

    setHoverNode(node || null);

    const newHighlightNodes = new Set();
    const newHighlightLinks = new Set();

    if (node) {
      newHighlightNodes.add(node);
      graphData.links.forEach(link => {
        const sourceId = link.source.id || link.source;
        const targetId = link.target.id || link.target;
        if (sourceId === node.id || targetId === node.id) {
          newHighlightLinks.add(link);
          const neighborId = sourceId === node.id ? targetId : sourceId;
          const neighbor = graphData.nodes.find(n => n.id === neighborId);
          if (neighbor) newHighlightNodes.add(neighbor);
        }
      });
    }

    setHighlightNodes(newHighlightNodes);
    setHighlightLinks(newHighlightLinks);
  }, [graphData, hoverNode]);

  const handleNodeClick = useCallback(node => {
    if (node.type === 'insect' && node.raw) {
      const type = node.raw.type || 'moth';
      const targetId = node.raw.id;
      navigate(`/${type}/${targetId}`);
    } else if (node.type === 'plant' || node.type === 'current-plant') {
      navigate(`/plant/${encodeURIComponent(node.name)}`);
    } else if (node.type === 'current-insect') {
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2.5, 2000);
    }
  }, [navigate]);

  // --- Custom Rendering ---
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.name;
    const fontSize = 14 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

    const isHovered = node === hoverNode;
    const isHighlighted = highlightNodes.has(node);
    const dim = hoverNode && !isHighlighted && !isHovered;
    
    let alpha = dim ? 0.15 : 1;
    
    // Colors
    let fillStyle, strokeStyle;
    if (node.type === 'current-insect') {
        fillStyle = `rgba(244, 63, 94, ${alpha})`; 
        strokeStyle = `rgba(255, 228, 230, ${alpha})`; 
    } else if (node.type === 'current-plant') {
        fillStyle = `rgba(5, 150, 105, ${alpha})`;
        strokeStyle = `rgba(209, 250, 229, ${alpha})`;
    } else if (node.type === 'plant') {
        fillStyle = `rgba(16, 185, 129, ${alpha})`; 
        strokeStyle = `rgba(209, 250, 229, ${alpha})`;
    } else {
        fillStyle = `rgba(14, 165, 233, ${alpha})`; 
        strokeStyle = `rgba(224, 242, 254, ${alpha})`;
    }

    // Draw Highlight Glow
    if ((isHovered || isHighlighted) && !dim && globalScale < 2) {
       ctx.beginPath();
       ctx.arc(node.x, node.y, node.val * 1.3, 0, 2 * Math.PI, false);
       ctx.fillStyle = node.type === 'current-insect' ? `rgba(244, 63, 94, 0.3)` : `rgba(14, 165, 233, 0.3)`;
       if (node.type === 'plant' || node.type === 'current-plant') ctx.fillStyle = `rgba(16, 185, 129, 0.3)`;
       ctx.fill();
    }

    // Determine Image
    let imgToDraw = null;
    const candidates = node.imgCandidates || [];
    
    // Check if we have a loaded image
    const loadedUrl = candidates.find(url => images[url]);
    if (loadedUrl) {
      imgToDraw = images[loadedUrl];
    } else if (candidates.length > 0 && !dim) {
      // Trigger load if not dimmed and not loaded/failed
      const urlToLoad = candidates.find(url => !loadingImagesRef.current.has(url) && !failedImagesRef.current.has(url));
      if (urlToLoad) {
        loadingImagesRef.current.add(urlToLoad);
        const newImg = new Image();
        newImg.crossOrigin = 'anonymous';
        newImg.src = urlToLoad;
        newImg.onload = () => {
          loadingImagesRef.current.delete(urlToLoad);
          setImages(prev => ({ ...prev, [urlToLoad]: newImg }));
        };
        newImg.onerror = () => {
          loadingImagesRef.current.delete(urlToLoad);
          failedImagesRef.current.add(urlToLoad);
        };
      }
    }

    // Draw Node (Image or Circle)
    // Performance Optimization: Only draw images when zoomed in (LOD) or hovered
    const drawImage = !!imgToDraw && !dim; // 常に描画（ぼかしなし）

    if (drawImage) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
      ctx.clip();
      ctx.globalAlpha = alpha;
      try {
        ctx.drawImage(imgToDraw, node.x - node.val, node.y - node.val, node.val * 2, node.val * 2);
      } catch (e) {
        ctx.fillStyle = fillStyle;
        ctx.fill();
      }
      ctx.restore();
      
      // Border ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
      ctx.lineWidth = (isHovered ? 3 : 1.5) / globalScale;
      ctx.strokeStyle = isHovered ? (isDarkMode ? '#fff' : '#333') : strokeStyle;
      ctx.stroke();
    } else {
      // Standard Circle (Low Detail Mode)
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
      ctx.fillStyle = fillStyle;
      ctx.fill();
      
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = isDarkMode ? `rgba(30, 41, 59, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
      ctx.stroke();
    }
    
    // Reset alpha for text
    ctx.globalAlpha = 1;

    // Draw Label
    const shouldShowLabel =
      isHovered ||
      isHighlighted ||
      node.type === 'plant' ||
      node.type === 'current-insect' ||
      globalScale > 1.1;
    
    if (shouldShowLabel && !dim) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const yOffset = node.val + fontSize + 2;
      
      // Label Background
      ctx.fillStyle = isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
      const bgX = node.x - bckgDimensions[0] / 2;
      const bgY = node.y + yOffset - bckgDimensions[1] / 2;
      ctx.fillRect(bgX, bgY, bckgDimensions[0], bckgDimensions[1]);
      
      // Text
      ctx.fillStyle = isDarkMode ? '#e2e8f0' : '#1e293b';
      ctx.font = isHovered ? `bold ${fontSize}px Sans-Serif` : `${fontSize}px Sans-Serif`;
      ctx.fillText(label, node.x, node.y + yOffset);
    }
  }, [isDarkMode, images, hoverNode, highlightNodes]);

  const handleZoomIn = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() * 1.5, 400);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoom(fgRef.current.zoom() / 1.5, 400);
    }
  }, []);

  const handleZoomToFit = useCallback(() => {
    if (fgRef.current) {
      fgRef.current.zoomToFit(400, 50);
    }
  }, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 relative shadow-lg group">
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeLabel="name"
        nodeCanvasObject={nodeCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        // Link Styling
        linkColor={link => {
            const isHighlighted = highlightLinks.has(link);
            const isDim = hoverNode && !isHighlighted;
            if (isDim) return isDarkMode ? 'rgba(30, 41, 59, 0.2)' : 'rgba(226, 232, 240, 0.3)'; 
            if (isHighlighted) return isDarkMode ? '#60a5fa' : '#3b82f6';
            return link.color || '#cbd5e1';
        }}
        linkWidth={link => highlightLinks.has(link) ? 2.5 : 1}
        linkDirectionalParticles={link => highlightLinks.has(link) ? 3 : 0}
        linkDirectionalParticleWidth={3}
        linkDirectionalParticleSpeed={0.006}
        
        backgroundColor={isDarkMode ? "#0f172a" : "#f8fafc"}
        linkCurvature={0.08}
        d3VelocityDecay={0.55}
        cooldownTicks={120} // 少しだけシミュレーションを回して初期重なりを解消
      />
      
      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <button
          onClick={handleZoomIn}
          className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="拡大"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        <button
          onClick={handleZoomOut}
          className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="縮小"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={handleZoomToFit}
          className="p-2 bg-white/90 dark:bg-slate-800/90 backdrop-blur rounded-lg shadow-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="全体表示"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
        </button>
      </div>
      
      {/* Legend Overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 text-xs z-10 pointer-events-none">
        <div className="flex items-center mb-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 mr-2 shadow-sm"></span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">現在の昆虫</span>
        </div>
        <div className="flex items-center mb-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-sm"></span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">食草</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-sky-500 mr-2 shadow-sm"></span>
          <span className="text-slate-700 dark:text-slate-200 font-medium">関連する他の昆虫</span>
        </div>
        
        {graphData.truncatedCount > 0 && (
          <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-600">
            <span className="text-xs text-orange-600 dark:text-orange-400 font-medium flex items-center">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              他 {graphData.truncatedCount} 種は省略
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(FoodWebGraph);
