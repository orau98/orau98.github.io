import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const OUT_POSTS = path.join(PUBLIC_DIR, 'instagram_posts.txt');
const OUT_LATEST = path.join(PUBLIC_DIR, 'instagram_latest.txt');
const OUT_JSON = path.join(PUBLIC_DIR, 'instagram_posts.json');
const OUT_MEDIA_DIR = path.join(PUBLIC_DIR, 'instagram');

const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const USER_ID = process.env.IG_USER_ID;
const IG_USERNAME = process.env.IG_USERNAME;
const POST_LIMIT = Math.max(1, parseInt(process.env.POST_LIMIT || '10', 10) || 10);
const REQUEST_RETRY_LIMIT = Math.max(0, parseInt(process.env.IG_REQUEST_RETRY_LIMIT || '2', 10) || 2);
const CACHE_MAX_AGE_HOURS = (() => {
  const parsed = Number.parseFloat(process.env.IG_CACHE_MAX_AGE_HOURS || '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
})();
const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const USERNAME_PATTERN = /^[A-Za-z0-9._]+$/;
const MAX_RETRY_WAIT_MS = 15000;

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const clampRetryWaitMs = (ms) => {
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.min(Math.trunc(ms), MAX_RETRY_WAIT_MS));
};

const parseRetryAfterMs = (raw) => {
  if (!raw) return 0;
  const text = String(raw).trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) {
    return clampRetryWaitMs(Number(text) * 1000);
  }
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return 0;
  return clampRetryWaitMs(at - Date.now());
};

const fetchWithRetry = async (url, options = {}, { label = 'request', retries = REQUEST_RETRY_LIMIT } = {}) => {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, options);
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === retries) return res;

      const retryAfterMs = parseRetryAfterMs(res.headers.get('retry-after'));
      const waitMs = retryAfterMs || clampRetryWaitMs(1500 * (attempt + 1));
      console.warn(
        `[instagram] ${label} throttled (${res.status} ${res.statusText}). retry ${attempt + 1}/${retries} in ${waitMs}ms`,
      );
      await sleep(waitMs);
    } catch (error) {
      if (attempt === retries) throw error;
      const waitMs = clampRetryWaitMs(1500 * (attempt + 1));
      console.warn(
        `[instagram] ${label} network error. retry ${attempt + 1}/${retries} in ${waitMs}ms: ${error?.message || error}`,
      );
      await sleep(waitMs);
    }
  }
  throw new Error(`[instagram] ${label} failed after retry exhaustion`);
};

const normalizeUsername = (raw) => {
  const cleaned = String(raw || '').trim().replace(/^@/, '');
  if (!cleaned) return '';
  const normalized = cleaned.split(/[/?#]/)[0];
  if (!USERNAME_PATTERN.test(normalized)) return '';
  return normalized;
};

const isPostPermalink = (url) =>
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(url || '');

const parseTimestampToMs = (value) => {
  if (value == null) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value > 1e12) return Math.trunc(value);
    if (value > 1e9) return Math.trunc(value * 1000);
    return 0;
  }
  const text = String(value).trim();
  if (!text) return 0;
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) {
      if (n > 1e12) return Math.trunc(n);
      if (n > 1e9) return Math.trunc(n * 1000);
    }
    return 0;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoTimestamp = (...values) => {
  for (const value of values) {
    const ms = parseTimestampToMs(value);
    if (!ms) continue;
    try {
      return new Date(ms).toISOString();
    } catch {
      // continue
    }
  }
  return null;
};

const getPostTimestampMs = (post) =>
  parseTimestampToMs(post?.timestamp) ||
  parseTimestampToMs(post?.taken_at) ||
  parseTimestampToMs(post?.takenAt) ||
  parseTimestampToMs(post?.taken_at_timestamp) ||
  parseTimestampToMs(post?.takenAtTimestamp) ||
  0;

const parseUsernameFromInstagramUrl = (url) => {
  if (!/^https?:\/\/(www\.)?instagram\.com\//.test(url || '')) return '';
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return '';
    const first = parts[0];
    if (first === 'p' || first === 'reel' || first === 'tv') return '';
    if (parts.length >= 3 && (parts[1] === 'p' || parts[1] === 'reel' || parts[1] === 'tv')) {
      return normalizeUsername(first);
    }
    return normalizeUsername(first);
  } catch {
    return '';
  }
};

