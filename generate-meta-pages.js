#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URL for the site
const BASE_URL = 'https://h-amoto.github.io/insects-host-plant-explorer';

// Function to escape HTML
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Function to generate HTML page with meta tags
const generateMetaPage = (data) => {
  const { title, description, url, type = 'website', image = null } = data;
  
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${type}">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  ${image ? `<meta property="og:image" content="${image}">` : ''}
  
  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${url}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(description)}">
  ${image ? `<meta property="twitter:image" content="${image}">` : ''}
  
  <!-- Canonical URL -->
  <link rel="canonical" href="${url}">
  
  <!-- Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "${escapeHtml(title)}",
    "description": "${escapeHtml(description)}",
    "url": "${url}",
    "publisher": {
      "@type": "Organization",
      "name": "昆虫と食草の図鑑",
      "url": "${BASE_URL}"
    }
  }
  </script>
  
  <!-- Redirect to main app -->
  <script>
    // Redirect to the main app with the correct hash
    const targetPath = window.location.pathname.replace('/meta', '');
    const hashPath = targetPath === '/' ? '/' : '#' + targetPath;
    window.location.replace('${BASE_URL}/' + hashPath);
  </script>
  
  <!-- Fallback meta refresh -->
  <meta http-equiv="refresh" content="0; url=${BASE_URL}/">
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(description)}</p>
  <p><a href="${BASE_URL}/">昆虫と食草の図鑑に移動</a></p>
