import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';

// よりリッチなビジュアルだが、画像読み込みなど重い処理は排除して安定動作を優先
// - ホバーで近傍をハイライト
// - カーブリンクと淡いグラデ背景
// - ズームコントロール、凡例付き
// - クリックで詳細ページへ遷移（昆虫・植物）

const MAX_RELATED = 40;

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

  const [highlightNodes, setHighlightNodes] = useState(new Set());
  const [highlightLinks, setHighlightLinks] = useState(new Set());
  const [hoverNode, setHoverNode] = useState(null);
  const [legendFocus, setLegendFocus] = useState(null);

  const isBrowser = typeof document !== 'undefined';
  const isDarkMode = isBrowser && document.documentElement.classList.contains('dark');

  // グラフデータ生成（シンプルな構造）
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];
    if (!hostPlantsMap || (!currentInsect && !currentPlantName)) return { nodes, links };

    const addNode = (id, name, type, raw) => {
      if (!nodes.find(n => n.id === id)) {
        nodes.push({ id, name, type, raw });
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

      // 食草を取り出す
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

    // 初期配置: 重なり回避のために極座標で広めに配置
    const nodesArray = nodes;
    const plantNodes = nodesArray.filter(n => n.type === 'plant' || n.type === 'current-plant');
    
    // 半径を大幅に拡大してスペース確保
    const R_PLANT = Math.max(400, plantNodes.length * 60); 
    plantNodes.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / Math.max(1, plantNodes.length);
      p.x = R_PLANT * Math.cos(angle);
      p.y = R_PLANT * Math.sin(angle);
    });

    // plant 周りに子昆虫を円配置
    const nodeById = new Map(nodesArray.map(n => [n.id, n]));
    plantNodes.forEach(p => {
      const neighbors = links
        .filter(l => (l.source === p.id || l.target === p.id))
        .map(l => (l.source === p.id ? l.target : l.source))
        .map(id => nodeById.get(typeof id === 'object' ? id.id : id))
        .filter(n => n && n.type === 'insect');
      if (neighbors.length === 0) return;
      
      // 子ノード間の距離も広げる
      const r = Math.max(150, neighbors.length * 25); 
      neighbors.forEach((n, idx) => {
        const a = (2 * Math.PI * idx) / neighbors.length;
        n.x = (p.x || 0) + r * Math.cos(a);
        n.y = (p.y || 0) + r * Math.sin(a);
      });
    });

    const centerNode = nodesArray.find(n => n.type === 'current-insect' || n.type === 'current-plant');
    if (centerNode) {
      centerNode.x = 0;
      centerNode.y = 0;
    }

    return { nodes, links };
  }, [currentInsect, currentPlantName, hostPlantsMap, allInsects]);

  // 初期ズーム調整
  useEffect(() => {
    if (!fgRef.current) return;
    
    // 物理演算パラメータの強力な調整
    const linkForce = fgRef.current.d3Force('link');
    if (linkForce) {
      // リンク距離を長くして密集を防ぐ
      linkForce.distance(link => (link.source?.type?.includes('plant') || link.target?.type?.includes('plant') ? 350 : 200));
    }
    
    const chargeForce = fgRef.current.d3Force('charge');
    if (chargeForce) {
      // 反発力を極大化
      chargeForce.strength(-3500);
    }
    
    // シミュレーションを再加熱して安定させる
    fgRef.current.d3ReheatSimulation();
    
    const t = setTimeout(() => {
      try {
        fgRef.current.zoomToFit(400, 60);
      } catch (_) {}
    }, 800); // 安定するまで少し待つ
    return () => clearTimeout(t);
  }, [graphData]);

  // ハイライト制御
  const handleNodeHover = useCallback(
    (node) => {
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
    },
    [graphData]
  );

  // クリックで遷移/フォーカス
  const handleNodeClick = useCallback(
    (node) => {
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
    },
    [navigate]
  );

  // ノード描画
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
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

    const colors = {
      'insect-current': '#fb7185',
      insect: '#38bdf8',
      'plant-current': '#22c55e',
      plant: '#10b981'
    };
    const baseR = node.type.includes('current') ? 10 : 6;
    const radius = baseR / Math.sqrt(globalScale);

    const dim = (hoverNode && !highlightNodes.has(node)) || (legendFocus && !node.type.includes(legendFocus));
    const alpha = dim ? 0.2 : 1;

    // glow
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = colors[node.type] || '#94a3b8';
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // core
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colors[node.type] || '#94a3b8';
    ctx.fill();
    ctx.lineWidth = 1.2 / Math.sqrt(globalScale);
    ctx.strokeStyle = 'rgba(15,23,42,0.2)';
    ctx.stroke();

    // label logic
    const isHovered = node === hoverNode;
    const isHighlighted = highlightNodes.has(node);
    
    // LOD: Show labels based on importance and zoom level
    const isCurrent = node.type.includes('current');
    const isPlant = node.type === 'plant';
    
    const shouldShowLabel = 
      isHovered || 
      isHighlighted || 
      (isCurrent && globalScale > 0.6) || 
      (isPlant && globalScale > 1.2) ||
      (globalScale > 1.8);

    // label
    const label = node.name;
    const fontSize = 13 / Math.sqrt(globalScale);
    ctx.font = `${fontSize}px "Helvetica Neue", "Segoe UI", sans-serif`;
    
    // LOD: Show labels based on importance and zoom level
    // - Always show hovered or highlighted
    // - Show current insect/plant ALWAYS (or very low threshold)
    // - Show plants earlier
    // - Show others earlier
    const isCurrent = node.type.includes('current');
    const isPlant = node.type === 'plant';
    
    // User Request: Always show labels for better visibility
    const shouldShowLabel = true;

    if (shouldShowLabel) {
      ctx.save();
      ctx.globalAlpha = alpha;
      
      const textWidth = ctx.measureText(label).width;
      const padding = 3 / Math.sqrt(globalScale);
      const labelWidth = textWidth + padding * 2;
      const labelHeight = fontSize + padding * 2;
      const y = node.y + radius + 2; // Position below node

      // Background Box
      ctx.fillStyle = isDarkMode ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.85)';
      ctx.strokeStyle = isDarkMode ? 'rgba(148, 163, 184, 0.4)' : 'rgba(203, 213, 225, 0.6)';
      ctx.lineWidth = 1 / Math.sqrt(globalScale);
      
      ctx.beginPath();
      drawRoundedRect(
        ctx,
        node.x - labelWidth / 2,
        y,
        labelWidth,
        labelHeight,
        3 / Math.sqrt(globalScale)
      );
      ctx.fill();
      ctx.stroke();

      // Text with Outline
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Text Fill
      ctx.fillStyle = isDarkMode ? '#f1f5f9' : '#1e293b';
      ctx.fillText(label, node.x, y + labelHeight / 2);
      
      ctx.restore();
    }
  }, [hoverNode, highlightNodes, legendFocus, isDarkMode]);

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() * 1.4, 350);
  }, []);
  const zoomOut = useCallback(() => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() / 1.4, 350);
  }, []);
  const zoomFit = useCallback(() => {
    if (fgRef.current) fgRef.current.zoomToFit(400, 60);
  }, []);

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
        cooldownTicks={300}
        d3VelocityDecay={0.1}
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