import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

const normalizedPath = path.join(ROOT, 'normalized_data', 'insects.csv');
const publicPath = path.join(ROOT, 'public', 'insects.csv');

if (!fs.existsSync(normalizedPath)) {
  console.warn('[sync-public-insects-csv] normalized_data/insects.csv not found; skipping.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(publicPath), { recursive: true });
fs.copyFileSync(normalizedPath, publicPath);
console.log(`[sync-public-insects-csv] synced ${path.relative(ROOT, publicPath)} from normalized_data/insects.csv`);
