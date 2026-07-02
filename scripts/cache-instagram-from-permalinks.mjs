import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");

const POSTS_TXT = path.join(PUBLIC_DIR, "instagram_posts.txt");
const POSTS_JSON = path.join(PUBLIC_DIR, "instagram_posts.json");
const OUT_DIR = path.join(PUBLIC_DIR, "instagram");

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const isPostPermalink = (url) =>
  /^https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(url || "");

const shortcodeFromPermalink = (permalink) => {
  try {
    const url = new URL(permalink);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length >= 2 ? parts[1] : "";
  } catch {
    return "";
  }
};

const guessExtension = (contentType, url) => {
  const type = String(contentType || "").toLowerCase();
  if (type.includes("image/png")) return ".png";
  if (type.includes("image/webp")) return ".webp";
  if (type.includes("image/gif")) return ".gif";
  if (type.includes("image/jpeg") || type.includes("image/jpg")) return ".jpg";
  if (type.includes("image/avif")) return ".avif";
  const parsed = String(url || "").split("?")[0];
  const extMatch = parsed.match(/\.(png|webp|gif|jpe?g|avif)$/i);
  if (extMatch) return `.${extMatch[1].toLowerCase()}`;
  return ".jpg";
};

const loadExistingJson = () => {
  if (!fs.existsSync(POSTS_JSON)) return [];
  try {
    const raw = fs.readFileSync(POSTS_JSON, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
};

// ギャラリーは2カラムの正方形サムネイル表示なので原寸（1MB超）は不要。
// 長辺640pxに縮小してから保存する（失敗時は原寸のまま保存）。
const MAX_IMAGE_DIMENSION = 640;
export const optimizeImageBuffer = async (buffer, ext) => {
  try {
    const base = sharp(buffer)
      .rotate()
      .resize({
        width: MAX_IMAGE_DIMENSION,
        height: MAX_IMAGE_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      });
    let optimized;
    if (ext === ".png") optimized = await base.png().toBuffer();
    else if (ext === ".webp") optimized = await base.webp({ quality: 78 }).toBuffer();
    else if (ext === ".jpg" || ext === ".jpeg")
      optimized = await base.jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    else return buffer; // gif/avif等はそのまま（アニメーション保持）
    return optimized.length < buffer.length ? optimized : buffer;
  } catch {
    return buffer;
  }
};

const downloadImage = async (permalink, shortcode) => {
  if (!permalink || !shortcode) return "";
  const mediaUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;
  const res = await fetch(mediaUrl, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  const ext = guessExtension(contentType, mediaUrl);
  const filename = `${shortcode}${ext}`;
  const dest = path.join(OUT_DIR, filename);
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!buffer.length) throw new Error("empty response");
  fs.writeFileSync(dest, await optimizeImageBuffer(buffer, ext));
  return `/instagram/${filename}`;
};

const main = async () => {
  if (!fs.existsSync(POSTS_TXT)) {
    console.warn("[instagram-cache] instagram_posts.txt not found; skipping.");
    return;
  }
  ensureDir(OUT_DIR);

  const urls = fs
    .readFileSync(POSTS_TXT, "utf-8")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => isPostPermalink(s));

  const uniqueUrls = Array.from(new Set(urls)).slice(0, 12);
  const existing = loadExistingJson();
  const byPermalink = new Map(existing.map((post) => [post?.permalink, post]));

  const results = [];
  for (const permalink of uniqueUrls) {
    const shortcode = shortcodeFromPermalink(permalink);
    if (!shortcode) continue;
    const prev = byPermalink.get(permalink) || {};
    let localUrl = prev.local_url || prev.localUrl || "";
    try {
      localUrl = await downloadImage(permalink, shortcode);
      console.log(`[instagram-cache] cached ${shortcode}`);
    } catch (err) {
      console.warn(
        `[instagram-cache] failed ${shortcode}: ${err?.message || err}`,
      );
    }
    results.push({
      ...prev,
      id: prev.id || shortcode,
      permalink,
      local_url: localUrl || prev.local_url || prev.localUrl || "",
    });
  }

  fs.writeFileSync(POSTS_JSON, `${JSON.stringify(results, null, 2)}\n`, "utf-8");
  console.log(
    `[instagram-cache] wrote ${results.length} records to public/instagram_posts.json`,
  );
};

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

