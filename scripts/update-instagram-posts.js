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

const ACCESS_TOKEN = process.env.IG_ACCESS_TOKEN;
const USER_ID = process.env.IG_USER_ID;
const POST_LIMIT = Math.max(1, parseInt(process.env.POST_LIMIT || '10', 10) || 10);

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const isPostPermalink = (url) =>
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(url || '');

const main = async () => {
  ensureDir(PUBLIC_DIR);

  if (!ACCESS_TOKEN || !USER_ID) {
    console.warn('[instagram] Missing IG_ACCESS_TOKEN or IG_USER_ID. Skipping update.');
    process.exit(0);
  }

  const limit = String(Math.max(POST_LIMIT, 20));
  const fields = 'id,media_type,permalink,media_url,thumbnail_url,caption,timestamp';
  const endpoints = [
    // Instagram Graph API (Business/Creator via Facebook Graph)
    `https://graph.facebook.com/v19.0/${USER_ID}/media?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}&limit=${limit}`,
    // Instagram Basic Display API
    `https://graph.instagram.com/${USER_ID}/media?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}&limit=${limit}`,
    // Basic Display "me" fallback (some tokens only allow /me)
    `https://graph.instagram.com/me/media?fields=${fields}&access_token=${encodeURIComponent(ACCESS_TOKEN)}&limit=${limit}`,
  ];

  let json = null;
  const errors = [];
  for (const url of endpoints) {
    const res = await fetch(url);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      errors.push(`[instagram] ${res.status} ${res.statusText} ${text}`.trim());
      continue;
    }
    json = await res.json();
    if (Array.isArray(json?.data)) break;
  }
  if (!json || !Array.isArray(json?.data)) {
    throw new Error(`[instagram] Fetch failed. ${errors.join(' | ')}`.trim());
  }

  const items = json.data;

  const urls = items
    .map((item) => (typeof item?.permalink === 'string' ? item.permalink.trim() : ''))
    .filter((url) => isPostPermalink(url));

  const unique = Array.from(new Set(urls)).slice(0, POST_LIMIT);
  const posts = [];
  const seenPermalinks = new Set();
  items.forEach((item) => {
    const permalink = typeof item?.permalink === 'string' ? item.permalink.trim() : '';
    if (!isPostPermalink(permalink) || seenPermalinks.has(permalink)) return;
    seenPermalinks.add(permalink);
    posts.push({
      id: item?.id || null,
      permalink,
      media_type: item?.media_type || null,
      media_url: item?.media_url || null,
      thumbnail_url: item?.thumbnail_url || null,
      caption: item?.caption || null,
      timestamp: item?.timestamp || null,
    });
  });

  if (unique.length === 0) {
    const existing = fs.existsSync(OUT_POSTS)
      ? fs.readFileSync(OUT_POSTS, 'utf-8').trim()
      : '';
    if (existing) {
      console.warn('[instagram] No new URLs found; keeping existing instagram_posts.txt');
      process.exit(0);
    }
  }

  fs.writeFileSync(OUT_POSTS, unique.join('\n') + (unique.length ? '\n' : ''), 'utf-8');
  fs.writeFileSync(OUT_LATEST, unique[0] ? `${unique[0]}\n` : '', 'utf-8');
  fs.writeFileSync(
    OUT_JSON,
    JSON.stringify(posts.slice(0, POST_LIMIT), null, 2) + '\n',
    'utf-8',
  );

  console.log(`[instagram] Wrote ${unique.length} post URL(s) to ${path.relative(ROOT, OUT_POSTS)}`);
  console.log(`[instagram] Latest URL ${unique[0] ? 'set' : 'empty'} in ${path.relative(ROOT, OUT_LATEST)}`);
  console.log(`[instagram] Wrote ${Math.min(posts.length, POST_LIMIT)} post record(s) to ${path.relative(ROOT, OUT_JSON)}`);
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
