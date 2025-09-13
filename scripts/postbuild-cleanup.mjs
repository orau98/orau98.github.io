#!/usr/bin/env node
// Remove non-public/development artifacts from the built output to keep Pages lean
import fs from 'fs';
import path from 'path';

const targets = [
  path.join('dist', 'images', 'insects', 'backup_japanese_names'),
  path.join('dist', 'image_filenames.txt'),
  path.join('dist', 'plant_image_filenames.txt'),
  path.join('dist', 'image_extensions.json'),
];

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

