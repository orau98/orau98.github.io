#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base URL for the site
const BASE_URL = 'https://h-amoto.github.io/insects-host-plant-explorer';

// Function to create safe URL slugs
const createSafeSlug = (text) => {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .trim();
};

// Function to format XML date
const formatDate = () => {
  return new Date().toISOString().split('T')[0];
};

// Function to generate sitemap entry
const generateSitemapEntry = (url, lastmod = null, changefreq = 'monthly', priority = '0.8') => {
  const lastmodStr = lastmod ? `<lastmod>${lastmod}</lastmod>` : '';
  return `  <url>
    <loc>${url}</loc>
    ${lastmodStr}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
};

async function generateSitemap() {
  console.log('Starting sitemap generation...');
  
  const urls = [];
  const currentDate = formatDate();
  
  // Add static pages
  urls.push(generateSitemapEntry(`${BASE_URL}/`, currentDate, 'weekly', '1.0'));
  
  try {
    // Read and parse CSV files
    const csvFiles = [
      { 
        path: 'public/ListMJ_hostplants_integrated_with_bokutou.csv', 
        type: 'moth',
        prefix: 'moth'
      },
      { 
        path: 'public/butterfly_host.csv', 
        type: 'butterfly',
        prefix: 'butterfly'
      },
      { 
        path: 'public/buprestidae_host.csv', 
        type: 'beetle',
        prefix: 'beetle'
      },
      { 
        path: 'public/hamushi_species_integrated.csv', 
        type: 'leafbeetle',
        prefix: 'leafbeetle'
      }
    ];

    let totalEntries = 0;
    
    for (const csvFile of csvFiles) {
      if (!fs.existsSync(csvFile.path)) {
        console.warn(`CSV file not found: ${csvFile.path}`);
        continue;
      }

      const csvData = fs.readFileSync(csvFile.path, 'utf8');
      const results = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: 'greedy'
      });

      console.log(`Processing ${csvFile.type}: ${results.data.length} entries`);

      results.data.forEach((row, index) => {
        let name, scientificName;
        
        if (csvFile.type === 'moth') {
          name = row['和名']?.trim();
          scientificName = row['学名']?.trim();
          
          // Skip entries without proper names or malformed data
          if (!name || name === '日本産タマムシ大図鑑' || name.includes('大図鑑')) {
            return;
          }
          
          // Generate ID similar to App.jsx logic
          const id = `main-${index + 1}`;
          urls.push(generateSitemapEntry(`${BASE_URL}/#/${csvFile.prefix}/${id}`, currentDate));
          // Also add meta page URL for better SEO
          urls.push(generateSitemapEntry(`${BASE_URL}/meta/${csvFile.prefix}/${id}`, currentDate));
          
        } else if (csvFile.type === 'butterfly') {
          name = row['和名']?.trim();
          const genus = row['属']?.trim();
          const species = row['種小名']?.trim();
          scientificName = genus && species ? `${genus} ${species}` : '';
          
          if (name) {
            const id = `butterfly-${index + 1}`;
            urls.push(generateSitemapEntry(`${BASE_URL}/#/${csvFile.prefix}/${id}`, currentDate));
            urls.push(generateSitemapEntry(`${BASE_URL}/meta/${csvFile.prefix}/${id}`, currentDate));
          }
          
        } else if (csvFile.type === 'beetle') {
          name = row['和名']?.trim();
          const genus = row['属']?.trim();
          const species = row['種小名']?.trim();
          scientificName = genus && species ? `${genus} ${species}` : '';
          
          if (name) {
            const id = `beetle-${index + 1}`;
            urls.push(generateSitemapEntry(`${BASE_URL}/#/${csvFile.prefix}/${id}`, currentDate));
            urls.push(generateSitemapEntry(`${BASE_URL}/meta/${csvFile.prefix}/${id}`, currentDate));
          }
          
        } else if (csvFile.type === 'leafbeetle') {
          name = row['和名']?.trim();
          const genus = row['属名']?.trim();
          const species = row['種小名']?.trim();
          scientificName = genus && species ? `${genus} ${species}` : '';
          
          if (name) {
            const id = `leafbeetle-${index + 1}`;
            urls.push(generateSitemapEntry(`${BASE_URL}/#/${csvFile.prefix}/${id}`, currentDate));
            urls.push(generateSitemapEntry(`${BASE_URL}/meta/${csvFile.prefix}/${id}`, currentDate));
          }
        }
        
        totalEntries++;
      });
    }

    // Add host plant pages
    console.log('Processing host plants...');
    
    // First, try to collect plant names from moth data
    const uniquePlants = new Set();
    
    if (fs.existsSync('public/ListMJ_hostplants_integrated_with_bokutou.csv')) {
      const mothPlantData = fs.readFileSync('public/ListMJ_hostplants_integrated_with_bokutou.csv', 'utf8');
      const mothPlantResults = Papa.parse(mothPlantData, {
        header: true,
        skipEmptyLines: 'greedy'
      });

      mothPlantResults.data.forEach((row) => {
        const hostPlants = row['食草']?.trim();
        if (hostPlants && hostPlants !== '不明' && hostPlants !== '未知' && hostPlants !== '') {
          // Split by semicolon, comma, or other separators
          const plants = hostPlants.split(/[;,、，]/);
          plants.forEach(plant => {
            const cleanPlant = plant.trim()
              .replace(/\([^)]*\)/g, '') // Remove parentheses content
              .replace(/（[^）]*）/g, '') // Remove Japanese parentheses content
              .replace(/以上.*$/, '') // Remove "以上〜科" patterns
              .replace(/など$/, '') // Remove "など" suffix
              .trim();
            
            if (cleanPlant && cleanPlant.length > 1 && !cleanPlant.match(/^[a-zA-Z\s]+$/)) {
              uniquePlants.add(cleanPlant);
            }
          });
        }
      });
    }
    
    // Also try to read plant database if available
    if (fs.existsSync('public/wamei_checklist_ver.1.10.csv')) {
      try {
        const plantCsvData = fs.readFileSync('public/wamei_checklist_ver.1.10.csv', 'utf8');
        const plantResults = Papa.parse(plantCsvData, {
          header: true,
          skipEmptyLines: 'greedy'
        });

        plantResults.data.forEach((row) => {
          const plantName = row['和名']?.trim();
          if (plantName && plantName.length > 1) {
            uniquePlants.add(plantName);
          }
        });
      } catch (error) {
        console.warn('Could not process plant database:', error.message);
      }
    }

    console.log(`Processing ${uniquePlants.size} unique host plants`);
    
    Array.from(uniquePlants).forEach((plantName) => {
      const plantSlug = createSafeSlug(plantName);
      if (plantSlug) {
        urls.push(generateSitemapEntry(`${BASE_URL}/#/plant/${encodeURIComponent(plantName)}`, currentDate));
      }
    });
    
    totalEntries += uniquePlants.size;

    console.log(`Total URLs generated: ${urls.length}`);
    
    // Generate sitemap XML
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

    // Write sitemap to public directory
    const sitemapPath = path.join('public', 'sitemap.xml');
    fs.writeFileSync(sitemapPath, sitemap, 'utf8');
    
    console.log(`✅ Sitemap generated successfully!`);
    console.log(`📍 Location: ${sitemapPath}`);
    console.log(`📊 Total URLs: ${urls.length}`);
    console.log(`🔗 Sitemap URL: ${BASE_URL}/sitemap.xml`);
    
    // Generate robots.txt if it doesn't exist
    const robotsPath = path.join('public', 'robots.txt');
    if (!fs.existsSync(robotsPath)) {
      const robotsTxt = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
      fs.writeFileSync(robotsPath, robotsTxt, 'utf8');
      console.log(`✅ robots.txt generated: ${robotsPath}`);
    }

  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateSitemap();
}

export { generateSitemap };