import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

function readText(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '';
}
function readJson(p) {
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null;
}

function main() {
  const namesTxt = readText(path.join(PUBLIC_DIR, 'image_filenames.txt'));
  const extsJson = readJson(path.join(PUBLIC_DIR, 'image_extensions.json')) || {};
  const names = namesTxt.split('\n').map(s => s.trim()).filter(Boolean);

  const outDir = path.join(PUBLIC_DIR, 'assets', 'data-lite');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'image-index.json');
  fs.writeFileSync(outPath, JSON.stringify({ names, exts: extsJson }));
  const size = fs.statSync(outPath).size;
  console.log('[image-index] wrote', outPath, `size=${size} bytes`);
}

main();

