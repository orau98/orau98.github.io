import { isFlowerVisitRecord } from '../utils/flowerVisitPlants.js';
import React, { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import ForceGraph2D from 'react-force-graph-2d';
import useInsectImageIndex from '../hooks/useInsectImageIndex';
import usePlantImageFilenames from '../hooks/usePlantImageFilenames';
import { createSafeScientificPlantFilename } from '../utils/filename';
import { buildResizedImageUrl } from '../utils/imageSrcset';
import { getAssetBase, getAssetVersionQuery } from '../utils/assetPaths';
import { globalJapaneseToScientificMapping } from '../utils/insectImageMappings';
import {
  buildInsectImageBaseCandidates,
  resolveImageBaseCandidates,
} from '../utils/insectImageResolver';
import { buildInsectPath } from '../utils/insectSlug';
import { makeDetailLinkState } from '../utils/navState';
import { isNonPlantResourceName, isPlantHostRecord } from '../utils/hostResource';
import { isEnglishLocale } from '../utils/locale';
import { buildPlantPath } from '../utils/siteTaxonomy';
import InfoPopover from './InfoPopover';
import ImageWithFallback from './ImageWithFallback';
import ImageModal from './ImageModal';
import { networkGroup, groupNetwork, searchNetworkNodes, fitNetworkBounds, NETWORK_PHOTO_SIZES, networkNodeRadius, containNetworkImage, networkPreviewCandidates } from '../utils/networkView.js';

// ネットワーク図: 画像がある種はサムネで表示。画像が無い場合は従来の円にフォールバック。
// 依存の fetch 失敗や画像読み込み失敗があっても必ず描画が続くように防御的に実装。

const RELATION_FILTERS = [
  { value: 'all', label: 'すべて', labelEn: 'All', shortLabel: '全て', shortLabelEn: 'All', helper: '全ての関係を表示', helperEn: 'Show all relationships' },
  { value: 'host', label: '食草を含む', labelEn: 'Incl. host', shortLabel: '食草', shortLabelEn: 'Host', helper: '食草の関係を表示（食草＋訪花を含む）', helperEn: 'Show host-plant relationships (includes host + flower visits)' },
  { value: 'flower', label: '訪花を含む', labelEn: 'Incl. flower', shortLabel: '訪花', shortLabelEn: 'Flower', helper: '訪花の関係を表示（食草＋訪花を含む）', helperEn: 'Show flower-visit relationships (includes host + flower visits)' },
  { value: 'both', label: '両方のみ', labelEn: 'Both only', shortLabel: '両方', shortLabelEn: 'Both', helper: '食草と訪花の両方がある関係のみ表示', helperEn: 'Show only relationships with both host and flower visits' }
];
const getRadialPoint = (index, total, radius, angleOffset = -Math.PI / 2) => {
  const count = Math.max(total, 1);
  const angle = angleOffset + (index / count) * Math.PI * 2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
};

// 密なグラフでラベル同士の重なりを抑えるための短縮表示（全文はズーム・選択・ホバーで見える）
const truncateNodeLabel = (name = '', maxChars = 8) => {
  const text = String(name);
  if (text.length <= maxChars + 1) return text;
  return `${text.slice(0, maxChars)}…`;
};

// 中心からのリンク距離を複数リングに振り分けるためのパラメータ。
// 全ノードが同一距離だと1本のリング上に密集して写真・ラベルが重なるため、
// ノード数に応じて2〜3本の同心リングへ交互配置し、隣接ノードの半径をずらす。
// 内側リングも「1ノードあたりに必要な弧長×ノード数」が円周に収まるよう自動拡大する。
const computeRingLayout = (count, baseDistance, { arcSpacing, ringGap }) => {
  const tierCount = count <= 14 ? 1 : count <= 32 ? 2 : 3;
  const perTier = Math.ceil(Math.max(count, 1) / tierCount);
  const innerDistance = Math.max(baseDistance, (perTier * arcSpacing) / (2 * Math.PI));
  return {
    tierCount,
    distanceFor: (index) => innerDistance + (index % tierCount) * ringGap
  };
};

// ノード（写真サムネ）同士が重ならない最小距離を保つ簡易衝突力。
// d3-force の forceCollide 相当だが、依存を増やさないため自前実装
// （ノード数は高々100程度なので総当たりで十分軽い）。
const createCollideForce = (getRadius, { strength = 0.5, iterations = 2 } = {}) => {
  let nodes = [];
  const force = () => {
    for (let k = 0; k < iterations; k += 1) {
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        const ra = getRadius(a);
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const minDist = ra + getRadius(b);
          let dx = (b.x + (b.vx || 0)) - (a.x + (a.vx || 0));
          let dy = (b.y + (b.vy || 0)) - (a.y + (a.vy || 0));
          const distSq = dx * dx + dy * dy;
          if (distSq >= minDist * minDist) continue;
          let dist = Math.sqrt(distSq);
          if (dist === 0) {
            // 完全に同座標の場合は決定的な方向へずらす（乱数は使わない）
            dx = (j - i) % 2 === 0 ? 0.5 : -0.5;
            dy = 0.5;
            dist = Math.sqrt(dx * dx + dy * dy);
          }
          const push = ((minDist - dist) / dist) * strength * 0.5;
          const ox = dx * push;
          const oy = dy * push;
          b.vx = (b.vx || 0) + ox;
          b.vy = (b.vy || 0) + oy;
          a.vx = (a.vx || 0) - ox;
          a.vy = (a.vy || 0) - oy;
        }
      }
    }
  };
  force.initialize = (initNodes) => {
    nodes = Array.isArray(initNodes) ? initNodes : [];
  };
  return force;
};

const seedGraphNodePositions = ({
  nodes,
  centerNodeId,
  currentPlantName,
  width,
  height,
  isCompactPanel
}) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return;

  const centerNode = centerNodeId ? nodes.find((node) => node.id === centerNodeId) : null;
  if (centerNode) {
    centerNode.x = 0;
    centerNode.y = 0;
    centerNode.vx = 0;
    centerNode.vy = 0;
  }

  const viewport = Math.max(300, Math.min(width || 720, height || 520));

  if (currentPlantName) {
    const insects = nodes.filter((node) => node.id !== centerNodeId && node.type.startsWith('insect'));
    const ringRadius = Math.max(
      isCompactPanel ? 96 : 168,
      Math.min(viewport * (isCompactPanel ? 0.36 : 0.46), isCompactPanel ? 140 : 250)
    );
    insects.forEach((node, index) => {
      // 複数リング配置ではノードごとの目標半径（radialDistance）で初期配置し、
      // シミュレーション後のリンク距離と一致させて初期の重なり・暴れを抑える
      const point = getRadialPoint(index, insects.length, node.radialDistance || ringRadius);
      node.x = point.x;
      node.y = point.y;
    });
    return;
  }

  const plants = nodes.filter((node) => node.id !== centerNodeId && node.type.startsWith('plant'));
  const insects = nodes.filter((node) => node.id !== centerNodeId && node.type.startsWith('insect'));
  const primaryRadius = Math.max(
    isCompactPanel ? 94 : 148,
    Math.min(viewport * (isCompactPanel ? 0.32 : 0.4), isCompactPanel ? 132 : 215)
  );
  const outerRadius = Math.max(
    primaryRadius + (isCompactPanel ? 66 : 96),
    Math.min(viewport * (isCompactPanel ? 0.55 : 0.72), isCompactPanel ? 196 : 330)
  );

  plants.forEach((node, index) => {
    const point = getRadialPoint(index, plants.length, node.radialDistance || primaryRadius);
    node.x = point.x;
    node.y = point.y;
  });

  insects.forEach((node, index) => {
    const point = getRadialPoint(
      index,
      insects.length,
      outerRadius,
      -Math.PI / 2 + Math.PI / Math.max(insects.length, 2)
    );
    node.x = point.x;
    node.y = point.y;
  });
};

const normalizePlantName = (name = '') =>
  name
    .replace(/（[^）]*）/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/の(花|実|葉|枝|茎|根|蕾).*/, '')
    .trim();



const isGraphPlantRecord = (record, rawName = '') =>
  isPlantHostRecord(record) && !isNonPlantResourceName(rawName);

const getRelationType = (hasHost, hasFlowerVisit) => {
  if (hasHost && hasFlowerVisit) return 'both';
  if (hasFlowerVisit) return 'flower';
  if (hasHost) return 'host';
  return 'unknown';
};

const RELATION_STYLES = {
  host: {
    color: 'rgba(16,185,129,0.78)',
    dimColor: 'rgba(16,185,129,0.22)',
    activeColor: 'rgba(5,150,105,0.98)',
    dash: [],
    width: 1.35,
    label: '食草・寄主植物の関係',
    labelEn: 'Host plant relationship',
    legendClass: 'border-emerald-500'
  },
  flower: {
    color: 'rgba(245,158,11,0.78)',
    dimColor: 'rgba(245,158,11,0.24)',
    activeColor: 'rgba(217,119,6,0.98)',
    dash: [6, 4],
    width: 1.35,
    label: '訪花の関係',
    labelEn: 'Flower visit relationship',
    legendClass: 'border-amber-500'
  },
  both: {
    color: 'rgba(139,92,246,0.82)',
    dimColor: 'rgba(139,92,246,0.24)',
    activeColor: 'rgba(124,58,237,0.98)',
    dash: [2, 3],
    width: 1.55,
    label: '食草＋訪花の関係',
    labelEn: 'Host plant + flower visit relationship',
    legendClass: 'border-violet-500'
  },
  unknown: {
    color: 'rgba(148,163,184,0.65)',
    dimColor: 'rgba(148,163,184,0.22)',
    activeColor: 'rgba(56,189,248,0.95)',
    dash: [],
    width: 1.2,
    label: '関係',
    labelEn: 'Relationship',
    legendClass: 'border-slate-400'
  }
};

