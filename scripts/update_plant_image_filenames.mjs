#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const plantDir = path.join('public', 'images', 'plants');
const outputFile = path.join('public', 'plant_image_filenames.txt');

if (!fs.existsSync(plantDir)) {
  console.error(`Plant images directory not found: ${plantDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(plantDir, { withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => entry.name)
  .filter((file) => file.match(/\.(jpg|jpeg|png|gif|webp)$/i))
  .map((file) => file.replace(/\.[^.]+$/, ''))
  .sort((a, b) => a.localeCompare(b, 'ja'));

fs.writeFileSync(outputFile, files.join('\n') + '\n', 'utf8');
console.log(`Updated ${outputFile} with ${files.length} entries.`);