const loadExistingUrls = () => {
  const out = [];
  if (fs.existsSync(OUT_LATEST)) {
    const latest = fs.readFileSync(OUT_LATEST, 'utf-8').trim();
    if (latest) out.push(latest);
  }
  if (fs.existsSync(OUT_POSTS)) {
    const lines = fs.readFileSync(OUT_POSTS, 'utf-8')
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    out.push(...lines);
  }
  if (fs.existsSync(OUT_JSON)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(OUT_JSON, 'utf-8'));
      const posts = Array.isArray(parsed) ? parsed : parsed?.posts;
      if (Array.isArray(posts)) {
        posts.forEach((post) => {
          const permalink = typeof post?.permalink === 'string' ? post.permalink.trim() : '';
          if (permalink) out.push(permalink);
        });
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return Array.from(new Set(out)).filter((url) => /^https?:\/\/(www\.)?instagram\.com\//.test(url));
};

const loadExistingCacheInfo = () => {
  const urls = loadExistingUrls();
  let postCount = 0;
  let generatedAt = '';
  if (fs.existsSync(OUT_JSON)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(OUT_JSON, 'utf-8'));
      const posts = Array.isArray(parsed) ? parsed : parsed?.posts;
      if (Array.isArray(posts)) postCount = posts.length;
      generatedAt = typeof parsed?.generatedAt === 'string' ? parsed.generatedAt : '';
    } catch {
      // ignore malformed JSON
    }
  }
  return { urlCount: urls.length, postCount, generatedAt };
};

const getCacheAgeHours = (generatedAt = '') => {
  const generatedMs = Date.parse(generatedAt);
  if (!Number.isFinite(generatedMs)) return Infinity;
  return Math.max(0, (Date.now() - generatedMs) / 3600000);
};

const extractUsernameFromPostHtml = (html = '') => {
  if (!html) return '';
  const patterns = [
    /property="og:url"\s+content="https:\/\/www\.instagram\.com\/([^/"?#]+)\/(?:p|reel|tv)\//i,
    /property="og:description"\s+content="[^"]*\((?:@|&#064;)([^)"\s]+)\)/i,
    /name="description"\s+content="[^"]*\((?:@|&#064;)([^)"\s]+)\)/i,
    /name="description"\s+content="[^"]*-\s*([A-Za-z0-9._]+)\s+on\s+/i,
    /A post shared by [^(]+\(\s*(?:@|&#064;)([A-Za-z0-9._]+)\s*\)/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const normalized = normalizeUsername(match[1]);
      if (normalized) return normalized;
    }
  }
  return '';
};

const resolveUsernameFromOembed = async (postUrl) => {
  if (!isPostPermalink(postUrl)) return '';
  try {
    const endpoint = `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(postUrl)}`;
    const res = await fetchWithRetry(endpoint, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json',
        'Referer': postUrl,
      },
    }, { label: 'Instagram oEmbed' });
    if (!res.ok) return '';
    const data = await res.json().catch(() => null);
    const fromAuthorName = normalizeUsername(data?.author_name);
    if (fromAuthorName) return fromAuthorName;
    const fromAuthorUrl = parseUsernameFromInstagramUrl(data?.author_url || '');
    if (fromAuthorUrl) return fromAuthorUrl;
    const html = typeof data?.html === 'string' ? data.html : '';
    const fromHtml = extractUsernameFromPostHtml(html);
    if (fromHtml) return fromHtml;
    return '';
  } catch {
    return '';
  }
};

const resolveInstagramUsername = async () => {
  const envUsername = normalizeUsername(IG_USERNAME);
  if (envUsername) return envUsername;
  const seedUrls = loadExistingUrls();
  for (const url of seedUrls) {
    const usernameFromUrl = parseUsernameFromInstagramUrl(url);
    if (usernameFromUrl) return usernameFromUrl;
  }
  for (const url of seedUrls) {
    if (!isPostPermalink(url)) continue;
    const oembedUsername = await resolveUsernameFromOembed(url);
    if (oembedUsername) return oembedUsername;
  }
  for (const url of seedUrls) {
    if (!isPostPermalink(url)) continue;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        redirect: 'follow',
      });
      if (!res.ok) continue;
      const html = await res.text();
      const username = extractUsernameFromPostHtml(html);
      if (username) return username;
    } catch {
      // ignore and try next seed
    }
  }
  return '';
};

const getCaptionText = (node) => {
  const edgeCaption = node?.edge_media_to_caption?.edges;
  if (Array.isArray(edgeCaption) && edgeCaption[0]?.node?.text) {
    return edgeCaption[0].node.text;
  }
  return null;
};

const mapWebProfileMediaType = (typename = '') => {
  if (typename === 'GraphVideo') return 'VIDEO';
  if (typename === 'GraphSidecar') return 'CAROUSEL_ALBUM';
  return 'IMAGE';
};

