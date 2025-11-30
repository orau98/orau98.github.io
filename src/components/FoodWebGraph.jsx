import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';
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
  allInsects,
  hostPlantsMap,
  width,
  height,
  imageExtensions = {}
}) => {
  const navigate = useNavigate();
  const fgRef = useRef();
  // Use dark mode detection (simple version, can be improved with context)
  const isBrowser = typeof document !== 'undefined';
  const isDarkMode = isBrowser && document.documentElement.classList.contains('dark');
  const [images, setImages] = useState({}); // Store loaded images

  // Helper to resolve image URL
  const resolveImageUrl = useCallback((insectName, scientificName) => {
    // Try multiple candidates similar to MothDetail logic
    const candidates = [
      scientificName ? createSafeInsectFilename(scientificName) : null,
      createSafeInsectFilename(insectName),
      insectName
    ].filter(Boolean);

    for (const cand of candidates) {
      if (imageExtensions[cand]) {
        return `${import.meta.env.BASE_URL}images/insects/${encodeURIComponent(cand)}${imageExtensions[cand]}`;
      }
    }
    return null;
  }, [imageExtensions]);
  
  // --- Data Processing ---
  const graphData = useMemo(() => {
    if (!currentInsect || !hostPlantsMap) return { nodes: [], links: [] };

    const nodes = new Map();
    const links = [];

    // 1. Central Node (Current Insect)
    const centerId = `insect:${currentInsect.name}`;
    const centerImgUrl = resolveImageUrl(currentInsect.name, currentInsect.scientificName);
    
    nodes.set(centerId, {
      id: centerId,
      name: currentInsect.name,
      type: 'current-insect',
      group: 0,
      val: 30, // Size increased
      imgUrl: centerImgUrl,
      raw: currentInsect
    });

    // Helper to add insect node
    const addInsectNode = (name, group = 2) => {
      const id = `insect:${name}`;
      if (!nodes.has(id)) {
        // Try to find insect details in allInsects
        const detail = allInsects.find(i => i.name === name);
        const imgUrl = detail ? resolveImageUrl(detail.name, detail.scientificName) : null;
        
        nodes.set(id, {
          id,
          name,
          type: 'insect',
          group,
          val: 12,
          raw: detail,
          imgUrl
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
  }, [currentInsect, allInsects, hostPlantsMap, isDarkMode, resolveImageUrl]);

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

    // Image Drawing Logic
    if (node.imgUrl) {
      const img = images[node.imgUrl];
      if (img) {
        // Clip circular region
        ctx.save();
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
        ctx.clip();
        
        try {
          ctx.drawImage(img, node.x - node.val, node.y - node.val, node.val * 2, node.val * 2);
        } catch (e) {
          // fallback to fill if error
          ctx.fillStyle = fillStyle;
          ctx.fill();
        }
        ctx.restore();
        
        // Draw border ring over image
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
        ctx.lineWidth = 2 / globalScale;
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();
      } else {
        // Image not loaded yet, draw placeholder and load
        const newImg = new Image();
        newImg.src = node.imgUrl;
        newImg.onload = () => {
          setImages(prev => ({ ...prev, [node.imgUrl]: newImg }));
        };
        
        // Draw standard circle while loading
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
        ctx.fillStyle = fillStyle;
        ctx.fill();
        ctx.lineWidth = 2 / globalScale;
        ctx.strokeStyle = strokeStyle;
        ctx.stroke();
      }
    } else {
      // No image available - Draw Standard Node Circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.val, 0, 2 * Math.PI, false);
      ctx.fillStyle = fillStyle;
      ctx.fill();
      
      // Node border
      ctx.lineWidth = 2 / globalScale;
      ctx.strokeStyle = isDarkMode ? '#1e293b' : '#ffffff'; // Dark/Light background contrast
      ctx.stroke();
    }

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
  }, [isDarkMode, images]);
