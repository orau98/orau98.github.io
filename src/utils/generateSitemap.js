// サイトマップ生成ユーティリティ
export const generateSitemap = (moths, butterflies, beetles, leafbeetles, hostPlants) => {
  const baseUrl = 'https://h-amoto.github.io/insects-host-plant-explorer-';
  const currentDate = new Date().toISOString().split('T')[0];
  
  let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Main pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;

  // 蛾の詳細ページ
  moths.forEach((moth, index) => {
    if (moth.name) {
      sitemap += `  <url>
    <loc>${baseUrl}/#/moth/main-${index}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }
  });

  // 蝶の詳細ページ
  butterflies.forEach((butterfly, index) => {
    if (butterfly.name) {
      sitemap += `  <url>
    <loc>${baseUrl}/#/butterfly/butterfly-${index}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }
  });

  // 甲虫の詳細ページ
  beetles.forEach((beetle, index) => {
    if (beetle.name) {
      sitemap += `  <url>
    <loc>${baseUrl}/#/beetle/beetle-${index}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }
  });

  // ハムシの詳細ページ
  leafbeetles.forEach((leafbeetle, index) => {
    if (leafbeetle.name) {
      sitemap += `  <url>
    <loc>${baseUrl}/#/leafbeetle/H${String(index + 1).padStart(3, '0')}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    }
  });

  // 植物の詳細ページ
  const uniquePlants = [...new Set(hostPlants.map(plant => plant.name))];
  uniquePlants.forEach(plantName => {
    if (plantName && plantName !== '不明') {
      sitemap += `  <url>
    <loc>${baseUrl}/#/plant/${encodeURIComponent(plantName)}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }
  });

  sitemap += `</urlset>`;
  
  return sitemap;
};

// サイトマップをダウンロードする関数
export const downloadSitemap = (moths, butterflies, beetles, leafbeetles, hostPlants) => {
  const sitemapContent = generateSitemap(moths, butterflies, beetles, leafbeetles, hostPlants);
  const blob = new Blob([sitemapContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'sitemap.xml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};