// Presentation-only helpers: source species and relationships are never discarded.
export const endpointId = (endpoint) => typeof endpoint === 'object' ? endpoint?.id : endpoint;

export const NETWORK_PHOTO_SIZES = [
  { value: 'medium', radius: 22, label: '中', labelEn: 'Medium' },
  { value: 'large', radius: 32, label: '大', labelEn: 'Large' },
  { value: 'extra-large', radius: 44, label: '特大', labelEn: 'Extra large' },
];

// One geometry contract for drawing, fitting, collision and pointer targets.
// Species without a registered photo stay compact; their records remain visible.
export const networkNodeRadius = (node, photoSize = 'large') => {
  if (node.type === 'group') return 20;
  const current = node.type.includes('current');
  if (!node.imgCandidates?.length) return current ? 18 : 12;
  const size = NETWORK_PHOTO_SIZES.find(option => option.value === photoSize) || NETWORK_PHOTO_SIZES[1];
  return size.radius * (current ? 1.25 : 1);
};

// Fill the circular crop without letterboxing or stretching. Full photographs
// remain available in the separate image preview.
export const coverNetworkImage = (width, height, radius) => {
  if (!(width > 0 && height > 0 && radius > 0)) return null;
  const scale = radius * 2 / Math.min(width, height);
  return { x: -width * scale / 2, y: -height * scale / 2, width: width * scale, height: height * scale };
};

export const networkPreviewCandidates = (candidates = []) => {
  const resolution = url => Number(url.match(/\.(\d+)\.(?:avif|webp|jpe?g|png)(?:[?#]|$)/i)?.[1] || 2048);
  return [...new Set(candidates.filter(Boolean))].sort((a, b) => resolution(b) - resolution(a));
};

export const networkGroup = (node, isEnglish = false) => {
  const kind = node.type.startsWith('plant') ? 'plant' : 'insect';
  const classification = node.raw?.classification || {};
  const family = classification.familyJapanese || classification.family || node.raw?.family || '';
  const label = isEnglish
    ? classification.family || family || (kind === 'plant' ? 'Plants (unclassified)' : 'Insects (unclassified)')
    : family || (kind === 'plant' ? '植物（分類未登録）' : '昆虫（分類未登録）');
  return { id: `group:${kind}:${family || 'unknown'}`, label, kind };
};

export const groupNetwork = (data, { expanded = new Set(), enabled = true, isEnglish = false, threshold = 36 } = {}) => {
  if (!enabled || data.nodes.length <= threshold) return { ...data, groups: [] };
  const families = new Map();
  for (const node of data.nodes) {
    if (node.type.includes('current')) continue;
    const group = networkGroup(node, isEnglish);
    if (!families.has(group.id)) families.set(group.id, { ...group, members: [] });
    families.get(group.id).members.push(node);
  }
  const groups = [...families.values()].filter(group => group.members.length >= 3);
  const replacement = new Map();
  const nodes = [];
  for (const group of groups) {
    if (expanded.has(group.id)) continue;
    for (const node of group.members) replacement.set(node.id, group.id);
    const average = (axis) => group.members.reduce((sum, node) => sum + (Number.isFinite(node[axis]) ? node[axis] : 0), 0) / group.members.length;
    nodes.push({ id: group.id, name: `${group.label} (${group.members.length}${isEnglish ? ' species' : '種'})`, type: 'group', group, x: average('x'), y: average('y') });
  }
  nodes.push(...data.nodes.filter(node => !replacement.has(node.id)));
  nodes.sort((a, b) => Number(b.type.includes('current')) - Number(a.type.includes('current')));
  const linksByKey = new Map();
  for (const link of data.links) {
    const source = replacement.get(endpointId(link.source)) || endpointId(link.source);
    const target = replacement.get(endpointId(link.target)) || endpointId(link.target);
    const key = JSON.stringify([source, target, link.relation || 'unknown']);
    const existing = linksByKey.get(key);
    if (existing) existing.count += 1;
    else linksByKey.set(key, { ...link, source, target, count: 1 });
  }
  return { ...data, nodes, links: [...linksByKey.values()], groups };
};

const normalizeSearch = (value) => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));

export const searchNetworkNodes = (nodes, query) => {
  const words = normalizeSearch(query).trim().split(/\s+/).filter(Boolean);
  return nodes.filter(node => {
    const text = normalizeSearch([node.name, node.raw?.scientificName, node.raw?.alternativeNames, node.raw?.classification?.familyJapanese, node.raw?.classification?.family].filter(Boolean).join(' '));
    return words.every(word => text.includes(word));
  });
};

// Fit painted circles AND labels, not just the centers used by zoomToFit.
export const fitNetworkBounds = (nodes, width, height, measureLabel = text => [...String(text)].length * 12, photoSize = 'large') => {
  const positioned = nodes.filter(node => Number.isFinite(node.x) && Number.isFinite(node.y));
  if (!positioned.length || width < 64 || height < 64) return null;
  const boundsAt = (zoom) => {
    const fontScale = Math.max(0.78, Math.min(1, zoom));
    const bounds = { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
    for (const node of positioned) {
      const radius = networkNodeRadius(node, photoSize);
      const halfWidth = Math.max(radius * 1.5 * zoom, measureLabel(node.name, node.type.includes('current')) * fontScale / 2 + 6);
      const halfHeight = radius * 1.5 * zoom + 28;
      bounds.left = Math.min(bounds.left, node.x * zoom - halfWidth);
      bounds.right = Math.max(bounds.right, node.x * zoom + halfWidth);
      bounds.top = Math.min(bounds.top, node.y * zoom - halfHeight);
      bounds.bottom = Math.max(bounds.bottom, node.y * zoom + halfHeight);
    }
    return bounds;
  };
  let low = 0.01;
  let high = 2.1;
  for (let i = 0; i < 32; i += 1) {
    const mid = (low + high) / 2;
    const b = boundsAt(mid);
    if (b.right - b.left <= width - 32 && b.bottom - b.top <= height - 32) low = mid;
    else high = mid;
  }
  const bounds = boundsAt(low);
  return { zoom: low, x: (bounds.left + bounds.right) / (2 * low), y: (bounds.top + bounds.bottom) / (2 * low), bounds };
};
