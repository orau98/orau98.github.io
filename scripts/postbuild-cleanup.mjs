#!/usr/bin/env node
// Remove non-public/development artifacts from the built output to keep Pages lean
import fs from 'fs';
import path from 'path';

const MAX_PAGES_DIST_BYTES = 900 * 1024 * 1024;
const targets = [
  // Serve only generated responsive insect images on GitHub Pages.
  path.join('dist', 'images', 'insects'),
];

const syncPlantImages = () => {
  const srcDir = path.join('public', 'images', 'plants');
  const destDir = path.join('dist', 'images', 'plants');
  try {
    if (!fs.existsSync(srcDir) || !fs.existsSync(destDir)) return;
    const srcFiles = fs.readdirSync(srcDir);
    const destFiles = new Set(fs.readdirSync(destDir));
    let copied = 0;
    for (const file of srcFiles) {
      const srcPath = path.join(srcDir, file);
      const destPath = path.join(destDir, file);
      const stat = fs.statSync(srcPath);
      if (!stat.isFile()) continue;
      if (!destFiles.has(file)) {
        fs.copyFileSync(srcPath, destPath);
        copied++;
      }
    }
    if (copied) {
      console.log(`[postbuild] Synced ${copied} plant image(s) missing from dist.`);
    }
  } catch (error) {
    console.warn('[postbuild] Failed to sync plant images:', error?.message || error);
  }
};

const ensureSpa404 = () => {
  try {
    const indexPath = path.join('dist', 'index.html');
    const targetPath = path.join('dist', '404.html');
    if (!fs.existsSync(indexPath)) return;
    const indexHtml = fs.readFileSync(indexPath, 'utf8');
    const noindexMeta = '    <meta name="robots" content="noindex, follow, max-image-preview:none">\n';
    const fallbackFlag = '    <script>window.__SEO_FORCE_NOINDEX__ = true; window.__IS_SPA_404__ = true;</script>\n';
    const htmlWithNoindex = indexHtml.replace(
      /<meta\s+name="robots"\s+content="[^"]*"\s*>/i,
      noindexMeta.trimEnd(),
    );
    const targetHtml = htmlWithNoindex.replace('</head>', `${fallbackFlag}  </head>`);
    fs.writeFileSync(targetPath, targetHtml, 'utf8');
    console.log('[postbuild] Synced SPA 404.html from index.html (no redirect hop).');
  } catch (error) {
    console.warn('[postbuild] Failed to sync SPA 404:', error?.message || error);
  }
};

const getDirectorySizeBytes = (dirPath) => {
  if (!fs.existsSync(dirPath)) return 0;
  let total = 0;
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    }
  }
  return total;
};

const formatMiB = (bytes) => `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;

const assertPagesSizeBudget = () => {
  const distDir = path.join('dist');
  const sizeBytes = getDirectorySizeBytes(distDir);
  console.log(`[postbuild] dist size after cleanup: ${formatMiB(sizeBytes)}`);
  if (sizeBytes > MAX_PAGES_DIST_BYTES) {
    throw new Error(
      `dist is still too large for GitHub Pages safety budget: ${formatMiB(sizeBytes)} > ${formatMiB(MAX_PAGES_DIST_BYTES)}.`,
    );
  }
};

for (const p of targets) {
  try {
    if (fs.existsSync(p)) {
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        fs.rmSync(p, { recursive: true, force: true });
        console.log('[postbuild] Removed dir:', p);
      } else {
        fs.rmSync(p, { force: true });
        console.log('[postbuild] Removed file:', p);
      }
    }
  } catch (e) {
    console.warn('[postbuild] Warning removing', p, e?.message || e);
  }
}

syncPlantImages();
ensureSpa404();
assertPagesSizeBudget();