const fetchPostsFromPublicProfile = async (username, limit) => {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) throw new Error('[instagram] Public profile fallback failed: username is empty');
  const url = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(normalizedUsername)}`;
  const res = await fetchWithRetry(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'x-ig-app-id': '936619743392459',
      'Accept': 'application/json',
      'Referer': `https://www.instagram.com/${normalizedUsername}/`,
      'Accept-Language': 'en-US,en;q=0.9',
      'x-asbd-id': '129477',
    },
  }, { label: `public profile @${normalizedUsername}` });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[instagram] Public profile fallback failed: ${res.status} ${res.statusText} ${text}`.trim());
  }
  const json = await res.json();
  const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges;
  if (!Array.isArray(edges) || edges.length === 0) {
    throw new Error('[instagram] Public profile fallback failed: timeline media is empty');
  }
  const mapped = edges
    .map((edge) => edge?.node)
    .filter(Boolean)
    .slice(0, limit)
    .map((node) => {
      const shortcode = node?.shortcode ? String(node.shortcode) : '';
      const mediaUrl = node?.display_url || node?.thumbnail_src || '';
      const timestamp = Number.isFinite(node?.taken_at_timestamp)
        ? new Date(node.taken_at_timestamp * 1000).toISOString()
        : null;
      return {
        id: shortcode || String(node?.id || ''),
        media_type: mapWebProfileMediaType(node?.__typename),
        permalink: shortcode ? `https://www.instagram.com/p/${shortcode}/` : '',
        media_url: mediaUrl || null,
        thumbnail_url: (node?.thumbnail_src || mediaUrl) || null,
        caption: getCaptionText(node),
        timestamp,
      };
    })
    .filter((item) => isPostPermalink(item.permalink));
  return mapped.sort((a, b) => getPostTimestampMs(b) - getPostTimestampMs(a));
};

const loadExistingMedia = () => {
  const map = new Map();
  if (!fs.existsSync(OUT_MEDIA_DIR)) return map;
  fs.readdirSync(OUT_MEDIA_DIR).forEach((file) => {
    const match = file.match(/^(.+?)\.[^.]+$/);
    if (!match) return;
    map.set(match[1], `/instagram/${file}`);
  });
  return map;
};

const guessExtension = (contentType, url) => {
  const type = String(contentType || '').toLowerCase();
  if (type.includes('image/png')) return '.png';
  if (type.includes('image/webp')) return '.webp';
  if (type.includes('image/gif')) return '.gif';
  if (type.includes('image/jpeg') || type.includes('image/jpg')) return '.jpg';
  if (type.includes('image/avif')) return '.avif';
  const parsed = String(url || '').split('?')[0];
  const extMatch = parsed.match(/\.(png|webp|gif|jpe?g|avif)$/i);
  if (extMatch) return `.${extMatch[1].toLowerCase()}`;
  return '.jpg';
};

const pickMediaUrl = (item) => {
  const type = String(item?.media_type || '').toUpperCase();
  if (type === 'VIDEO' || type === 'REEL') {
    return item?.thumbnail_url || item?.media_url || '';
  }
  return item?.media_url || item?.thumbnail_url || '';
};

const downloadMedia = async (url, id, existingMedia) => {
  if (!url || !id) return null;
  if (existingMedia.has(id)) return existingMedia.get(id);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    const ext = guessExtension(contentType, url);
    const filename = `${id}${ext}`;
    const destPath = path.join(OUT_MEDIA_DIR, filename);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (!buffer.length) return null;
    fs.writeFileSync(destPath, buffer);
    const rel = `/instagram/${filename}`;
    existingMedia.set(id, rel);
    return rel;
  } catch {
    return null;
  }
};

