import React from 'react';

// 蛾の構造化データ
export const MothStructuredData = ({ moth }) => {
  if (!moth) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Animal",
    "name": moth.name,
    "alternateName": moth.scientificName,
    "scientificName": moth.scientificName,
    "classification": {
      "@type": "Taxon",
      "taxonomicRank": "Species",
      "parentTaxon": {
        "@type": "Taxon",
        "name": moth.family || "蛾科",
        "taxonomicRank": "Family"
      }
    },
    "description": `${moth.name}（${moth.scientificName}）は${moth.family || '蛾科'}に属する蛾の一種です。${moth.hostPlants?.length ? `主な食草：${moth.hostPlants.slice(0, 3).join('、')}` : ''}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/#/moth/${moth.id}`,
    "mainEntity": {
      "@type": "Article",
      "headline": `${moth.name} - 蛾の詳細情報`,
      "description": `${moth.name}（${moth.scientificName}）の詳細情報、食草、生態について`,
      "author": {
        "@type": "Organization",
        "name": "昆虫食草図鑑"
      }
    }
  };

  if (moth.hostPlants?.length) {
    structuredData.interactionWithOtherOrganisms = moth.hostPlants.map(plant => ({
      "@type": "InteractionWithOtherOrganisms",
      "interactionType": "feeds on",
      "organism": {
        "@type": "Plant",
        "name": plant
      }
    }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// 蝶の構造化データ
export const ButterflyStructuredData = ({ butterfly }) => {
  if (!butterfly) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Animal",
    "name": butterfly.name,
    "alternateName": butterfly.scientificName,
    "scientificName": butterfly.scientificName,
    "classification": {
      "@type": "Taxon",
      "taxonomicRank": "Species",
      "parentTaxon": {
        "@type": "Taxon",
        "name": butterfly.family || "蝶科",
        "taxonomicRank": "Family"
      }
    },
    "description": `${butterfly.name}（${butterfly.scientificName}）は${butterfly.family || '蝶科'}に属する蝶の一種です。${butterfly.hostPlants?.length ? `主な食草：${butterfly.hostPlants.slice(0, 3).join('、')}` : ''}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/#/butterfly/${butterfly.id}`,
    "mainEntity": {
      "@type": "Article",
      "headline": `${butterfly.name} - 蝶の詳細情報`,
      "description": `${butterfly.name}（${butterfly.scientificName}）の詳細情報、食草、生態について`,
      "author": {
        "@type": "Organization",
        "name": "昆虫食草図鑑"
      }
    }
  };

  if (butterfly.hostPlants?.length) {
    structuredData.interactionWithOtherOrganisms = butterfly.hostPlants.map(plant => ({
      "@type": "InteractionWithOtherOrganisms",
      "interactionType": "feeds on",
      "organism": {
        "@type": "Plant",
        "name": plant
      }
    }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// ハムシの構造化データ
export const LeafBeetleStructuredData = ({ leafbeetle }) => {
  if (!leafbeetle) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Animal",
    "name": leafbeetle.name,
    "alternateName": leafbeetle.scientificName,
    "scientificName": leafbeetle.scientificName,
    "classification": {
      "@type": "Taxon",
      "taxonomicRank": "Species",
      "parentTaxon": {
        "@type": "Taxon",
        "name": "ハムシ科",
        "taxonomicRank": "Family"
      }
    },
    "description": `${leafbeetle.name}（${leafbeetle.scientificName}）はハムシ科に属する甲虫の一種です。${leafbeetle.hostPlants?.length ? `主な食草：${leafbeetle.hostPlants.slice(0, 3).join('、')}` : ''}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/#/leafbeetle/${leafbeetle.id}`,
    "mainEntity": {
      "@type": "Article",
      "headline": `${leafbeetle.name} - ハムシの詳細情報`,
      "description": `${leafbeetle.name}（${leafbeetle.scientificName}）の詳細情報、食草、生態について`,
      "author": {
        "@type": "Organization",
        "name": "昆虫食草図鑑"
      }
    }
  };

  if (leafbeetle.hostPlants?.length) {
    structuredData.interactionWithOtherOrganisms = leafbeetle.hostPlants.map(plant => ({
      "@type": "InteractionWithOtherOrganisms",
      "interactionType": "feeds on",
      "organism": {
        "@type": "Plant",
        "name": plant
      }
    }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// 植物の構造化データ
export const PlantStructuredData = ({ plant, relatedInsects }) => {
  if (!plant) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Plant",
    "name": plant.name,
    "description": `${plant.name}の詳細情報。${relatedInsects?.length ? `この植物を食草とする昆虫：${relatedInsects.slice(0, 3).map(i => i.name).join('、')}` : ''}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/#/plant/${encodeURIComponent(plant.name)}`,
    "mainEntity": {
      "@type": "Article",
      "headline": `${plant.name} - 食草植物の詳細情報`,
      "description": `${plant.name}を食草とする昆虫の一覧と詳細情報`,
      "author": {
        "@type": "Organization",
        "name": "昆虫食草図鑑"
      }
    }
  };

  if (relatedInsects?.length) {
    structuredData.interactionWithOtherOrganisms = relatedInsects.map(insect => ({
      "@type": "InteractionWithOtherOrganisms",
      "interactionType": "feeds",
      "organism": {
        "@type": "Animal",
        "name": insect.name,
        "scientificName": insect.scientificName
      }
    }));
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// メインページの構造化データ
export const MainStructuredData = () => {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "昆虫食草図鑑",
    "alternateName": "昆虫と食草の美しい関係を探る図鑑",
    "url": "https://h-amoto.github.io/insects-host-plant-explorer-/",
    "description": "昆虫と食草の美しい関係を探る、自然界の意外な繋がりを発見しよう。蛾、蝶、甲虫、ハムシと植物の関係を詳しく紹介する専門図鑑サイト。",
    "inLanguage": "ja",
    "author": {
      "@type": "Organization",
      "name": "昆虫食草図鑑"
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://h-amoto.github.io/insects-host-plant-explorer-/?search={search_term_string}",
      "query-input": "required name=search_term_string"
    },
    "mainEntity": {
      "@type": "Dataset",
      "name": "昆虫食草データベース",
      "description": "日本の昆虫と食草の関係を網羅的に収録したデータベース",
      "keywords": ["昆虫", "食草", "蛾", "蝶", "甲虫", "ハムシ", "植物", "生態学"],
      "creator": {
        "@type": "Organization",
        "name": "昆虫食草図鑑"
      }
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};