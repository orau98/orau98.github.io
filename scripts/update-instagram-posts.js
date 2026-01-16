import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const OUT_POSTS = path.join(PUBLIC_DIR, 'instagram_posts.txt');
const OUT_LATEST = path.join(PUBLIC_DIR, 'instagram_latest.txt');

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

  const endpoint = new URL(`https://graph.instagram.com/${USER_ID}/media`);
  endpoint.searchParams.set('fields', 'id,media_type,permalink,timestamp');
  endpoint.searchParams.set('access_token', ACCESS_TOKEN);
  endpoint.searchParams.set('limit', String(Math.max(POST_LIMIT, 20)));

  const res = await fetch(endpoint.toString());
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[instagram] Fetch failed: ${res.status} ${res.statusText} ${text}`);
  }

  const json = await res.json();
  const items = Array.isArray(json?.data) ? json.data : [];

  const urls = items
    .map((item) => (typeof item?.permalink === 'string' ? item.permalink.trim() : ''))
    .filter((url) => isPostPermalink(url));

  const unique = Array.from(new Set(urls)).slice(0, POST_LIMIT);

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

  console.log(`[instagram] Wrote ${unique.length} post URL(s) to ${path.relative(ROOT, OUT_POSTS)}`);
  console.log(`[instagram] Latest URL ${unique[0] ? 'set' : 'empty'} in ${path.relative(ROOT, OUT_LATEST)}`);
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
