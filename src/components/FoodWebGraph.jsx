import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';

// Helper to wrap long text
const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
  const words = text.split('');
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n];
    const metrics = context.measureText(testLine);
    const testWidth = metrics.width;
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, currentY);
      line = words[n];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  context.fillText(line, x, currentY);
};

const FoodWebGraph = ({ 
  currentInsect, 
  allInsects, 
  hostPlantsMap,
  width, 
  height 
}) => {
  const navigate = useNavigate();
  const fgRef = useRef();
  // Use dark mode detection (simple version, can be improved with context)
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // --- Data Processing ---
  const graphData = useMemo(() => {
    if (!currentInsect || !hostPlantsMap) return { nodes: [], links: [] };

    const nodes = new Map();
    const links = [];

    // 1. Central Node (Current Insect)
    const centerId = `insect:${currentInsect.name}`;
    nodes.set(centerId, {
      id: centerId,
      name: currentInsect.name,
      type: 'current-insect',
      group: 0,
      val: 20, // Size
      img: currentInsect.image, // Pass if available
      raw: currentInsect
    });

    // Helper to add insect node
    const addInsectNode = (name, group = 2) => {
      const id = `insect:${name}`;
      if (!nodes.has(id)) {
        // Try to find insect details in allInsects
        const detail = allInsects.find(i => i.name === name);
        nodes.set(id, {
          id,
          name,
          type: 'insect',
          group,
          val: 10,
          raw: detail
        });
      }
      return id;
    };

    // Helper to add plant node
    const addPlantNode = (name) => {
      const id = `plant:${name}`;
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          name,
          type: 'plant',
          group: 1,
          val: 15
        });
      }
      return id;
    };

    // 2. Host Plants (Level 1)
    // Extract plant names from current insect
    let plants = [];
    if (Array.isArray(currentInsect.hostPlants)) {
      plants = currentInsect.hostPlants;
    } else if (typeof currentInsect.hostPlants === 'string') {
      plants = currentInsect.hostPlants.split(/[、，,]/).map(s => s.trim());
    }
    
    // Filter out invalid plant names
    plants = plants.filter(p => p && p !== '不明' && p !== 'undefined');

    plants.forEach(plantName => {
      const plantId = addPlantNode(plantName);
      links.push({ source: centerId, target: plantId, value: 3 });

      // 3. Related Insects (Level 2)
      const relatedInsectNames = hostPlantsMap[plantName] || [];
      
      // Filter and Score related insects to avoid hairball
      // Scoring criteria:
      // - Same Family as current insect: +10
      // - Same Order (roughly): +5 (Moth/Butterfly vs Beetle)
      // - Limit total count per plant
      
      const scoredInsects = relatedInsectNames
        .filter(name => name !== currentInsect.name) // Exclude self
        .map(name => {
          const detail = allInsects.find(i => i.name === name);
          let score = 1;
          if (detail) {
            // Check family match
            if (currentInsect.classification?.family && detail.classification?.family === currentInsect.classification.family) {
              score += 10;
            }
            // Check type match (moth/butterfly vs beetle)
            if (currentInsect.type === detail.type) {
              score += 5;
            }
          }
          return { name, score, detail };
        })
        .sort((a, b) => b.score - a.score);

      // Take top N related insects per plant
      const TOP_N = 5;
      scoredInsects.slice(0, TOP_N).forEach(item => {
        const insectId = addInsectNode(item.name);
        links.push({ source: plantId, target: insectId, value: 1 });
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      links
    };
  }, [currentInsect, allInsects, hostPlantsMap]);

  // --- Interaction Handlers ---
  const handleNodeClick = useCallback(node => {
    if (node.type === 'insect' && node.raw) {
      // Navigate to insect detail
      const type = node.raw.type || 'moth';
      // Use slug if available (not implemented fully in raw yet, fallback to ID)
      const targetId = node.raw.id;
      navigate(`/${type}/${targetId}`);
    } else if (node.type === 'plant') {
      // Navigate to plant detail
      navigate(`/plant/${encodeURIComponent(node.name)}`);
    } else if (node.type === 'current-insect') {
      // Center view
      fgRef.current.centerAt(node.x, node.y, 1000);
      fgRef.current.zoom(2, 2000);
    }
  }, [navigate]);

  // --- Custom Rendering ---
  const nodeCanvasObject = useCallback((node, ctx, globalScale) => {
    const label = node.name;
    const fontSize = 12 / globalScale;
    ctx.font = `${fontSize}px Sans-Serif`;
    const textWidth = ctx.measureText(label).width;
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

    // Circle style
    let fillStyle;
    if (node.type === 'current-insect') fillStyle = '#ef4444'; // Red-500
    else if (node.type === 'insect') fillStyle = '#3b82f6'; // Blue-500
    else if (node.type === 'plant') fillStyle = '#10b981'; // Emerald-500
    else fillStyle = '#6b7280'; // Gray

    // Draw Node Circle
    ctx.beginPath();
    const r = node.type === 'current-insect' ? 8 : node.type === 'plant' ? 5 : 3; 
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    
    // Node border
    ctx.lineWidth = 1 / globalScale;
    ctx.strokeStyle = isDarkMode ? '#1f2937' : '#ffffff';
    ctx.stroke();

    // Draw Label (only if zoomed in or important node)
    if (globalScale > 1.5 || node.type === 'current-insect' || node.type === 'plant') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = isDarkMode ? '#e5e7eb' : '#374151';
      
      // Offset text below node
      const yOffset = r + fontSize;
      ctx.fillText(label, node.x, node.y + yOffset);
    }
  }, [isDarkMode]);

  return (
    <div className="w-full h-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 relative">
      <ForceGraph2D
        ref={fgRef}
        width={width}
        height={height}
        graphData={graphData}
        nodeLabel="name"
        nodeCanvasObject={nodeCanvasObject}
        onNodeClick={handleNodeClick}
        linkDirectionalParticles={2}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleSpeed={0.005}
        backgroundColor={isDarkMode ? "#0f172a" : "#f8fafc"} // Slate-900 / Slate-50
        d3VelocityDecay={0.3}
        cooldownTicks={100}
        onEngineStop={() => fgRef.current.zoomToFit(400, 50)}
      />
      
      {/* Legend / Controls overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 text-xs">
        <div className="flex items-center mb-1">
          <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
          <span className="text-slate-700 dark:text-slate-200">現在の昆虫</span>
        </div>
        <div className="flex items-center mb-1">
          <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span>
          <span className="text-slate-700 dark:text-slate-200">食草</span>
        </div>
        <div className="flex items-center">
          <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
          <span className="text-slate-700 dark:text-slate-200">関連する他の昆虫</span>
        </div>
      </div>
    </div>
  );
};

export default FoodWebGraph;
