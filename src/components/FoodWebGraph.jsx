import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

// シンプルなネットワーク図（再実装）
// ・画像読み込みロジックとは独立させ、ビルド失敗を回避
// ・中心ノード: 現在の昆虫 or 植物
// ・辺: 昆虫→食草、食草→同じ食草を利用する別昆虫

const MAX_RELATED = 30;

const FoodWebGraph = React.memo(function FoodWebGraph({
  currentInsect,
  currentPlantName,
  allInsects,
  hostPlantsMap,
  width = 640,
  height = 480
}) {
  const fgRef = useRef(null);

  // グラフデータ生成
  const graphData = useMemo(() => {
    const nodes = [];
    const links = [];

    if (!hostPlantsMap || (!currentInsect && !currentPlantName)) {
      return { nodes, links };
    }

    const isPlantMode = !!currentPlantName;

    const addNode = (id, name, type) => {
      if (!nodes.find(n => n.id === id)) {
        nodes.push({ id, name, type });
      }
    };

    if (isPlantMode) {
      // 中心: 植物
      const centerId = `plant:${currentPlantName}`;
      addNode(centerId, currentPlantName, 'plant-current');

      const relatedInsects = hostPlantsMap[currentPlantName] || [];
      relatedInsects.slice(0, MAX_RELATED).forEach(name => {
        const insectId = `insect:${name}`;
        addNode(insectId, name, 'insect');
        links.push({ source: centerId, target: insectId });
      });
    } else {
      // 中心: 昆虫
      const centerId = `insect:${currentInsect.name}`;
      addNode(centerId, currentInsect.name, 'insect-current');

      // 食草リストを抽出
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

        // 同じ食草を使う他の昆虫を関連として追加
        const related = (hostPlantsMap[plantName] || []).filter(n => n !== currentInsect.name);
        related.slice(0, MAX_RELATED).forEach(name => {
          const insectId = `insect:${name}`;
          addNode(insectId, name, 'insect');
          links.push({ source: plantId, target: insectId });
        });
      });
    }

    return { nodes, links };
  }, [currentInsect, currentPlantName, hostPlantsMap, allInsects]);

  // 初期ズームフィット
  useEffect(() => {
    if (!fgRef.current) return;
    const t = setTimeout(() => {
      try {
        fgRef.current.zoomToFit(400, 50);
      } catch (_) {}
    }, 300);
    return () => clearTimeout(t);
  }, [graphData]);

  const nodeCanvasObject = useCallback((node, ctx) => {
    const colors = {
      'insect-current': '#f97316',
      insect: '#3b82f6',
      'plant-current': '#22c55e',
      plant: '#10b981'
    };
    const r = node.type.includes('current') ? 10 : 7;
    ctx.fillStyle = colors[node.type] || '#64748b';
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
    ctx.fill();

    ctx.fillStyle = '#1e293b';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(node.name, node.x + r + 4, node.y);
  }, []);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950">
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeLabel="name"
        nodeCanvasObject={nodeCanvasObject}
        linkColor={() => '#cbd5e1'}
        linkWidth={1.4}
        backgroundColor="#f8fafc"
      />
    </div>
  );
});

export default FoodWebGraph;
