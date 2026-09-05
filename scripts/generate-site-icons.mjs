import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(ROOT, 'assets/brand/logo-c1-source.png');
const output = path.join(ROOT, 'public');

// Export the approved C1 pixels; do not redraw the leaf or its feeding damage.
// Only the connected presentation background outside the teal tile is removed.
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const visited = new Uint8Array(width * height);
const queue = new Int32Array(width * height);
let head = 0;
let tail = 0;
const enqueue = (x, y) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const pixel = y * width + x;
  if (visited[pixel]) return;
  visited[pixel] = 1;
  const i = pixel * 4;
  if (data[i] < 170 || data[i + 1] < 170 || data[i + 2] < 150 || data[i + 1] - data[i] > 30) return;
  data[i + 3] = 0;
  queue[tail++] = pixel;
};
for (let x = 0; x < width; x++) { enqueue(x, 0); enqueue(x, height - 1); }
for (let y = 0; y < height; y++) { enqueue(0, y); enqueue(width - 1, y); }
while (head < tail) {
  const pixel = queue[head++];
  const x = pixel % width;
  const y = Math.floor(pixel / width);
  enqueue(x - 1, y); enqueue(x + 1, y); enqueue(x, y - 1); enqueue(x, y + 1);
}
// Fixed, reviewed crop includes a two-pixel antialias margin around the C1 tile.
const master = await sharp(data, { raw: { width, height, channels: 4 } })
  .extract({ left: 178, top: 167, width: 899, height: 888 })
  .png().toBuffer();
const pngAt = (size, opaque = false) => {
  let image = sharp(master).resize(size, size, {
    fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3',
  });
  if (opaque) image = image.flatten({ background: '#faf6ed' });
  return image.png({ compressionLevel: 9 }).toBuffer();
};
await fs.mkdir(output, { recursive: true });
for (const size of [48, 192, 512]) {
  await fs.writeFile(path.join(output, `favicon-${size}.png`), await pngAt(size));
}
await fs.writeFile(path.join(output, 'apple-touch-icon.png'), await pngAt(180, true));

// SVG keeps the approved raster artwork self-contained; it is not a retraced logo.
const embedded = (await pngAt(192)).toString('base64');
await fs.writeFile(path.join(output, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192" role="img" aria-label="昆虫植物図鑑 — 食痕のある葉"><image width="192" height="192" href="data:image/png;base64,${embedded}"/></svg>\n`);

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map((size) => pngAt(size)));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await fs.writeFile(path.join(output, 'favicon.ico'), Buffer.concat([header, ...images]));
console.log('Exported C1: 48/192/512px PNG, 180px Apple icon, SVG wrapper, 16/32/48px ICO.');