const main = async () => {
  ensureDir(PUBLIC_DIR);
  ensureDir(OUT_MEDIA_DIR);

  const minFetchCount = Math.max(POST_LIMIT, 20);
  let items = [];
  let fetchSource = 'graph-api';
  const errors = [];

  if (ACCESS_TOKEN && USER_ID) {
    const limit = String(minFetchCount);
    const fields = 'id,media_type,permalink,media_url,thumbnail_url,caption,timestamp';
    const endpoints = [
      // Instagram Graph API (Business/Creator via Facebook Graph)
      `https://graph.facebook.com/v19.0/${USER_ID}/media?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}&limit=${limit}`,
      // Instagram Basic Display API
      `https://graph.instagram.com/${USER_ID}/media?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}&limit=${limit}`,
      // Basic Display "me" fallback (some tokens only allow /me)
      `https://graph.instagram.com/me/media?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}&limit=${limit}`,
    ];

    for (const url of endpoints) {
      const res = await fetchWithRetry(url, {}, { label: 'Instagram Graph API' });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        errors.push(`[instagram] ${res.status} ${res.statusText} ${text}`.trim());
        continue;
      }
      const json = await res.json();
      if (Array.isArray(json?.data)) {
        items = json.data;
        break;
      }
    }
  } else {
    errors.push('[instagram] Missing IG_ACCESS_TOKEN or IG_USER_ID');
  }

  if (items.length === 0) {
    if (errors.length > 0) {
      console.warn(errors.join(' | '));
    }
    const username = await resolveInstagramUsername();
    if (!username) {
      throw new Error(`[instagram] Fetch failed. ${errors.join(' | ')} | Could not resolve Instagram username for public fallback.`.trim());
    }
    console.warn(`[instagram] Falling back to public profile scraping for @${username}`);
    items = await fetchPostsFromPublicProfile(username, minFetchCount);
    fetchSource = 'public-profile-fallback';
  }

  items = [...items].sort((a, b) => getPostTimestampMs(b) - getPostTimestampMs(a));

  const urls = items
    .map((item) => (typeof item?.permalink === 'string' ? item.permalink.trim() : ''))
    .filter((url) => isPostPermalink(url));

  const unique = Array.from(new Set(urls)).slice(0, POST_LIMIT);
  const existingMedia = loadExistingMedia();
  const posts = [];
  const seenPermalinks = new Set();
  for (const item of items) {
    if (posts.length >= POST_LIMIT) break;
    const permalink = typeof item?.permalink === 'string' ? item.permalink.trim() : '';
    if (!isPostPermalink(permalink) || seenPermalinks.has(permalink)) continue;
    seenPermalinks.add(permalink);
    const id = item?.id || null;
    const mediaUrl = pickMediaUrl(item);
    const localUrl = await downloadMedia(mediaUrl, id, existingMedia);
    const normalizedTimestamp = toIsoTimestamp(
      item?.timestamp,
      item?.taken_at,
      item?.takenAt,
      item?.taken_at_timestamp,
      item?.takenAtTimestamp,
    );
    posts.push({
      id,
      permalink,
      media_type: item?.media_type || null,
      media_url: item?.media_url || null,
      thumbnail_url: item?.thumbnail_url || null,
      local_url: localUrl,
      caption: item?.caption || null,
      timestamp: normalizedTimestamp,
    });
  }

  const validIds = new Set(posts.map((post) => post.id).filter(Boolean));
  if (fs.existsSync(OUT_MEDIA_DIR)) {
    fs.readdirSync(OUT_MEDIA_DIR).forEach((file) => {
      const match = file.match(/^(.+?)\.[^.]+$/);
      if (!match) return;
      if (!validIds.has(match[1])) {
        fs.unlinkSync(path.join(OUT_MEDIA_DIR, file));
      }
    });
  }

  if (unique.length === 0) {
    const existing = fs.existsSync(OUT_POSTS)
      ? fs.readFileSync(OUT_POSTS, 'utf-8').trim()
      : '';
    if (existing) {
      console.warn('[instagram] No new URLs found; keeping existing instagram_posts.txt');
      process.exit(0);
    }
  }

  const limitedPosts = posts.slice(0, POST_LIMIT);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: fetchSource,
    count: limitedPosts.length,
    posts: limitedPosts,
  };

  fs.writeFileSync(OUT_POSTS, unique.join('\n') + (unique.length ? '\n' : ''), 'utf-8');
  fs.writeFileSync(OUT_LATEST, unique[0] ? `${unique[0]}\n` : '', 'utf-8');
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(payload, null, 2) + '\n',
    'utf-8',
  );

  console.log(`[instagram] Wrote ${unique.length} post URL(s) to ${path.relative(ROOT, OUT_POSTS)}`);
  console.log(`[instagram] Latest URL ${unique[0] ? 'set' : 'empty'} in ${path.relative(ROOT, OUT_LATEST)}`);
  console.log(`[instagram] Wrote ${limitedPosts.length} post record(s) to ${path.relative(ROOT, OUT_JSON)}`);
};

main().catch((err) => {
  const message = err?.message || String(err);
  const cache = loadExistingCacheInfo();
  const hasCache = cache.urlCount > 0 || cache.postCount > 0;
  const cacheAgeHours = getCacheAgeHours(cache.generatedAt);
  if (message.includes('[instagram]') && hasCache && cacheAgeHours <= CACHE_MAX_AGE_HOURS) {
    const cacheAge = cache.generatedAt ? `, last successful refresh ${cache.generatedAt}` : '';
    console.warn(message);
    console.warn(
      `[instagram] Keeping existing cached data (${cache.urlCount} URL(s), ${cache.postCount} post(s)${cacheAge}).`,
    );
    process.exit(0);
  }
  if (message.includes('[instagram]') && hasCache) {
    console.error(message);
    console.error(
      `[instagram] Existing cached data is stale (${cacheAgeHours === Infinity ? 'unknown' : cacheAgeHours.toFixed(1)}h old, max ${CACHE_MAX_AGE_HOURS}h). Failing the workflow so the feed does not silently stay old.`,
    );
    process.exit(1);
  }
  console.error(message);
  process.exit(1);
});
