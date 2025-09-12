// Fetch latest Instagram permalinks via Graph API and write to public/instagram_posts.txt
// Requirements:
// - Repo secrets: IG_ACCESS_TOKEN, IG_USER_ID
// - Optional env: POST_LIMIT (default 10)

import fs from 'fs';
import path from 'path';
import https from 'https';

const token = process.env.IG_ACCESS_TOKEN || '';
const userId = process.env.IG_USER_ID || '';
const limit = parseInt(process.env.POST_LIMIT || '10', 10);

if (!token || !userId) {
  console.log('[instagram] IG_ACCESS_TOKEN or IG_USER_ID not set. Skipping update.');
  process.exit(0);
}

const apiVersion = 'v20.0';
const fields = ['permalink', 'media_type', 'timestamp'].join(',');
const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(userId)}/media?fields=${fields}&limit=${limit}&access_token=${encodeURIComponent(token)}`;

console.log('[instagram] Fetching:', url.replace(token, '***')); // mask token

function fetchJson(targetUrl) {
  return new Promise((resolve, reject) => {
    https
      .get(targetUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json);
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}\nResponse: ${data.slice(0, 200)}...`));
          }
        });
      })
      .on('error', (err) => reject(err));
  });
}

try {
  const json = await fetchJson(url);
  if (!json || !Array.isArray(json.data)) {
    console.log('[instagram] Unexpected API response:', JSON.stringify(json).slice(0, 500));
    process.exit(0);
  }

  // Keep only valid permalinks (p/, reel/, tv/)
  const valid = json.data
    .map((item) => item?.permalink || '')
    .filter((p) => /https?:\/\/(www\.)?instagram\.com\/(p|reel|tv)\//.test(p));

  const dest = path.join(process.cwd(), 'public', 'instagram_posts.txt');
  const nextContent = valid.join('\n') + (valid.length ? '\n' : '');
  let current = '';
  try {
    current = fs.readFileSync(dest, 'utf-8');
  } catch {}

  if (current === nextContent) {
    console.log('[instagram] No changes in instagram_posts.txt');
  } else {
    fs.writeFileSync(dest, nextContent, 'utf-8');
    console.log(`[instagram] Updated instagram_posts.txt with ${valid.length} links`);
  }
} catch (e) {
  console.error('[instagram] Error:', e.message);
  process.exit(1);
}