</body>
</html>`;
};

async function generateMetaPages() {
  console.log('Starting meta pages generation...');
  
  const metaDir = path.join('public', 'meta');
  
  // Create meta directory
  if (!fs.existsSync(metaDir)) {
    fs.mkdirSync(metaDir, { recursive: true });
  }

  let generatedPages = 0;

  try {
    // Generate meta pages for moths
    if (fs.existsSync('public/ListMJ_hostplants_integrated_with_bokutou.csv')) {
      const csvData = fs.readFileSync('public/ListMJ_hostplants_integrated_with_bokutou.csv', 'utf8');
      const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: 'greedy'
      });

      console.log(`Generating meta pages for ${results.data.length} moths...`);

      results.data.forEach((row, index) => {
        const name = row['和名']?.trim();
        const scientificName = row['学名']?.trim();
        const hostPlants = row['食草']?.trim();
        
        if (!name || name === '日本産タマムシ大図鑑' || name.includes('大図鑑')) {
          return;
        }

        const id = `main-${index + 1}`;
        const title = scientificName ? `${name} (${scientificName}) - 昆虫図鑑` : `${name} - 昆虫図鑑`;
        const description = hostPlants && hostPlants !== '不明' ? 
          `${name}の詳細情報。食草: ${hostPlants.substring(0, 100)}${hostPlants.length > 100 ? '...' : ''}` :
          `${name}の詳細情報を掲載。昆虫と食草の関係を探る図鑑サイト。`;
        
        const url = `${BASE_URL}/meta/moth/${id}`;
        
        // Check if image exists
        const imagePath = scientificName ? 
          `${BASE_URL}/images/moths/${scientificName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '')}.jpg` : null;
        
        const html = generateMetaPage({
          title,
          description,
          url,
          type: 'article',
          image: imagePath
        });

        const mothDir = path.join(metaDir, 'moth');
        if (!fs.existsSync(mothDir)) {
          fs.mkdirSync(mothDir, { recursive: true });
        }

        fs.writeFileSync(path.join(mothDir, `${id}.html`), html, 'utf8');
        generatedPages++;
      });
    }

    // Generate meta pages for butterflies
    if (fs.existsSync('public/butterfly_host.csv')) {
      const csvData = fs.readFileSync('public/butterfly_host.csv', 'utf8');
      const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: 'greedy'
      });

      console.log(`Generating meta pages for ${results.data.length} butterflies...`);

      results.data.forEach((row, index) => {
        const name = row['和名']?.trim();
        const genus = row['属']?.trim();
        const species = row['種小名']?.trim();
        const scientificName = genus && species ? `${genus} ${species}` : '';
        const hostPlants = row['食草']?.trim();
        
        if (!name) return;

        const id = `butterfly-${index + 1}`;
        const title = scientificName ? `${name} (${scientificName}) - 蝶図鑑` : `${name} - 蝶図鑑`;
        const description = hostPlants ? 
          `${name}の詳細情報。食草: ${hostPlants.substring(0, 100)}${hostPlants.length > 100 ? '...' : ''}` :
          `${name}の詳細情報を掲載。蝶と食草の関係を探る図鑑サイト。`;
        
        const url = `${BASE_URL}/meta/butterfly/${id}`;
        
        const html = generateMetaPage({
          title,
          description,
          url,
          type: 'article'
        });

        const butterflyDir = path.join(metaDir, 'butterfly');
        if (!fs.existsSync(butterflyDir)) {
          fs.mkdirSync(butterflyDir, { recursive: true });
        }

        fs.writeFileSync(path.join(butterflyDir, `${id}.html`), html, 'utf8');
        generatedPages++;
      });
    }

    // Generate meta pages for beetles
    if (fs.existsSync('public/buprestidae_host.csv')) {
      const csvData = fs.readFileSync('public/buprestidae_host.csv', 'utf8');
      const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: 'greedy'
      });

      console.log(`Generating meta pages for ${results.data.length} beetles...`);

      results.data.forEach((row, index) => {
        const name = row['和名']?.trim();
        const genus = row['属']?.trim();
        const species = row['種小名']?.trim();
        const scientificName = genus && species ? `${genus} ${species}` : '';
        const hostPlants = row['食草']?.trim();
        
        if (!name) return;

        const id = `beetle-${index + 1}`;
        const title = scientificName ? `${name} (${scientificName}) - 甲虫図鑑` : `${name} - 甲虫図鑑`;
        const description = hostPlants ? 
          `${name}の詳細情報。食草: ${hostPlants.substring(0, 100)}${hostPlants.length > 100 ? '...' : ''}` :
          `${name}の詳細情報を掲載。甲虫と食草の関係を探る図鑑サイト。`;
        
        const url = `${BASE_URL}/meta/beetle/${id}`;
        
        const html = generateMetaPage({
          title,
          description,
          url,
          type: 'article'
        });

        const beetleDir = path.join(metaDir, 'beetle');
        if (!fs.existsSync(beetleDir)) {
          fs.mkdirSync(beetleDir, { recursive: true });
        }

        fs.writeFileSync(path.join(beetleDir, `${id}.html`), html, 'utf8');
        generatedPages++;
      });
    }

    // Generate meta pages for leafbeetles
    if (fs.existsSync('public/hamushi_species_integrated.csv')) {
      const csvData = fs.readFileSync('public/hamushi_species_integrated.csv', 'utf8');
      const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: 'greedy'
      });

      console.log(`Generating meta pages for ${results.data.length} leafbeetles...`);

      results.data.forEach((row, index) => {
        const name = row['和名']?.trim();
        const genus = row['属名']?.trim();
        const species = row['種小名']?.trim();
        const scientificName = genus && species ? `${genus} ${species}` : '';
        const hostPlants = row['食草']?.trim();
        
        if (!name) return;

        const id = `leafbeetle-${index + 1}`;
        const title = scientificName ? `${name} (${scientificName}) - ハムシ図鑑` : `${name} - ハムシ図鑑`;
        const description = hostPlants ? 
          `${name}の詳細情報。食草: ${hostPlants.substring(0, 100)}${hostPlants.length > 100 ? '...' : ''}` :
          `${name}の詳細情報を掲載。ハムシと食草の関係を探る図鑑サイト。`;
        
        const url = `${BASE_URL}/meta/leafbeetle/${id}`;
        
        const html = generateMetaPage({
          title,
          description,
          url,
          type: 'article'
        });

        const leafbeetleDir = path.join(metaDir, 'leafbeetle');
        if (!fs.existsSync(leafbeetleDir)) {
          fs.mkdirSync(leafbeetleDir, { recursive: true });
        }

        fs.writeFileSync(path.join(leafbeetleDir, `${id}.html`), html, 'utf8');
        generatedPages++;
      });
    }

    console.log(`✅ Meta pages generation completed!`);
    console.log(`📊 Generated ${generatedPages} meta pages`);
    console.log(`📍 Location: ${metaDir}`);

  } catch (error) {
    console.error('❌ Error generating meta pages:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateMetaPages();
}

export { generateMetaPages };