const FoodWebGraph = React.memo(function FoodWebGraph({
  currentInsect,
  currentPlantName,
  plantInsects,
  allInsects,
  plantDetails = {},
  hostPlantsMap,
  flowerVisitPlants,
  theme,
  locale = 'ja',
  width = 720,
  height = 520
}) {
  const fgRef = useRef(null);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isDark = theme === 'dark';
  const isEnglish = isEnglishLocale(locale);
  const [isCompactPanel, setIsCompactPanel] = useState(false);
  const [desktopControlsOpen, setDesktopControlsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [photoSize, setPhotoSize] = useState('large');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [groupMode, setGroupMode] = useState('auto');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const searchInputRef = useRef(null);
  const selectionPanelRef = useRef(null);
  const listButtonRef = useRef(null);
  const pendingKeyboardFocusRef = useRef(false);
  const pendingNodeFocusRef = useRef(false);
  const labelBoxesRef = useRef([]);
  const labelMeasureContextRef = useRef(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // OSの「視差効果を減らす」設定を尊重してリンク粒子アニメーションを止める
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // プログラム由来のズームイベントを無視するための期限（エポックms）。
  // force-graphはzoomToFit等の自動ズームに加え、キャンバスのリサイズ時にも内部で
  // translateBy（＝zoomイベント発火）を行うため、これがないと初期フィットが
  // 「ユーザー操作」と誤認されて無効化され、ガイド表示も出ないまま消える。
  // 初期値はマウント直後のキャンバス初期化イベントをカバーする
  const programmaticZoomUntilRef = useRef(Date.now() + 1500);

  // モバイルレスポンシブ: コンテナ幅を監視してグラフサイズを動的に決定
  const [graphSize, setGraphSize] = useState(() => ({ width, height }));
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const updateSize = (containerWidth, containerHeight) => {
      if (containerWidth <= 0) return;
      // サイズ変更に伴うforce-graph内部のズーム調整はユーザー操作ではない。
      // 子コンポーネントのエフェクトが親より先に走るため、ここで期限を先に延ばす
      programmaticZoomUntilRef.current = Math.max(programmaticZoomUntilRef.current, Date.now() + 800);
      // モバイルも実測の高さでキャンバスを埋める。
      // 以前は400px固定で、外側の固定高ラッパー(560px)との差分が
      // 空白になり、グラフ下部が途切れて見えていた
      const next = {
        width: Math.max(1, Math.floor(containerWidth)),
        height: isCompactPanel
          ? Math.max(1, Math.floor(containerHeight || height))
          : Math.max(1, Math.floor(containerHeight || height))
      };
      setGraphSize((prev) => (
        prev.width === next.width && prev.height === next.height
          ? prev
          : next
      ));
    };
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) updateSize(entry.contentRect.width, entry.contentRect.height);
    });
    ro.observe(el);
    const rect = el.getBoundingClientRect();
    updateSize(rect.width, rect.height);
    return () => ro.disconnect();
  }, [height, isCompactPanel]);

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
        if (!isGraphPlantRecord(record, raw)) return false;
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
        if (!isGraphPlantRecord(record, rawPlant)) return;
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
        if (!isGraphPlantRecord(record, raw)) return false;
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
        if (!isGraphPlantRecord(p, raw)) continue;
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

  // image index caches（共有フック経由・再マウント時は同期初期化）
  const {
    imageNames: imageBaseSet,
    imageExtensions: imageExtMap,
    normalizedEntries: normalizedImageEntries,
  } = useInsectImageIndex();
  const plantImageNames = usePlantImageFilenames();

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
  const guideDismissFrameRef = useRef(null);
  const [hoverNodeId, setHoverNodeId] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [labelMode, setLabelMode] = useState('auto'); // auto | all | none
  const [relationFilter, setRelationFilter] = useState('all');
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [nodeListOpen, setNodeListOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useState(false);
  const [pinVersion, setPinVersion] = useState(0);
  const [isPinDragging, setIsPinDragging] = useState(false);
  // PCでのホイールズームはクリックで有効化する（ページスクロールを奪わないため）。
  // マウスがグラフ外へ出たら自動的に無効へ戻す
  const [desktopZoomActive, setDesktopZoomActive] = useState(false);
  const showRelatedInsects = true;
  // 中心からの基準リンク距離（最内リングの半径）。ノード数が多い場合は
  // computeRingLayout がこの値を基準に複数リングへ距離を割り振る
  const linkDistance = useMemo(() => {
    if (currentPlantName) {
      return isCompactPanel ? 66 : 100;
    }
    return isCompactPanel ? 58 : 86;
  }, [currentPlantName, isCompactPanel]);

  const [ylistData, setYlistData] = useState(null);

  const assetBase = getAssetBase();
  const cacheBust = getAssetVersionQuery();

  useEffect(() => {
    hasUserInteractedRef.current = false;
  }, [currentInsect?.name, currentPlantName]);

  useEffect(() => {
    if (guideDismissFrameRef.current !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(guideDismissFrameRef.current);
      guideDismissFrameRef.current = null;
    }
    setGuideDismissed(false);
  }, [currentInsect?.name, currentPlantName]);

  useEffect(() => () => {
    if (guideDismissFrameRef.current !== null && typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(guideDismissFrameRef.current);
      guideDismissFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    setRelationFilter('all');
    setSearchQuery('');
    setPhotoPreview(null);
    setGroupMode('auto');
    setExpandedGroups(new Set());
    setSelectedNodeId(null);
    setNodeListOpen(false);
    setIsPinDragging(false);
    setDesktopControlsOpen(false);

  }, [currentInsect?.name, currentPlantName]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 899px)');
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
    setPanelCollapsed(false);
  }, [selectedNodeId]);

  // 画像インデックスの読み込みは useInsectImageIndex / usePlantImageFilenames が担う

  const insectImageCandidates = useCallback((detail) => {
    if (!detail) return [];
    if (detail.image) {
      const rawUrl = String(detail.image);
      const match = rawUrl.match(/\/images\/insects\/([^/?#]+?)(?:\.[^.\/?#]+)(?:\?.*)?$/i);
      if (match) {
        const base = decodeURIComponent(match[1]);
        return [
          buildResizedImageUrl({ baseUrl: assetBase, folder: 'insects', filename: base, width: 640, query: cacheBust }),
          buildResizedImageUrl({ baseUrl: assetBase, folder: 'insects', filename: base, width: 320, query: cacheBust }),
          rawUrl,
        ];
      }
      return [detail.image];
    }

    const mappedFilename = globalJapaneseToScientificMapping.get(detail.name);
    const candidates = buildInsectImageBaseCandidates(detail, mappedFilename);
    const resolvedBases = resolveImageBaseCandidates(candidates, {
      imageExtensions: imageExtMap,
      imageNames: imageBaseSet,
      normalizedEntries: normalizedImageEntries,
      includeUnresolved: false,
    });

    const urls = [];
    for (const base of resolvedBases) {
      urls.push(buildResizedImageUrl({ baseUrl: assetBase, folder: 'insects', filename: base, width: 320, query: cacheBust }));
      urls.push(buildResizedImageUrl({ baseUrl: assetBase, folder: 'insects', filename: base, width: 640, query: cacheBust }));
      urls.push(buildResizedImageUrl({ baseUrl: assetBase, folder: 'insects', filename: base, width: 1024, query: cacheBust }));
      const sourceExtension = imageExtMap[base];
      if (typeof sourceExtension === 'string' && /^\.(?:jpe?g|png|webp|avif)$/i.test(sourceExtension)) {
        urls.push(`${assetBase}images/insects/${encodeURIComponent(base)}${sourceExtension}${cacheBust}`);
      }
    }
    return urls;
  }, [assetBase, cacheBust, imageBaseSet, imageExtMap, normalizedImageEntries]);

  const plantScientificBaseMap = useMemo(() => {
    const map = new Map();
    Object.entries(plantDetails || {}).forEach(([name, detail]) => {
      const scientificBase = createSafeScientificPlantFilename(detail?.scientificName || '');
      if (!scientificBase) return;

      const aliasesRaw = detail?.aliases || detail?.aliasNames;
      const aliases = Array.isArray(aliasesRaw)
        ? aliasesRaw
        : aliasesRaw instanceof Set
          ? Array.from(aliasesRaw)
          : [];

      [name, normalizePlantName(name), ...aliases, ...aliases.map((alias) => normalizePlantName(alias))]
        .filter(Boolean)
        .forEach((key) => {
          if (!map.has(key)) {
            map.set(key, scientificBase);
          }
        });
    });
    return map;
  }, [plantDetails]);

  const plantImageCandidates = useCallback((plantName) => {
    if (!plantName || plantImageNames.length === 0) return [];
    const norm = normalizePlantName(plantName);
    const scientificBase =
      plantScientificBaseMap.get(plantName) ||
      plantScientificBaseMap.get(norm) ||
      null;
    const variants = [
      plantName,
      norm,
      plantName.replace(/＿/g, '_'),
      norm.replace(/＿/g, '_'),
      scientificBase,
    ].filter(Boolean);

    const hits = plantImageNames.filter(n => variants.some(v => v && n.startsWith(v)));
    if (hits.length === 0) return [];
    const urls = [];
    hits.slice(0, 2).forEach(base => {
      urls.push(`${assetBase}images/resized/plants/${encodeURIComponent(base)}.1024.jpg${cacheBust}`);
      urls.push(`${assetBase}images/resized/plants/${encodeURIComponent(base)}.640.jpg${cacheBust}`);
      urls.push(`${assetBase}images/plants/${encodeURIComponent(base)}.jpg${cacheBust}`);
    });
    return urls;
  }, [assetBase, cacheBust, plantImageNames, plantScientificBaseMap]);

  const currentCenterNodeId = currentPlantName
    ? `plant:${currentPlantName}`
    : currentInsect?.name
      ? `insect:${currentInsect.name}`
      : null;

  // graph data with image candidates embedded
  const baseGraphData = useMemo(() => {
    const nodes = [];
    const links = [];
    const summary = {
      primaryLabel: isEnglish
        ? (currentPlantName ? 'Insects' : currentInsect ? 'Plants' : 'Related')
        : (currentPlantName ? '昆虫' : currentInsect ? '植物' : '関連'),
      primaryShown: 0,
      primaryTotal: 0,
      limit: Number.POSITIVE_INFINITY
    };
    if (!hostPlantsMap || (!currentInsect && !currentPlantName)) return { nodes, links, summary };

    const addNode = (id, name, type, raw, extra) => {
      if (!nodes.find(n => n.id === id)) {
        const imgCandidates = type.includes('plant')
          ? plantImageCandidates(name)
          : insectImageCandidates(raw || { name });
        nodes.push({ id, name, type, raw, imgCandidates, ...(extra || {}) });
      }
    };

    const relatedLimitSafe = summary.limit;

    if (currentPlantName) {
      const centerId = `plant:${currentPlantName}`;
      addNode(centerId, currentPlantName, 'plant-current', plantDetails[currentPlantName]);
      const allRelated = plantInsectMeta.orderedNames || [];
      const related = allRelated.slice(0, relatedLimitSafe);
      summary.primaryTotal = allRelated.length;
      summary.primaryShown = related.length;
      const ringLayout = computeRingLayout(related.length, linkDistance, {
        arcSpacing: isCompactPanel ? 30 : 36,
        ringGap: isCompactPanel ? 42 : 52
      });
      related.forEach((name, index) => {
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
        const distance = ringLayout.distanceFor(index);
        addNode(insectId, name, insectType, insectDetail, { radialDistance: distance });
        links.push({ source: centerId, target: insectId, relation: getRelationType(hasHost, hasFlower), distance });
      });
    } else if (currentInsect) {
      const centerId = `insect:${currentInsect.name}`;
      addNode(centerId, currentInsect.name, 'insect-current', currentInsect);

      const { plantOrder, hostSet, flowerSet } = getInsectPlantItems(currentInsect);
      const limitedPlants = (plantOrder || []).slice(0, relatedLimitSafe);
      summary.primaryTotal = (plantOrder || []).length;
      summary.primaryShown = limitedPlants.length;
      const relatedPerPlant = Math.max(4, Math.floor(relatedLimitSafe / Math.max(1, limitedPlants.length)));
      const plantRingLayout = computeRingLayout(limitedPlants.length, linkDistance, {
        arcSpacing: isCompactPanel ? 30 : 38,
        ringGap: isCompactPanel ? 38 : 52
      });
      // 関連昆虫は所属する植物の近くにまとまるよう、中心リンクより短めにする
      const relatedInsectDistance = Math.max(40, Math.round(linkDistance * 0.7));

      limitedPlants.forEach((plantName, plantIndex) => {
        const isHost = hostSet.has(plantName);
        const isFlower = flowerSet.has(plantName);
        const plantType = isHost && isFlower
          ? 'plant-both'
          : isFlower
            ? 'plant-flower'
            : 'plant-host';
        const plantId = `plant:${plantName}`;
        const plantDistance = plantRingLayout.distanceFor(plantIndex);
        addNode(plantId, plantName, plantType, plantDetails[plantName], { radialDistance: plantDistance });
        links.push({ source: centerId, target: plantId, relation: getRelationType(isHost, isFlower), distance: plantDistance });

        if (showRelatedInsects) {
          const related = getPlantInsects(plantName)
            .filter(n => n !== currentInsect.name)
            .filter((name) => {
              const insectDetail = insectLookup.get(name) || null;
              if (!insectDetail) return true;
              return hasLarvalHostForPlant(insectDetail, plantName)
                || hasFlowerVisitForPlant(insectDetail, plantName);
            });
          related.slice(0, relatedPerPlant).forEach(name => {
            const insectDetail = insectLookup.get(name) || null;
            const insectId = `insect:${name}`;
            addNode(insectId, name, 'insect', insectDetail);
            const relatedHasHost = insectDetail ? hasLarvalHostForPlant(insectDetail, plantName) : false;
            const relatedHasFlowerVisit = insectDetail ? hasFlowerVisitForPlant(insectDetail, plantName) : false;
            links.push({
              source: plantId,
              target: insectId,
              relation: getRelationType(relatedHasHost, relatedHasFlowerVisit),
              distance: relatedInsectDistance
            });
          });
        }
      });
    }

    seedGraphNodePositions({
      nodes,
      centerNodeId: currentCenterNodeId,
      currentPlantName,
      width,
      height,
      isCompactPanel
    });

    return { nodes, links, summary };
  }, [currentCenterNodeId, currentInsect, currentPlantName, getInsectPlantItems, getPlantInsects, hasFlowerVisitForPlant, hasLarvalHostForPlant, height, hostPlantsMap, insectImageCandidates, insectLookup, isCompactPanel, isEnglish, linkDistance, plantDetails, plantImageCandidates, plantInsectMeta, showRelatedInsects, width]);

  const relationStyleLabel = useCallback(
    (relation) => {
      const style = RELATION_STYLES[relation] || RELATION_STYLES.unknown;
      return isEnglish ? style.labelEn : style.label;
    },
    [isEnglish]
  );

  const relationMatchesFilter = useCallback((relation) => {
    if (relationFilter === 'all') return true;
    if (relationFilter === 'host') return relation === 'host' || relation === 'both';
    if (relationFilter === 'flower') return relation === 'flower' || relation === 'both';
    if (relationFilter === 'both') return relation === 'both';
    return true;
  }, [relationFilter]);

  const relationshipGraphData = useMemo(() => {
    if (relationFilter === 'all') return baseGraphData;

    const links = baseGraphData.links.filter((link) => relationMatchesFilter(link?.relation || 'unknown'));
    const keepIds = new Set();
    if (currentCenterNodeId) keepIds.add(currentCenterNodeId);
    links.forEach((link) => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sId) keepIds.add(sId);
      if (tId) keepIds.add(tId);
    });
    const nodes = baseGraphData.nodes.filter((node) => keepIds.has(node.id));
    return {
      nodes,
      links,
      summary: baseGraphData.summary
    };
  }, [baseGraphData, currentCenterNodeId, relationFilter, relationMatchesFilter]);

  const graphData = useMemo(() => groupNetwork(relationshipGraphData, {
    expanded: expandedGroups, enabled: groupMode === 'auto', isEnglish,
  }), [relationshipGraphData, expandedGroups, groupMode, isEnglish]);

  const collapsedGroups = graphData.groups.filter(group => !expandedGroups.has(group.id));

  const viewStats = useMemo(() => ({
    primaryLabel: baseGraphData.summary.primaryLabel,
    primaryShown: relationshipGraphData.nodes.filter(node => currentPlantName ? node.type.startsWith('insect') : node.type.startsWith('plant')).length,
    primaryTotal: baseGraphData.summary.primaryTotal,
    visibleNodes: relationshipGraphData.nodes.length,
    totalNodes: baseGraphData.nodes.length,
    visibleLinks: relationshipGraphData.links.length,
    totalLinks: baseGraphData.links.length
  }), [baseGraphData, relationshipGraphData, currentPlantName]);

  const graphLayoutMetrics = useMemo(() => {
    const nodeCount = graphData.nodes.length;
    return {
      chargeStrength: isCompactPanel ? -170 : nodeCount > 28 ? -250 : -220,
      denseLabelThreshold: isCompactPanel ? 12 : 16,
      focusZoom: isCompactPanel ? 1.85 : nodeCount > 28 ? 1.7 : 2,
      minimumZoom: 0.01
    };
  }, [graphData.nodes.length, isCompactPanel]);

  // 中心種と直接つながるノード（第一リング）。初期ズームの対象と、密なグラフでの
  // ラベル常時表示の対象を決めるのに使う
  const primaryNeighborIds = useMemo(() => {
    const ids = new Set();
    if (!currentCenterNodeId) return ids;
    ids.add(currentCenterNodeId);
    graphData.links.forEach((link) => {
      const sId = typeof link.source === 'object' ? link.source?.id : link.source;
      const tId = typeof link.target === 'object' ? link.target?.id : link.target;
      if (sId === currentCenterNodeId && tId) ids.add(tId);
      if (tId === currentCenterNodeId && sId) ids.add(sId);
    });
    return ids;
  }, [currentCenterNodeId, graphData.links]);

  // selection safety: clear when graph changes
  useEffect(() => {
    if (!selectedNodeId) return;
    if (relationshipGraphData.nodes.some(n => n.id === selectedNodeId)) return;
    setSelectedNodeId(null);
  }, [relationshipGraphData.nodes, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return relationshipGraphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [relationshipGraphData.nodes, selectedNodeId]);

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
    const degree = relationshipGraphData.links.reduce((acc, link) => {
      const sId = typeof link.source === 'object' ? link.source.id : link.source;
      const tId = typeof link.target === 'object' ? link.target.id : link.target;
      if (sId === selectedNode.id || tId === selectedNode.id) return acc + 1;
      return acc;
    }, 0);
    return { degree };
  }, [relationshipGraphData.links, selectedNode]);

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
        const insectDetail = insectLookup.get(name) || null;
        if (!insectDetail) return true;
        return hasLarvalHostForPlant(insectDetail, selectedNode.name)
          || hasFlowerVisitForPlant(insectDetail, selectedNode.name);
      });
  }, [getPlantInsects, selectedNode, insectLookup, hasLarvalHostForPlant, hasFlowerVisitForPlant]);

  const selectedPlantBadge = useMemo(() => {
    if (!selectedNode?.type?.startsWith('plant')) return null;
    if (selectedNode.type === 'plant-current') {
      return {
        label: isEnglish ? 'Plant' : '植物',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60'
      };
    }
    if (selectedNode.type === 'plant-flower') {
      return {
        label: isEnglish ? 'Flower-visit plant' : '訪花植物',
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60'
      };
    }
    if (selectedNode.type === 'plant-both') {
      return {
        label: isEnglish ? 'Host + flower' : '食草＋訪花',
        className: 'bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950/40 dark:text-lime-200 dark:border-lime-900/60'
      };
    }
    return {
      label: isEnglish ? 'Host plant' : '食草',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60'
    };
  }, [selectedNode, isEnglish]);

  const selectedInsectBadge = useMemo(() => {
    if (!selectedNode?.type?.startsWith('insect')) return null;
    if (selectedNode.type === 'insect-current') {
      return {
        label: isEnglish ? 'Current insect' : '現在の昆虫',
        className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/60'
      };
    }
    if (selectedNode.type === 'insect-flower') {
      return {
        label: isEnglish ? 'Flower-visit insect' : '訪花昆虫',
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60'
      };
    }
    if (selectedNode.type === 'insect-both') {
      return {
        label: isEnglish ? 'Host + flower' : '食草＋訪花',
        className: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900/60'
      };
    }
    if (selectedNode.type === 'insect-host') {
      return {
        label: isEnglish ? 'Host-plant insect' : '食草昆虫',
        className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60'
      };
    }
    return {
      label: isEnglish ? 'Insect' : '昆虫',
      className: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60'
    };
  }, [selectedNode, isEnglish]);

  const isNodePinned = useCallback((node) => !!node && (typeof node.fx === 'number' || typeof node.fy === 'number'), []);

  const pinNodeById = useCallback((nodeId) => {
    if (!nodeId) return;
    const node = baseGraphData.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    node.fx = typeof node.x === 'number' ? node.x : 0;
    node.fy = typeof node.y === 'number' ? node.y : 0;
    setPinVersion((prev) => prev + 1);
    try {
      fgRef.current?.d3ReheatSimulation();
      fgRef.current?.refresh();
    } catch {
      // ignore
    }
  }, [baseGraphData.nodes]);

  const unpinNodeById = useCallback((nodeId) => {
    if (!nodeId) return;
    const node = baseGraphData.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    node.fx = undefined;
    node.fy = undefined;
    setPinVersion((prev) => prev + 1);
    try {
      fgRef.current?.d3ReheatSimulation();
      fgRef.current?.refresh();
    } catch {
      // ignore
    }
  }, [baseGraphData.nodes]);

  const clearPinnedNodes = useCallback(() => {
    let changed = false;
    baseGraphData.nodes.forEach((node) => {
      if (!isNodePinned(node)) return;
      node.fx = undefined;
      node.fy = undefined;
      changed = true;
    });
    if (!changed) return;
    setPinVersion((prev) => prev + 1);
    try {
      fgRef.current?.d3ReheatSimulation();
      fgRef.current?.refresh();
    } catch {
      // ignore
    }
  }, [baseGraphData.nodes, isNodePinned]);

  const pinnedNodeCount = useMemo(
    () => {
      void pinVersion;
      return baseGraphData.nodes.reduce((count, node) => count + (isNodePinned(node) ? 1 : 0), 0);
    },
    [baseGraphData.nodes, isNodePinned, pinVersion]
  );

  const selectedNodePinned = useMemo(
    () => {
      void pinVersion;
      return selectedNode ? isNodePinned(selectedNode) : false;
    },
    [selectedNode, isNodePinned, pinVersion]
  );

  const nodeGroups = useMemo(() => {
    const sortNodes = (a, b) => (
      (a.type.includes('current') ? 0 : a.type.startsWith('plant') ? 1 : 2)
      - (b.type.includes('current') ? 0 : b.type.startsWith('plant') ? 1 : 2)
      || a.name.localeCompare(b.name, 'ja')
    );

    const current = [];
    const plants = [];
    const insects = [];

    searchNetworkNodes(relationshipGraphData.nodes, searchQuery)
      .sort(sortNodes)
      .forEach((node) => {
        if (node.type.includes('current')) {
          current.push(node);
        } else if (node.type.startsWith('plant')) {
          plants.push(node);
        } else {
          insects.push(node);
        }
      });

    return { current, plants, insects };
  }, [relationshipGraphData.nodes, searchQuery]);

  const legendTypeSet = useMemo(() => new Set(relationshipGraphData.nodes.map((n) => n.type)), [relationshipGraphData.nodes]);
  const showHostPlantLegend = legendTypeSet.has('plant-host');
  const showFlowerPlantLegend = legendTypeSet.has('plant-flower');
  const showBothPlantLegend = legendTypeSet.has('plant-both');
  const showInsectLegend = legendTypeSet.has('insect');
  const showInsectHostLegend = legendTypeSet.has('insect-host');
  const showInsectFlowerLegend = legendTypeSet.has('insect-flower');
  const showInsectBothLegend = legendTypeSet.has('insect-both');
  const legendRelationSet = useMemo(() => new Set(graphData.links.map((l) => l.relation || 'unknown')), [graphData.links]);
  const showHostRelationLegend = legendRelationSet.has('host');
  const showFlowerRelationLegend = legendRelationSet.has('flower');
  const showBothRelationLegend = legendRelationSet.has('both');

  const getLinkStyle = useCallback((relation) => RELATION_STYLES[relation] || RELATION_STYLES.unknown, []);

  const focusNodeById = useCallback((nodeId) => {
    const node = relationshipGraphData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    hasUserInteractedRef.current = true;
    setGuideDismissed(true);
    const groupId = networkGroup(node).id;
    setExpandedGroups(new Set(graphData.groups.some(group => group.id === groupId) ? [groupId] : []));
    pendingNodeFocusRef.current = true;
    pendingKeyboardFocusRef.current = true;
    setSelectedNodeId(nodeId);
    setHoverNodeId(null);
    setNodeListOpen(false);
  }, [relationshipGraphData.nodes, graphData.groups]);

  const focusNodeByName = useCallback((name, typeHint) => {
    const id = typeHint === 'plant' ? `plant:${name}` : `insect:${name}`;
    if (relationshipGraphData.nodes.some(node => node.id === id)) focusNodeById(id);
    else navigate(typeHint === 'plant' ? buildPlantPath(name) : buildInsectPath(insectLookup.get(name) || { name }), { state: makeDetailLinkState(location) });
  }, [focusNodeById, relationshipGraphData.nodes, navigate, insectLookup, location]);

  useEffect(() => {
    if (!selectedNodeId || nodeListOpen) return;
    const node = graphData.nodes.find(item => item.id === selectedNodeId);
    if (!node) return;
    const frame = requestAnimationFrame(() => {
      if (!fgRef.current) return;
      programmaticZoomUntilRef.current = Date.now() + 600;
      fgRef.current.centerAt(node.x || 0, node.y || 0, 280);
      if (pendingNodeFocusRef.current) fgRef.current.zoom(Math.min(2.1, graphLayoutMetrics.focusZoom), 280);
      pendingNodeFocusRef.current = false;
      if (pendingKeyboardFocusRef.current) {
        pendingKeyboardFocusRef.current = false;
        selectionPanelRef.current?.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedNodeId, graphData.nodes, graphSize.width, graphSize.height, graphLayoutMetrics.focusZoom, nodeListOpen]);

  const beginProgrammaticZoom = useCallback((ms) => {
    programmaticZoomUntilRef.current = Math.max(programmaticZoomUntilRef.current, Date.now() + ms);
  }, []);

  const fitGraphToViewport = useCallback((duration = 400) => {
    if (!fgRef.current) return;
    if (!labelMeasureContextRef.current) labelMeasureContextRef.current = document.createElement('canvas').getContext('2d');
    const context = labelMeasureContextRef.current;
    const fit = fitNetworkBounds(graphData.nodes, graphSize.width, graphSize.height, (label, current) => {
      if (!context) return [...String(label)].length * 12;
      context.font = `${current ? '700 13' : '12'}px "Helvetica Neue", "Segoe UI", sans-serif`;
      return context.measureText(label).width;
    }, photoSize);
    if (!fit) return;
    beginProgrammaticZoom(duration + 300);
    fgRef.current.centerAt(fit.x, fit.y, duration);
    fgRef.current.zoom(fit.zoom, duration);
  }, [beginProgrammaticZoom, graphData.nodes, graphSize.width, graphSize.height, photoSize]);

  const fitInitialView = fitGraphToViewport;

  // Refitting after panel/viewport changes keeps labels inside the actual canvas.
  useEffect(() => {
    if (selectedNodeId || pendingNodeFocusRef.current || hasUserInteractedRef.current) return;
    const frame = requestAnimationFrame(() => fitGraphToViewport(220));
    return () => cancelAnimationFrame(frame);
  }, [fitGraphToViewport, selectedNodeId]);

  // ノード（サムネ）同士の重なりを防ぐ衝突力。半径は描画半径＋ラベル余白ぶん
  const collideForce = useMemo(
    () => createCollideForce((node) => networkNodeRadius(node, photoSize) * 1.5 + 5),
    [photoSize]
  );

  useEffect(() => {
    if (!fgRef.current) return;
    try {
      const chargeForce = fgRef.current.d3Force?.('charge');
      if (chargeForce?.strength) {
        chargeForce.strength(graphLayoutMetrics.chargeStrength);
      }
      const linkForce = fgRef.current.d3Force?.('link');
      if (linkForce?.distance) {
        // 複数リング配置のため距離はリンクごとに持つ（未設定リンクは基準距離）
        linkForce.distance((link) => (typeof link?.distance === 'number' ? link.distance : linkDistance));
      }
      if (linkForce?.strength) {
        // d3既定の強度は 1/次数 で、中心ノードの次数が大きいスポーク構造では
        // 指定距離がほぼ効かない（chargeに負けてリングが崩れる）ため固定強度にする
        linkForce.strength(0.9);
      }
      fgRef.current.d3Force?.('collide', collideForce);
      fgRef.current.d3ReheatSimulation?.();
    } catch {
      // ignore
    }
  }, [collideForce, graphData.links.length, graphData.nodes.length, graphLayoutMetrics.chargeStrength, linkDistance]);

  // initial fit
  useEffect(() => {
    if (!fgRef.current) return;
    if (hasUserInteractedRef.current) return;
    const t = setTimeout(() => {
      fitInitialView(420);
    }, 250);
    return () => clearTimeout(t);
  }, [fitInitialView]);

  // hover highlight (preview only; selection takes precedence)
  const handleNodeHover = useCallback((node) => {
    if (selectedNodeId) return;
    setHoverNodeId(node ? node.id : null);
  }, [selectedNodeId]);

  const dismissGuideAfterRender = useCallback(() => {
    if (guideDismissFrameRef.current !== null) return;
    const runDismiss = () => {
      guideDismissFrameRef.current = null;
      setGuideDismissed(true);
    };
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      guideDismissFrameRef.current = window.requestAnimationFrame(runDismiss);
    } else {
      setTimeout(runDismiss, 0);
    }
  }, []);

  const markUserInteracted = useCallback(() => {
    hasUserInteractedRef.current = true;
    dismissGuideAfterRender();
  }, [dismissGuideAfterRender]);

  // click toggles selection (navigation moved to the detail panel)
  const handleNodeClick = useCallback((node) => {
    if (!node) return;
    if (ignoreNextNodeClickRef.current) {
      ignoreNextNodeClickRef.current = false;
      return;
    }
    markUserInteracted();
    if (node.type === 'group') {
      hasUserInteractedRef.current = false;
      setExpandedGroups(previous => new Set([...previous, node.id]));
      return;
    }
    setSelectedNodeId(prev => (prev === node.id ? null : node.id));
    setHoverNodeId(null);
  }, [markUserInteracted]);

  const handleBackgroundClick = useCallback(() => {
    markUserInteracted();
    setSelectedNodeId(null);
    setHoverNodeId(null);
    setNodeListOpen(false);
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
    ctx.save();
    ctx.globalAlpha = 1;
    const drawLabel = (x, y, label, { dim = false, below = false, gap = 4, emphasis = false } = {}) => {
      // ズームアウト時はラベル文字も少し縮めて重なりを抑える（画面上で最小約9.5px）
      const fontScale = Math.max(0.78, Math.min(1, globalScale));
      const fontSize = ((emphasis ? 13 : 12) * fontScale) / globalScale;
      ctx.font = `${emphasis ? '700 ' : ''}${fontSize}px "Helvetica Neue", "Segoe UI", sans-serif`;
      const textWidth = ctx.measureText(label).width;
      const padding = 4 / globalScale;
      const labelWidth = textWidth + padding * 2;
      const labelHeight = fontSize + padding * 2;
      // ラベルはノードの外側（中心から遠い側）に置き、ノードやリンクとの重なりを避ける
      const top = below ? y + gap : y - gap - labelHeight;
      const box = { left: (x - labelWidth / 2) * globalScale, right: (x + labelWidth / 2) * globalScale, top: top * globalScale, bottom: (top + labelHeight) * globalScale };
      const priority = node.type.includes('current') || selectedNodeId === node.id || hoverNodeId === node.id;
      if (labelMode === 'auto' && !priority && labelBoxesRef.current.some(b => box.left < b.right + 4 && box.right > b.left - 4 && box.top < b.bottom + 3 && box.bottom > b.top - 3)) return;
      labelBoxesRef.current.push(box);
      ctx.globalAlpha = dim ? 0.45 : 1;
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
      'insect-flower': '#f59e0b',
      'insect-both': '#a78bfa',
      insect: '#38bdf8',
      group: '#818cf8',
      'plant-current': '#22c55e',
      'plant-host': '#10b981',
      'plant-flower': '#f59e0b',
      'plant-both': '#84cc16',
      plant: '#10b981'
    };
    const isCurrent = node.type.includes('current');
    // Photo size is independent of graph zoom; empty nodes remain compact.
    const radius = networkNodeRadius(node, photoSize);
    const inHighlight = highlightNodeIds.size > 0 && highlightNodeIds.has(node.id);
    const dimByHighlight = highlightNodeIds.size > 0 && !inHighlight;
    const dim = dimByHighlight;
    const alpha = dim ? 0.25 : 1;
    // 名前が見えないと関係が読めないため、ラベルは既定で常時表示する。
    // 代わりに密なグラフでは、第一リング以外のノードをズームするまで短縮表示にして
    // 重なりを抑える（全文は選択・ホバー・ズーム・「全て」モードで見える）
    const dense = graphData.nodes.length > graphLayoutMetrics.denseLabelThreshold;
    const isPrimary = primaryNeighborIds.has(node.id);
    const primaryDense = primaryNeighborIds.size - 1 > 14;
    const emphasize = node.type === 'group' || isCurrent || selectedNodeId === node.id || (activeNodeId && inHighlight);
    const revealZoom = 1.6;
    // ノードが極端に多いグラフ（例: クヌギ=244種）では短縮ラベルでも全表示だと
    // 重なって判読不能になるため、autoモードではズームか選択で表示する。
    // 中心種・選択中・ハイライト中のラベルは常に出す
    const hideWhenCrowded = labelMode === 'auto'
      && graphData.nodes.length > 36
      && !emphasize
      && globalScale < revealZoom;
    const showLabel = labelMode !== 'none'
      && !hideWhenCrowded
      && (labelMode === 'all' || emphasize || !dim);
    const shorten = labelMode !== 'all'
      && dense
      && !emphasize
      && globalScale < revealZoom
      && (isPrimary ? primaryDense : true);
    const labelText = shorten
      ? truncateNodeLabel(node.name, isPrimary ? (isEnglish ? 16 : 9) : (isEnglish ? 12 : 6))
      : node.name;

    // try to ensure image is loaded
    const foundUrl = ensureImage(node.imgCandidates);
    const img = foundUrl ? imageCacheRef.current[foundUrl] : null;

    // glow
    ctx.save();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = colors[node.type] || '#94a3b8';
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (img) {
      ctx.save();
      drawRoundedRect(ctx, node.x - radius, node.y - radius, radius * 2, radius * 2, 6 / globalScale);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isDark ? '#1e293b' : '#fff';
      ctx.fill();
      ctx.clip();
      const box = containNetworkImage(img.naturalWidth, img.naturalHeight, radius);
      if (box) ctx.drawImage(img, node.x + box.x, node.y + box.y, box.width, box.height);
      ctx.restore();
      ctx.lineWidth = 1.2 / Math.sqrt(globalScale);
      ctx.strokeStyle = isDark ? 'rgba(226,232,240,0.35)' : 'rgba(15,23,42,0.35)';
      if (selectedNodeId === node.id) ctx.strokeStyle = isDark ? 'rgba(251,113,133,0.8)' : 'rgba(244,63,94,0.85)';
      drawRoundedRect(ctx, node.x - radius, node.y - radius, radius * 2, radius * 2, 6 / globalScale);
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
      if (img) drawRoundedRect(ctx, node.x - radius * 1.12, node.y - radius * 1.12, radius * 2.24, radius * 2.24, 8 / globalScale);
      else { ctx.beginPath(); ctx.arc(node.x, node.y, radius * 1.35, 0, Math.PI * 2); }
      ctx.stroke();
      ctx.restore();
    }

    if (showLabel) {
      drawLabel(node.x, node.y, labelText, {
        dim,
        // 中心（原点付近）から遠い側にラベルを出すことで、リンクや内側ノードとの重なりを減らす
        below: (node.y ?? 0) >= 0,
        gap: radius * (isCurrent ? 1.45 : 1.15) + 3 / globalScale,
        emphasis: isCurrent
      });
    }
    ctx.restore();
  }, [photoSize, hoverNodeId, activeNodeId, graphData.nodes.length, graphLayoutMetrics.denseLabelThreshold, highlightNodeIds, isDark, isEnglish, labelMode, primaryNeighborIds, selectedNodeId]);

  const nodePointerAreaPaint = useCallback((node, color, ctx, globalScale) => {
    // Include the corners of photo frames and a minimum 44px touch target.
    const radius = Math.max(networkNodeRadius(node, photoSize) * 1.5, 22 / globalScale);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }, [photoSize]);

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
    fitGraphToViewport(400);
  }, [fitGraphToViewport, markUserInteracted]);
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
    setIsPinDragging(true);
    pinDragNodeIdRef.current = node.id;
    pinDragPointerIdRef.current = pointerId;
    setSelectedNodeId(node.id);
    setHoverNodeId(null);
    node.fx = typeof node.x === 'number' ? node.x : 0;
    node.fy = typeof node.y === 'number' ? node.y : 0;
    setPinVersion((prev) => prev + 1);
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
      setIsPinDragging(false);
      pinDragPointerIdRef.current = null;
      pinDragNodeIdRef.current = null;
      cancelLongPress();
      window.setTimeout(() => { ignoreNextNodeClickRef.current = false; }, 260);
      return;
    }

    const origin = longPressStartRef.current;
    if (origin?.pointerId === event.pointerId) cancelLongPress();
  }, [cancelLongPress]);

  const statsChips = useMemo(() => {
    const chips = [];
    if (viewStats.primaryTotal > 0) {
      chips.push(`${viewStats.primaryLabel} ${viewStats.primaryShown}/${viewStats.primaryTotal}`);
    }
    chips.push(`${isEnglish ? 'Links' : '関係'} ${viewStats.visibleLinks}/${viewStats.totalLinks}`);
    if (collapsedGroups.length > 0) chips.push(isEnglish ? `${collapsedGroups.length} families grouped` : `${collapsedGroups.length}科を集約`);
    if (pinnedNodeCount > 0) {
      chips.push(`${isEnglish ? 'Pinned' : '固定'} ${pinnedNodeCount}`);
    }
    return chips;
  }, [pinnedNodeCount, viewStats, isEnglish, collapsedGroups.length]);

  const interactionHint = isCompactPanel
    ? (isEnglish ? 'Tap to select; pinch to zoom. Use the list to search every species.' : 'タップで選択、ピンチで拡大。種の一覧から全種を検索できます。')
    : (isEnglish ? 'Click to select; drag to move. Click the graph to enable wheel zoom.' : 'クリックで選択、ドラッグで移動。図をクリックするとホイールで拡大できます。');

  const enablePanInteraction = !isPinDragging;
  // PC: ノードドラッグは常時有効（ページスクロールと競合しない）。
  // ホイールズームはグラフをクリックしてから有効（スクロールジャック防止）
  const enableZoomInteraction = (isCompactPanel || desktopZoomActive) && !isPinDragging;
  const enableNodeDrag = !isPinDragging;
  const desktopControlButtonClass = 'shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800';
  const graphCursor = isPinDragging ? 'grabbing' : hoverNodeId ? 'pointer' : 'grab';

  const handleGraphWheelCapture = useCallback((event) => {
    if (isCompactPanel || desktopZoomActive) return;
    event.stopPropagation();
    if (typeof event.nativeEvent?.stopImmediatePropagation === 'function') {
      event.nativeEvent.stopImmediatePropagation();
    }
  }, [isCompactPanel, desktopZoomActive]);

  const activateDesktopZoom = useCallback(() => {
    if (!isCompactPanel) setDesktopZoomActive(true);
  }, [isCompactPanel]);

  const deactivateDesktopZoom = useCallback(() => {
    setDesktopZoomActive(false);
  }, []);

  const relationFilterButtons = (
    <div className="inline-flex flex-wrap rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
      {RELATION_FILTERS.map((item) => {
        const active = relationFilter === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => { hasUserInteractedRef.current = false; setRelationFilter(item.value); }}
            aria-pressed={active}
            title={isEnglish ? item.helperEn : item.helper}
            className={`px-2.5 py-1.5 text-xs font-semibold border-l first:border-l-0 border-slate-200 dark:border-slate-600 ${
              active
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white'
                : 'bg-white/70 text-slate-700 hover:bg-white dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            {isCompactPanel ? (isEnglish ? item.shortLabelEn : item.shortLabel) : (isEnglish ? item.labelEn : item.label)}
          </button>
        );
      })}
    </div>
  );

  const legendBody = (
    <>
      <div className="space-y-1">
        {(currentInsect || currentPlantName) && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
            <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-slate-700/80 dark:border-slate-100/90"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-slate-500 dark:bg-slate-100"></span>
            </span>
            <span>{isEnglish ? 'Outlined node is the focus of this page' : '外枠付きノードが現在ページの中心'}</span>
          </div>
        )}
        {currentInsect && (
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-slate-700/80 dark:border-slate-100/90"></span>
              <span className="h-2 w-2 rounded-full bg-rose-400"></span>
            </span>
            <span>{isEnglish ? 'Current insect' : '現在の昆虫'}</span>
          </div>
        )}
        {currentPlantName && (
          <div className="flex items-center gap-2">
            <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
              <span className="absolute inset-0 rounded-full border border-slate-700/80 dark:border-slate-100/90"></span>
              <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            </span>
            <span>{isEnglish ? 'Current plant' : '現在の植物'}</span>
          </div>
        )}
        {showHostPlantLegend && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
            <span>{isEnglish ? 'Host plant' : '食草・寄主植物'}</span>
          </div>
        )}
        {showFlowerPlantLegend && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400"></span>
            <span>{isEnglish ? 'Flower-visit plant' : '訪花植物'}</span>
          </div>
        )}
        {showBothPlantLegend && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-lime-400"></span>
            <span>{isEnglish ? 'Host + flower' : '食草＋訪花'}</span>
          </div>
        )}
        {showInsectHostLegend && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sky-400"></span>
            <span>{isEnglish ? 'Host-plant insect' : '食草昆虫'}</span>
          </div>
        )}
        {showInsectFlowerLegend && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-amber-400"></span>
            <span>{isEnglish ? 'Flower-visit insect' : '訪花昆虫'}</span>
          </div>
        )}
        {showInsectBothLegend && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-violet-400"></span>
            <span>{isEnglish ? 'Host + flower insect' : '食草＋訪花昆虫'}</span>
          </div>
        )}
        {showInsectLegend && (
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-sky-400"></span>
            <span>{isEnglish ? 'Related insects' : '関連する昆虫'}</span>
          </div>
        )}
      </div>
      {(showHostRelationLegend || showFlowerRelationLegend || showBothRelationLegend) && (
        <div className="pt-2 mt-2 border-t border-slate-200/90 dark:border-slate-600/80 space-y-1">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">{isEnglish ? 'Line meaning' : '線の意味'}</div>
          {showHostRelationLegend && (
            <div className="flex items-center gap-2">
              <span className={`inline-block w-7 border-t-2 ${RELATION_STYLES.host.legendClass}`} aria-hidden="true"></span>
              <span>{relationStyleLabel('host')}<span className="sr-only">{isEnglish ? ' (solid line, green)' : '（実線・緑）'}</span></span>
            </div>
          )}
          {showFlowerRelationLegend && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-7 border-t-2 ${RELATION_STYLES.flower.legendClass}`}
                style={{ borderTopStyle: 'dashed' }}
                aria-hidden="true"
              ></span>
              <span>{relationStyleLabel('flower')}<span className="sr-only">{isEnglish ? ' (dashed line, amber)' : '（破線・黄）'}</span></span>
            </div>
          )}
          {showBothRelationLegend && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-7 border-t-2 ${RELATION_STYLES.both.legendClass}`}
                style={{ borderTopStyle: 'dotted', borderTopWidth: '2px' }}
                aria-hidden="true"
              ></span>
              <span>{relationStyleLabel('both')}<span className="sr-only">{isEnglish ? ' (dotted line, violet)' : '（点線・紫）'}</span></span>
            </div>
          )}
        </div>
      )}
    </>
  );

  // 常時表示用のコンパクト凡例（従来は ? ポップオーバー内に隠れていた）
  // 実際の描画色（中心=ローズ/緑・訪花=アンバー・食草＋訪花=バイオレット/ライム）と
  // 凡例が食い違わないよう、グラフに存在するノード種別ごとに色を出し分ける
  const legendStrip = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
      <span className="font-semibold text-slate-500 dark:text-slate-400">{isEnglish ? 'Legend' : '凡例'}</span>
      {collapsedGroups.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-indigo-400" aria-hidden="true" />{isEnglish ? 'Family group (select to expand)' : '科のまとまり（選ぶと展開）'}</span>}
      {legendTypeSet.has('insect-current') && (
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex h-3 w-3 items-center justify-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full border border-slate-700/80 dark:border-slate-100/90"></span>
            <span className="h-1.5 w-1.5 rounded-full bg-rose-400"></span>
          </span>
          {isEnglish ? 'Current insect' : '現在の昆虫'}
        </span>
      )}
      {legendTypeSet.has('plant-current') && (
        <span className="inline-flex items-center gap-1.5">
          <span className="relative inline-flex h-3 w-3 items-center justify-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full border border-slate-700/80 dark:border-slate-100/90"></span>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>
          </span>
          {isEnglish ? 'Current plant' : '現在の植物'}
        </span>
      )}
      {(showInsectLegend || showInsectHostLegend) && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-sky-400" aria-hidden="true"></span>
          {(showInsectFlowerLegend || showInsectBothLegend)
            ? (isEnglish ? 'Host-plant insect' : '食草昆虫')
            : (isEnglish ? 'Insect' : '昆虫')}
        </span>
      )}
      {showInsectFlowerLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true"></span>{isEnglish ? 'Flower-visit insect' : '訪花昆虫'}
        </span>
      )}
      {showInsectBothLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-violet-400" aria-hidden="true"></span>{isEnglish ? 'Host + flower insect' : '食草＋訪花昆虫'}
        </span>
      )}
      {showHostPlantLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true"></span>
          {(showFlowerPlantLegend || showBothPlantLegend)
            ? (isEnglish ? 'Host plant' : '食草植物')
            : (isEnglish ? 'Plant' : '植物')}
        </span>
      )}
      {showFlowerPlantLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden="true"></span>{isEnglish ? 'Flower-visit plant' : '訪花植物'}
        </span>
      )}
      {showBothPlantLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-lime-400" aria-hidden="true"></span>{isEnglish ? 'Host + flower plant' : '食草＋訪花植物'}
        </span>
      )}
      {showHostRelationLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-6 border-t-2 ${RELATION_STYLES.host.legendClass}`} aria-hidden="true"></span>
          {relationStyleLabel('host')}
        </span>
      )}
      {showFlowerRelationLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-6 border-t-2 ${RELATION_STYLES.flower.legendClass}`} style={{ borderTopStyle: 'dashed' }} aria-hidden="true"></span>
          {relationStyleLabel('flower')}
        </span>
      )}
      {showBothRelationLegend && (
        <span className="inline-flex items-center gap-1.5">
          <span className={`inline-block w-6 border-t-2 ${RELATION_STYLES.both.legendClass}`} style={{ borderTopStyle: 'dotted' }} aria-hidden="true"></span>
          {relationStyleLabel('both')}
        </span>
      )}
    </div>
  );

  const graphHelpPopoverContent = (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="font-semibold text-slate-900 dark:text-white">{isEnglish ? 'Controls' : '操作'}</div>
        <p>{interactionHint}</p>
      </div>

      <div className="space-y-1">
        <div className="font-semibold text-slate-900 dark:text-white">{isEnglish ? 'Filter' : '絞り込み'}</div>
        <div className="space-y-1.5">
          {RELATION_FILTERS.map((item) => (
            <div key={item.value}>
              <span className="font-medium text-slate-800 dark:text-slate-100">{isEnglish ? item.labelEn : item.label}</span>
              <span className="text-slate-500 dark:text-slate-300">: {isEnglish ? item.helperEn : item.helper}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-semibold text-slate-900 dark:text-white">{isEnglish ? 'Legend' : '凡例'}</div>
        <div className="rounded-xl border border-slate-200/90 bg-slate-50/90 p-3 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200">
          {legendBody}
        </div>
      </div>
    </div>
  );

  const nodeListPanel = (
    <div className="flex h-full min-h-0 flex-col" data-network-list>
      <div className="flex items-center justify-between border-b border-slate-200 p-3 dark:border-slate-700">
        <h3 className="font-bold">{isEnglish ? 'Species list' : '種の一覧'} <span className="text-sm font-normal">({nodeGroups.current.length + nodeGroups.plants.length + nodeGroups.insects.length})</span></h3>
        <button type="button" className={desktopControlButtonClass} onClick={() => { setNodeListOpen(false); listButtonRef.current?.focus(); }} aria-label={isEnglish ? 'Close species list' : '種の一覧を閉じる'}>✕</button>
      </div>
      <p className="px-3 pt-2 text-xs text-slate-500 dark:text-slate-300">{isEnglish ? 'Includes species inside collapsed groups. Relationship filters still apply.' : 'まとめた科の中の種も検索できます。関係の絞り込みは適用されます。'}</p>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {[...nodeGroups.current, ...nodeGroups.plants, ...nodeGroups.insects].map(node => (
          <button key={node.id} type="button" onClick={() => focusNodeById(node.id)} aria-pressed={selectedNodeId === node.id} className="mb-1 flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800">
            {node.imgCandidates?.length > 0
              ? <ImageWithFallback candidates={node.imgCandidates} alt="" className="h-14 w-14 shrink-0 rounded-md bg-slate-50" fit="contain" />
              : <span className={node.type.startsWith('plant') ? 'h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500' : 'h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500'} aria-hidden="true" />}
            <span className="min-w-0"><span className="block font-semibold">{node.name}</span><span className="block text-xs text-slate-500 dark:text-slate-300">{node.type.includes('current') ? (isEnglish ? 'Current species' : '現在の種') : networkGroup(node, isEnglish).label}</span></span>
          </button>
        ))}
        {!nodeGroups.current.length && !nodeGroups.plants.length && !nodeGroups.insects.length && <p role="status" className="text-sm">{isEnglish ? 'No matching species. Try another name or relationship filter.' : '一致する種はありません。名前や関係の絞り込みを変更してください。'}</p>}
      </div>
    </div>
  );

  const selectionPanelContent = selectedNode ? (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
                selectedNode.type.startsWith('plant')
                  ? (selectedPlantBadge?.className || 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/60')
                  : (selectedInsectBadge?.className || 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-900/60')
              }`}
            >
              {selectedNode.type.startsWith('plant')
                ? (selectedPlantBadge?.label || (isEnglish ? 'Plant' : '植物'))
                : (selectedInsectBadge?.label || (isEnglish ? 'Insect' : '昆虫'))}
            </span>
            {selectedNodePinned && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200">
                {isEnglish ? 'Pinned' : '固定中'}
              </span>
            )}
            <h3 className="font-bold truncate">{selectedNode.name}</h3>
          </div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">
            {selectedNode.type.startsWith('plant') ? (() => {
              const yinfo = getYlistPlantInfo(selectedNode.name);
              return yinfo?.info?.scientificName ? <span className="italic">{yinfo.info.scientificName}</span> : <span className="opacity-70">{isEnglish ? 'Sci. name: unknown' : '学名: 不明'}</span>;
            })() : (
              selectedNode.raw?.scientificName
                ? <span className="italic">{selectedNode.raw.scientificName}</span>
                : <span className="opacity-70">{isEnglish ? 'Sci. name: unknown' : '学名: 不明'}</span>
            )}
          </div>
          {selectedStats && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-600 dark:text-slate-300">
              <span>{isEnglish ? 'Links' : '接続'}: {selectedStats.degree}</span>
              {selectedNode.type.startsWith('plant') && <span>{isEnglish ? 'Users' : '利用種'}: {selectedPlantInsects.length}</span>}
              {selectedNode.type.startsWith('insect') && <span>{isEnglish ? 'Host plants' : '食草'}: {selectedInsectHostPlants.length}</span>}
              {selectedNode.type.startsWith('insect') && selectedInsectFlowerPlants.length > 0 && (
                <span>{isEnglish ? 'Flower visits' : '訪花'}: {selectedInsectFlowerPlants.length}</span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isCompactPanel && (
            <button
              type="button"
              className="shrink-0 px-2 py-1 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 hover:bg-white dark:hover:bg-slate-800"
              onClick={() => setPanelCollapsed((prev) => !prev)}
              aria-label={panelCollapsed ? (isEnglish ? 'Show details' : '詳細を表示') : (isEnglish ? 'Collapse' : '縮小')}
            >
              {panelCollapsed ? (isEnglish ? 'Details' : '詳細') : (isEnglish ? 'Collapse' : '縮小')}
            </button>
          )}
          <button
            type="button"
            className="shrink-0 p-2 -m-2 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => { setSelectedNodeId(null); listButtonRef.current?.focus(); }}
            aria-label={isEnglish ? 'Clear selection' : '選択を解除'}
            title={isEnglish ? 'Clear' : '解除'}
          >
            ✕
          </button>
        </div>
      </div>

      {!panelCollapsed && (
        <>
          <div className={`mt-3 min-h-0 flex-1 ${isCompactPanel ? 'overflow-y-auto pr-1' : 'overflow-y-auto'}`}>
            {selectedNode.imgCandidates?.length > 0 && <button
              type="button"
              data-network-photo-preview
              className="mb-3 block w-full rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs text-slate-700 hover:border-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              onClick={() => setPhotoPreview({ id: selectedNode.id, label: selectedNode.name, alt: `${selectedNode.name}${isEnglish ? ' photograph' : 'の写真'}`, src: selectedNode.imgCandidates[0], originalCandidates: networkPreviewCandidates(selectedNode.imgCandidates) })}
              aria-label={isEnglish ? `Enlarge photograph of ${selectedNode.name}` : `${selectedNode.name}の写真を大きく表示`}
            >
              <ImageWithFallback candidates={selectedNode.imgCandidates} alt="" className={isCompactPanel ? 'h-24 w-full' : 'h-44 w-full'} fit="contain" loading="eager" />
              <span className="block py-1">{isEnglish ? 'Enlarge photograph' : '写真を大きく表示'}</span>
            </button>}
            <div className="space-y-2">
              {selectedNode.type.startsWith('insect') ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{isEnglish ? 'Host plants' : '食草・寄主植物'}</div>
                    {selectedInsectHostPlants.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{isEnglish ? 'Unknown / not recorded' : '不明 / 未登録'}</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedInsectHostPlants.map((p, idx) => (
                          <button
                            type="button"
                            key={`host-${p.name}_${p.part}_${idx}`}
                            onClick={() => focusNodeByName(p.name, 'plant')}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                            title={isEnglish ? `Focus ${p.name}` : `${p.name}を表示`}
                          >
                            {p.name}{p.part ? `（${p.part}）` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{isEnglish ? 'Flower visits' : '訪花'}</div>
                    {selectedInsectFlowerPlants.length === 0 ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400">{isEnglish ? 'Unknown / not recorded' : '不明 / 未登録'}</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedInsectFlowerPlants.map((p, idx) => (
                          <button
                            type="button"
                            key={`flower-${p.name}_${p.part}_${idx}`}
                            onClick={() => focusNodeByName(p.name, 'plant')}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40"
                            title={isEnglish ? `Focus ${p.name}` : `${p.name}を表示`}
                          >
                            {p.name}{p.part ? `（${p.part}）` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">{isEnglish ? 'Insects using this plant' : 'この植物を利用する昆虫'}</div>
                  {selectedPlantInsects.length === 0 ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">{isEnglish ? 'Unknown / not recorded' : '不明 / 未登録'}</div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedPlantInsects.map((name, idx) => (
                        <button
                          type="button"
                          key={`${name}_${idx}`}
                          onClick={() => focusNodeByName(name, 'insect')}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs border bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                          title={isEnglish ? `Focus ${name}` : `${name}を表示`}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              className={`px-3 py-2 rounded-lg text-[12px] font-semibold border shadow-sm ${
                selectedNodePinned
                  ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/40'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-800'
              }`}
              onClick={() => {
                if (!selectedNode) return;
                if (selectedNodePinned) {
                  unpinNodeById(selectedNode.id);
                } else {
                  pinNodeById(selectedNode.id);
                }
              }}
            >
              {selectedNodePinned ? (isEnglish ? 'Unpin' : '固定解除') : (isEnglish ? 'Pin' : '固定する')}
            </button>
            {pinnedNodeCount > 1 && (
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:hover:bg-slate-800"
                onClick={clearPinnedNodes}
              >
                {isEnglish ? 'Unpin all' : '全固定解除'}
              </button>
            )}
            <button
              type="button"
              className={`px-3 py-2 rounded-lg text-[12px] font-semibold text-white shadow ${selectedNode.type.startsWith('plant') ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-sky-600 hover:bg-sky-700'}`}
              onClick={() => {
                if (!selectedNode) return;
                if (selectedNode.type.startsWith('insect')) {
                  const path = selectedNode.raw?.path || buildInsectPath(selectedNode.raw || { name: selectedNode.name });
                  navigate(path, { state: makeDetailLinkState(location) });
                } else {
                  navigate(buildPlantPath(selectedNode.name), { state: makeDetailLinkState(location) });
                }
              }}
            >
              {isEnglish ? 'View details →' : '詳細ページへ →'}
            </button>
          </div>
        </>
      )}
    </div>
  ) : null;

  const insectNodeCount = relationshipGraphData.nodes.filter(n => n.type.startsWith('insect')).length;
  const plantNodeCount = relationshipGraphData.nodes.filter(n => n.type.startsWith('plant')).length;
  const graphAriaLabel = isEnglish ? `Food web graph: showing relationships between ${insectNodeCount} insect species and ${plantNodeCount} plant species` : `食物網グラフ: ${insectNodeCount}種の昆虫と${plantNodeCount}種の植物の関係を表示`;

  const selectedNodeAnnouncement = selectedNode
    ? (() => {
        const degree = selectedStats?.degree ?? 0;
        const typeLabel = selectedNode.type.startsWith('plant') ? (isEnglish ? 'Plant' : '植物') : (isEnglish ? 'Insect' : '昆虫');
        return isEnglish ? `${typeLabel} "${selectedNode.name}" selected. Links: ${degree}` : `${typeLabel}「${selectedNode.name}」を選択中。接続数: ${degree}`;
      })()
    : '';

  const showInspector = nodeListOpen || Boolean(selectedNode);
  const controlClass = `${desktopControlButtonClass} min-h-9 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600`;

  return (
    <div data-network-root className="flex h-full min-h-0 w-full flex-col rounded-xl border border-slate-200 bg-slate-50 text-slate-800 shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
      <div data-network-toolbar className="relative z-20 shrink-0 space-y-2 border-b border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center gap-2">
          <label className="min-w-[140px] flex-1">
            <span className="sr-only">{isEnglish ? 'Search network species' : 'ネットワーク内の種を検索'}</span>
            <input ref={searchInputRef} type="search" value={searchQuery} onChange={event => { setSearchQuery(event.target.value); setNodeListOpen(true); }} onFocus={() => setNodeListOpen(true)} onKeyDown={event => { if (event.key === 'Escape') { setNodeListOpen(false); listButtonRef.current?.focus(); } }} placeholder={isEnglish ? 'Search species or family' : '種名・科名で探す'} className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/25 dark:border-slate-600 dark:bg-slate-950" />
          </label>
          <button ref={listButtonRef} type="button" className={controlClass} aria-expanded={nodeListOpen} onClick={() => setNodeListOpen(previous => !previous)}>{isEnglish ? 'Species list' : '種の一覧'}</button>
          <label className="flex min-h-9 items-center gap-1 rounded-lg border border-slate-200 px-2 text-xs dark:border-slate-600">
            <span>{isEnglish ? 'Photos' : '写真'}</span>
            <select aria-label={isEnglish ? 'Photo size' : '写真サイズ'} value={photoSize} onChange={event => { markUserInteracted(); setPhotoSize(event.target.value); }} className="h-8 bg-transparent font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
              {NETWORK_PHOTO_SIZES.map(size => <option key={size.value} value={size.value}>{isEnglish ? size.labelEn : size.label}</option>)}
            </select>
          </label>
          <button type="button" className={controlClass} onClick={resetView}>{isEnglish ? 'Fit view' : '全体表示'}</button>
          <button type="button" className={controlClass} onClick={zoomOut} aria-label={isEnglish ? 'Zoom out' : '縮小'}>−</button>
          <button type="button" className={controlClass} onClick={zoomIn} aria-label={isEnglish ? 'Zoom in' : '拡大'}>＋</button>
          <button type="button" className={controlClass} aria-expanded={desktopControlsOpen} onClick={() => setDesktopControlsOpen(previous => !previous)}>{isEnglish ? 'Settings' : '表示設定'}</button>
          <InfoPopover title={isEnglish ? 'How to read the network' : 'ネットワーク図の見方'} buttonAriaLabel={isEnglish ? 'Show how to use the network diagram' : 'ネットワーク図の使い方を表示'} buttonClassName={controlClass} panelClassName="w-[min(24rem,calc(100vw-2rem))]" buttonContent={<span>?</span>}>{graphHelpPopoverContent}</InfoPopover>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {relationFilterButtons}
          <span className="text-xs text-slate-500 dark:text-slate-300" data-network-counts>{statsChips.join(' · ')}</span>
        </div>
        {relationshipGraphData.nodes.length > 36 && <div className="flex items-center gap-2 text-xs">
          <button type="button" className={controlClass} aria-pressed={groupMode === 'auto'} onClick={() => { hasUserInteractedRef.current = false; setGroupMode(previous => previous === 'auto' ? 'all' : 'auto'); setExpandedGroups(new Set()); }}>{groupMode === 'auto' ? (isEnglish ? 'Grouped by family' : '科ごとにまとめる') : (isEnglish ? 'Show individual species' : '個々の種を表示')}</button>
          {expandedGroups.size > 0 && groupMode === 'auto' && <button type="button" className={controlClass} onClick={() => { hasUserInteractedRef.current = false; setExpandedGroups(new Set()); setSelectedNodeId(null); listButtonRef.current?.focus(); }}>{isEnglish ? 'Collapse groups' : '科をまとめ直す'}</button>}
          <span>{collapsedGroups.length > 0 ? (isEnglish ? 'Select a group to expand. All species remain in the list.' : '科を選ぶと展開。全種は一覧で確認できます。') : (isEnglish ? 'All species displayed individually.' : '個々の種を表示中')}</span>
        </div>}
        <div className="hidden sm:block">{legendStrip}</div>
        {desktopControlsOpen && <div className="absolute inset-x-3 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-300 bg-white p-3 shadow-lg dark:border-slate-600 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-2">
            {['auto', 'all', 'none'].map(mode => <button key={mode} type="button" className={controlClass} aria-pressed={labelMode === mode} onClick={() => setLabelMode(mode)}>{mode === 'auto' ? (isEnglish ? 'Labels: auto' : 'ラベル: 自動') : mode === 'all' ? (isEnglish ? 'Labels: all' : 'ラベル: 全て') : (isEnglish ? 'Labels: none' : 'ラベル: なし')}</button>)}
            {pinnedNodeCount > 0 && <button type="button" className={controlClass} onClick={clearPinnedNodes}>{isEnglish ? 'Unpin all' : '全固定解除'}</button>}
            <button type="button" className={controlClass} onClick={() => setDesktopControlsOpen(false)}>{isEnglish ? 'Close settings' : '設定を閉じる'}</button>
          </div>
          <p className="mt-2 text-xs">{interactionHint}</p>
          <div className="mt-2 sm:hidden">{legendStrip}</div>
        </div>}
      </div>
      <div className={`flex min-h-0 flex-1 ${isCompactPanel ? 'flex-col' : 'flex-row'}`}>
        <div ref={containerRef} data-network-canvas className="food-web-graph-touch relative min-h-0 min-w-0 flex-1 overflow-hidden" style={{ cursor: graphCursor }} role="region" aria-label={graphAriaLabel} onWheelCapture={handleGraphWheelCapture} onPointerDownCapture={handlePointerDownCapture} onPointerMoveCapture={handlePointerMoveCapture} onPointerUpCapture={handlePointerUpCapture} onPointerCancelCapture={handlePointerUpCapture} onClick={activateDesktopZoom} onMouseLeave={deactivateDesktopZoom}>
          <div aria-live="polite" aria-atomic="true" className="sr-only">{selectedNodeAnnouncement}</div>
          <ForceGraph2D
            ref={fgRef}
            width={graphSize.width}
            height={graphSize.height}
            graphData={graphData}
            nodeLabel="name"
            linkLabel={link => `${relationStyleLabel(link.relation)}${link.count > 1 ? ` (${link.count}${isEnglish ? ' relationships' : '関係'})` : ''}`}
            onRenderFramePre={() => { labelBoxesRef.current = []; }}
            nodeCanvasObject={nodeCanvasObject}
            nodePointerAreaPaint={nodePointerAreaPaint}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
            onBackgroundClick={handleBackgroundClick}
            enablePanInteraction={enablePanInteraction}
            enableZoomInteraction={enableZoomInteraction}
            enableNodeDrag={enableNodeDrag}
            linkColor={link => {
              const relationStyle = getLinkStyle(link?.relation);
              const highlighted = highlightLinks.has(link);
              const sId = typeof link.source === 'object' ? link.source.id : link.source;
              const tId = typeof link.target === 'object' ? link.target.id : link.target;
              if (!sId || !tId) return relationStyle.color;
              const dim = activeNodeId && !highlighted;
              if (dim) return relationStyle.dimColor;
              return highlighted ? relationStyle.activeColor : relationStyle.color;
            }}
            linkLineDash={link => getLinkStyle(link?.relation).dash}
            linkWidth={link => {
              const relationStyle = getLinkStyle(link?.relation);
              return highlightLinks.has(link) ? relationStyle.width + 0.95 : relationStyle.width;
            }}
            linkDirectionalParticles={link => (!prefersReducedMotion && highlightLinks.has(link) ? 3 : 0)}
            linkDirectionalParticleColor={link => getLinkStyle(link?.relation).activeColor}
            linkDirectionalParticleWidth={1.6}
            linkCurvature={0.18}
            backgroundColor={isDark ? '#0b1220' : '#f8fafc'}
            cooldownTicks={110}
            d3VelocityDecay={0.35}
            onZoom={() => {
              // 自動ズーム（初期フィット等）はユーザー操作として扱わない
              if (Date.now() < programmaticZoomUntilRef.current) return;
              markUserInteracted();
            }}
            onEngineStop={() => {
              if (!fgRef.current) return;
              if (hasUserInteractedRef.current) return;
              const runFit = () => {
                if (!fgRef.current) return;
                if (hasUserInteractedRef.current) return;
                fitInitialView(420);
              };
              if (typeof window !== 'undefined' && window.requestAnimationFrame) {
                window.requestAnimationFrame(runFit);
              } else {
                setTimeout(runFit, 0);
              }
            }}
          />

          {relationFilter !== 'all' && relationshipGraphData.links.length === 0 && <p className="absolute inset-x-3 top-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900" role="status">{isEnglish ? 'No relationships match this filter.' : 'この条件に一致する関係はありません。'}</p>}
        </div>
        {showInspector && <aside
          ref={selectionPanelRef}
          tabIndex={-1}
          data-network-inspector
          aria-label={nodeListOpen ? (isEnglish ? 'Species list' : '種の一覧') : (isEnglish ? 'Selected species details' : '選択した種の詳細')}
          className={`min-h-0 shrink-0 overflow-hidden border-slate-200 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-slate-700 dark:bg-slate-900 ${isCompactPanel
            ? (panelCollapsed && !nodeListOpen ? 'h-[128px] border-t' : 'h-[240px] border-t')
            : 'w-[310px] border-l'}`}
        >
          {nodeListOpen ? nodeListPanel : <div className="h-full min-h-0 p-4">{selectionPanelContent}</div>}
        </aside>}
      </div>
      {!guideDismissed && <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 px-3 py-1.5 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"><span>{isEnglish ? 'Select a species for details and a larger photograph. Photo size can be changed independently of zoom.' : '種を選ぶと説明と大きな写真を表示。写真サイズは図のズームとは別に変えられます。'}</span><button type="button" className="p-1" aria-label={isEnglish ? 'Close guide' : 'ガイドを閉じる'} onClick={() => setGuideDismissed(true)}>✕</button></div>}
      {photoPreview && typeof document !== 'undefined' && createPortal(<ImageModal image={photoPreview} isOpen onClose={() => setPhotoPreview(null)} locale={isEnglish ? 'en' : 'ja'} />, document.body)}
    </div>
  );
});

export default FoodWebGraph;
