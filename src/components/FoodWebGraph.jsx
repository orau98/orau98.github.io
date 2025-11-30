import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';

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
  allInsects, 
  hostPlantsMap,
  width, 
  height 
}) => {
  const navigate = useNavigate();
  const fgRef = useRef();
  // Use dark mode detection (simple version, can be improved with context)
  const isBrowser = typeof document !== 'undefined';
  const isDarkMode = isBrowser && document.documentElement.classList.contains('dark');
  
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
      val: 30, // Size increased
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
          val: 12,
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
          val: 18
        });
      }
      return id;
    };

    // 2. Host Plants (Level 1)
    // Extract plant names from current insect
    let plants = [];
    if (Array.isArray(currentInsect.hostPlantsDetailed) && currentInsect.hostPlantsDetailed.length > 0) {
        // Use detailed info if available
        plants = currentInsect.hostPlantsDetailed.map(p => p.plant || p.name);
    } else if (Array.isArray(currentInsect.hostPlants)) {
      plants = currentInsect.hostPlants;
    } else if (typeof currentInsect.hostPlants === 'string') {
      plants = currentInsect.hostPlants.split(/[、，,]/).map(s => s.trim());
    }
    
    // Filter out invalid plant names
    plants = plants.filter(p => p && p !== '不明' && p !== 'undefined');

    plants.forEach(plantName => {
      const plantId = addPlantNode(plantName);
      links.push({ source: centerId, target: plantId, value: 3, color: isDarkMode ? '#34d399' : '#10b981' }); // Emerald link

      // 3. Related Insects (Level 2)
      const normalizedPlantName = normalizePlantName(plantName);
      
      // Lookup in hostPlantsMap - try exact, normalized, and fuzzy
      let relatedInsectNames = hostPlantsMap[plantName] || 
                               hostPlantsMap[normalizedPlantName] || [];
                               
      // If still empty, try to find keys that contain the normalized name
      if (!relatedInsectNames || relatedInsectNames.length === 0) {
         const potentialKeys = Object.keys(hostPlantsMap).filter(k => k.includes(normalizedPlantName) || normalizedPlantName.includes(k));
         potentialKeys.forEach(k => {
             relatedInsectNames = [...relatedInsectNames, ...hostPlantsMap[k]];
         });
         // Deduplicate
         relatedInsectNames = [...new Set(relatedInsectNames)];
      }
      
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
      const TOP_N = 8; // Increased slightly
      scoredInsects.slice(0, TOP_N).forEach(item => {
        const insectId = addInsectNode(item.name);
        links.push({ source: plantId, target: insectId, value: 1, color: isDarkMode ? '#60a5fa' : '#3b82f6' }); // Blue link
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      links
    };
  }, [currentInsect, allInsects, hostPlantsMap, isDarkMode]);

  // --- Interaction Handlers ---
  const handleNodeClick = useCallback(node => {
    if (node.type === 'insect' && node.raw) {
      // Navigate to insect detail
      const type = node.raw.type || 'moth';
      const targetId = node.raw.id;
      navigate(`/${type}/${targetId}`);
    } else if (node.type === 'plant') {
      // Navigate to plant detail
      navigate(`/plant/${encodeURIComponent(node.name)}`);
    } else if (node.type === 'current-insect') {
      // Center view
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
    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4); // padding

    // Palette (Modern Tailwind Colors)
    // Current Insect: Rose-500 (#f43f5e)
    // Plant: Emerald-500 (#10b981)
    // Other Insect: Sky-500 (#0ea5e9)
    
    let fillStyle;
    let strokeStyle;
    let glowColor;
    
    if (node.type === 'current-insect') {
        fillStyle = '#f43f5e'; 
        strokeStyle = '#ffe4e6'; 
        glowColor = 'rgba(244, 63, 94, 0.4)';
    } else if (node.type === 'plant') {
        fillStyle = '#10b981'; 
        strokeStyle = '#d1fae5';
        glowColor = 'rgba(16, 185, 129, 0.4)';
    } else {
        fillStyle = '#0ea5e9'; 
        strokeStyle = '#e0f2fe';
        glowColor = 'rgba(14, 165, 233, 0.4)';
    }

    // Draw Shadow/Glow
    if (globalScale < 1.5) { // Optimization: only draw glow when not zoomed in too close? Or always?
       // Actually, canvas shadows are expensive. Let's simulate with a larger transparent circle.
       ctx.beginPath();
       ctx.arc(node.x, node.y, node.val * 1.2, 0, 2 * Math.PI, false);
       ctx.fillStyle = glowColor;
       ctx.fill();
    }

    // Draw Node Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    
    // Node border
    ctx.lineWidth = 2 / globalScale;
    ctx.strokeStyle = isDarkMode ? '#1e293b' : '#ffffff'; // Dark/Light background contrast
    ctx.stroke();

    // Draw Label
    // Show labels for important nodes or on zoom
    const showLabel = globalScale > 1.2 || node.type === 'current-insect' || node.type === 'plant';
    
    if (showLabel) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const yOffset = node.val + fontSize + 2;
      
      // Label Background (Rounded Rect)
      ctx.fillStyle = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'rgba(255, 255, 255, 0.85)';
      // Simple rect for background
      const bgX = node.x - bckgDimensions[0] / 2;
      const bgY = node.y + yOffset - bckgDimensions[1] / 2;
      
      // Draw rounded rect manual or just rect
      ctx.fillRect(bgX, bgY, bckgDimensions[0], bckgDimensions[1]);
      
      // Text
      ctx.fillStyle = isDarkMode ? '#e2e8f0' : '#1e293b';
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
        linkDirectionalParticleWidth={3}
        linkDirectionalParticleSpeed={0.005}
        linkColor={link => link.color || '#cbd5e1'}
        backgroundColor={isDarkMode ? "#0f172a" : "#f8fafc"} // Slate-900 / Slate-50
        d3VelocityDecay={0.4} // Higher decay for less bouncy
        cooldownTicks={150}
        onEngineStop={() => fgRef.current.zoomToFit(400, 50)}
      />
      
      {/* Legend / Controls overlay */}
      <div className="absolute bottom-4 right-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 text-xs z-10">
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
      </div>
    </div>
  );
};

export default FoodWebGraph;
