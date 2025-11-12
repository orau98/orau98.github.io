#!/usr/bin/env node
// Remove non-public/development artifacts from the built output to keep Pages lean
import fs from 'fs';
import path from 'path';

const targets = [
  path.join('dist', 'images', 'insects', 'backup_japanese_names'),
  // Keep small index files for client-side image detection
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
