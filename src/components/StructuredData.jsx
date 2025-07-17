import React from 'react';

// Enhanced 蛾の構造化データ with Species and detailed taxonomy
export const MothStructuredData = ({ moth }) => {
  if (!moth) return null;

  // Create comprehensive species schema with detailed taxonomic information
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": moth.name,
    "alternateName": [moth.scientificName, moth.name],
    "scientificName": moth.scientificName,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "species_id",
      "value": moth.id
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": [
        {
          "@type": "Taxon",
          "name": moth.classification?.genus || moth.scientificName?.split(' ')[0] || "unknown",
          "taxonRank": "genus"
        },
        {
          "@type": "Taxon", 
          "name": moth.classification?.subfamily || moth.classification?.familyJapanese || "subfamily",
          "taxonRank": "subfamily"
        },
        {
          "@type": "Taxon",
          "name": moth.classification?.family || moth.family || "蛾科",
          "taxonRank": "family"
        },
        {
          "@type": "Taxon",
          "name": "鱗翅目",
          "taxonRank": "order"
        }
      ]
    },
    "description": `${moth.name}（${moth.scientificName}）は${moth.classification?.familyJapanese || moth.family || '蛾科'}に属する蛾の一種です。${moth.hostPlants?.length ? `主な食草：${moth.hostPlants.slice(0, 3).join('、')}など${moth.hostPlants.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/moth/${moth.id}`,
    "sameAs": `https://h-amoto.github.io/insects-host-plant-explorer-/moth/${moth.id}`,
    "inLanguage": "ja",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "和名",
        "value": moth.name
      },
      {
        "@type": "PropertyValue", 
        "name": "学名",
        "value": moth.scientificName
      },
      {
        "@type": "PropertyValue",
        "name": "分類",
        "value": moth.classification?.familyJapanese || moth.family || "蛾科"
      },
      {
        "@type": "PropertyValue",
        "name": "食草数",
        "value": moth.hostPlants?.length || 0
      }
    ]
  };

  // Add image if available
  const safeFilename = moth.scientificFilename || moth.scientificName?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  if (safeFilename) {
    structuredData.image = {
      "@type": "ImageObject",
      "url": `https://h-amoto.github.io/insects-host-plant-explorer-/images/moths/${safeFilename}.jpg`,
      "caption": `${moth.name}（${moth.scientificName}）の写真`,
      "description": `${moth.name}の生態写真`
    };
  }

  // Enhanced host plant interactions
  if (moth.hostPlants?.length) {
    structuredData.hasEcologicalInteraction = moth.hostPlants.map(plant => ({
      "@type": "EcologicalInteraction",
      "interactionType": "herbivory",
      "participantOrganism": {
        "@type": ["Plant", "Species"],
        "name": plant,
        "taxonomicRank": "species"
      },
      "description": `${moth.name}の幼虫が${plant}を食草として利用`
    }));
  }

  // Add breadcrumb for better navigation
  structuredData.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "昆虫食草図鑑",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/"
      },
      {
        "@type": "ListItem", 
        "position": 2,
        "name": "蛾",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/moth"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": moth.name,
        "item": `https://h-amoto.github.io/insects-host-plant-explorer-/moth/${moth.id}`
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// Enhanced 蝶の構造化データ with Species and detailed taxonomy
export const ButterflyStructuredData = ({ butterfly }) => {
  if (!butterfly) return null;

  // Create comprehensive species schema with detailed taxonomic information
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": butterfly.name,
    "alternateName": [butterfly.scientificName, butterfly.name],
    "scientificName": butterfly.scientificName,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "species_id",
      "value": butterfly.id
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": [
        {
          "@type": "Taxon",
          "name": butterfly.classification?.genus || butterfly.scientificName?.split(' ')[0] || "unknown",
          "taxonRank": "genus"
        },
        {
          "@type": "Taxon", 
          "name": butterfly.classification?.subfamily || butterfly.classification?.familyJapanese || "subfamily",
          "taxonRank": "subfamily"
        },
        {
          "@type": "Taxon",
          "name": butterfly.classification?.family || butterfly.family || "蝶科",
          "taxonRank": "family"
        },
        {
          "@type": "Taxon",
          "name": "鱗翅目",
          "taxonRank": "order"
        }
      ]
    },
    "description": `${butterfly.name}（${butterfly.scientificName}）は${butterfly.classification?.familyJapanese || butterfly.family || '蝶科'}に属する蝶の一種です。${butterfly.hostPlants?.length ? `主な食草：${butterfly.hostPlants.slice(0, 3).join('、')}など${butterfly.hostPlants.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/butterfly/${butterfly.id}`,
    "sameAs": `https://h-amoto.github.io/insects-host-plant-explorer-/butterfly/${butterfly.id}`,
    "inLanguage": "ja",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "和名",
        "value": butterfly.name
      },
      {
        "@type": "PropertyValue", 
        "name": "学名",
        "value": butterfly.scientificName
      },
      {
        "@type": "PropertyValue",
        "name": "分類",
        "value": butterfly.classification?.familyJapanese || butterfly.family || "蝶科"
      },
      {
        "@type": "PropertyValue",
        "name": "食草数",
        "value": butterfly.hostPlants?.length || 0
      }
    ]
  };

  // Add image if available
  const safeFilename = butterfly.scientificFilename || butterfly.scientificName?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  if (safeFilename) {
    structuredData.image = {
      "@type": "ImageObject",
      "url": `https://h-amoto.github.io/insects-host-plant-explorer-/images/moths/${safeFilename}.jpg`,
      "caption": `${butterfly.name}（${butterfly.scientificName}）の写真`,
      "description": `${butterfly.name}の生態写真`
    };
  }

  // Enhanced host plant interactions
  if (butterfly.hostPlants?.length) {
    structuredData.hasEcologicalInteraction = butterfly.hostPlants.map(plant => ({
      "@type": "EcologicalInteraction",
      "interactionType": "herbivory",
      "participantOrganism": {
        "@type": ["Plant", "Species"],
        "name": plant,
        "taxonomicRank": "species"
      },
      "description": `${butterfly.name}の幼虫が${plant}を食草として利用`
    }));
  }

  // Add breadcrumb for better navigation
  structuredData.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "昆虫食草図鑑",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/"
      },
      {
        "@type": "ListItem", 
        "position": 2,
        "name": "蝶",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/butterfly"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": butterfly.name,
        "item": `https://h-amoto.github.io/insects-host-plant-explorer-/butterfly/${butterfly.id}`
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// Enhanced 甲虫の構造化データ with Species and detailed taxonomy
export const BeetleStructuredData = ({ beetle }) => {
  if (!beetle) return null;

  // Create comprehensive species schema with detailed taxonomic information
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": beetle.name,
    "alternateName": [beetle.scientificName, beetle.name],
    "scientificName": beetle.scientificName,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "species_id",
      "value": beetle.id
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": [
        {
          "@type": "Taxon",
          "name": beetle.classification?.genus || beetle.scientificName?.split(' ')[0] || "unknown",
          "taxonRank": "genus"
        },
        {
          "@type": "Taxon", 
          "name": beetle.classification?.subfamily || "タマムシ亜科",
          "taxonRank": "subfamily"
        },
        {
          "@type": "Taxon",
          "name": beetle.classification?.family || "タマムシ科",
          "taxonRank": "family"
        },
        {
          "@type": "Taxon",
          "name": "鞘翅目",
          "taxonRank": "order"
        }
      ]
    },
    "description": `${beetle.name}（${beetle.scientificName}）は${beetle.classification?.family || 'タマムシ科'}に属する甲虫の一種です。${beetle.hostPlants?.length ? `主な食草：${beetle.hostPlants.slice(0, 3).join('、')}など${beetle.hostPlants.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/beetle/${beetle.id}`,
    "sameAs": `https://h-amoto.github.io/insects-host-plant-explorer-/beetle/${beetle.id}`,
    "inLanguage": "ja",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "和名",
        "value": beetle.name
      },
      {
        "@type": "PropertyValue", 
        "name": "学名",
        "value": beetle.scientificName
      },
      {
        "@type": "PropertyValue",
        "name": "分類",
        "value": beetle.classification?.family || "タマムシ科"
      },
      {
        "@type": "PropertyValue",
        "name": "食草数",
        "value": beetle.hostPlants?.length || 0
      }
    ]
  };

  // Add image if available
  const safeFilename = beetle.scientificFilename || beetle.scientificName?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  if (safeFilename) {
    structuredData.image = {
      "@type": "ImageObject",
      "url": `https://h-amoto.github.io/insects-host-plant-explorer-/images/moths/${safeFilename}.jpg`,
      "caption": `${beetle.name}（${beetle.scientificName}）の写真`,
      "description": `${beetle.name}の生態写真`
    };
  }

  // Enhanced host plant interactions
  if (beetle.hostPlants?.length) {
    structuredData.hasEcologicalInteraction = beetle.hostPlants.map(plant => ({
      "@type": "EcologicalInteraction",
      "interactionType": "herbivory",
      "participantOrganism": {
        "@type": ["Plant", "Species"],
        "name": plant,
        "taxonomicRank": "species"
      },
      "description": `${beetle.name}が${plant}を食草として利用`
    }));
  }

  // Add breadcrumb for better navigation
  structuredData.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "昆虫食草図鑑",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/"
      },
      {
        "@type": "ListItem", 
        "position": 2,
        "name": "甲虫",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/beetle"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": beetle.name,
        "item": `https://h-amoto.github.io/insects-host-plant-explorer-/beetle/${beetle.id}`
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// Enhanced ハムシの構造化データ with Species, detailed taxonomy and emergence time
export const LeafBeetleStructuredData = ({ leafbeetle }) => {
  if (!leafbeetle) return null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": leafbeetle.name,
    "alternateName": [leafbeetle.scientificName, leafbeetle.name],
    "scientificName": leafbeetle.scientificName,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "species_id", 
      "value": leafbeetle.id
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": [
        {
          "@type": "Taxon",
          "name": leafbeetle.scientificName?.split(' ')[0] || "unknown",
          "taxonRank": "genus"
        },
        {
          "@type": "Taxon",
          "name": "ハムシ科",
          "taxonRank": "family"
        },
        {
          "@type": "Taxon",
          "name": "鞘翅目", 
          "taxonRank": "order"
        }
      ]
    },
    "description": `${leafbeetle.name}（${leafbeetle.scientificName}）はハムシ科に属する甲虫の一種です。${leafbeetle.hostPlants?.length ? `主な食草：${leafbeetle.hostPlants.slice(0, 3).join('、')}など${leafbeetle.hostPlants.length}種の植物を利用します。` : '食草情報は現在調査中です。'}${leafbeetle.emergenceTime && leafbeetle.emergenceTime !== '不明' ? ` 成虫発生時期：${leafbeetle.emergenceTime}` : ''}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/leafbeetle/${leafbeetle.id}`,
    "sameAs": `https://h-amoto.github.io/insects-host-plant-explorer-/leafbeetle/${leafbeetle.id}`,
    "inLanguage": "ja",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "和名",
        "value": leafbeetle.name
      },
      {
        "@type": "PropertyValue",
        "name": "学名", 
        "value": leafbeetle.scientificName
      },
      {
        "@type": "PropertyValue",
        "name": "分類",
        "value": "ハムシ科"
      },
      {
        "@type": "PropertyValue",
        "name": "食草数",
        "value": leafbeetle.hostPlants?.length || 0
      }
    ]
  };

  // Add emergence time information if available
  if (leafbeetle.emergenceTime && leafbeetle.emergenceTime !== '不明') {
    structuredData.additionalProperty.push({
      "@type": "PropertyValue",
      "name": "成虫発生時期",
      "value": leafbeetle.emergenceTime
    });
    
    // Add life cycle information
    structuredData.lifeCycle = {
      "@type": "BiologicalCycle",
      "name": "成虫発生サイクル",
      "description": `${leafbeetle.name}の成虫は${leafbeetle.emergenceTime}に発生します`
    };
  }

  // Add data source information
  if (leafbeetle.source) {
    structuredData.citation = {
      "@type": "CreativeWork",
      "name": leafbeetle.source,
      "description": "データの出典"
    };
  }

  // Add image if available
  const safeFilename = leafbeetle.scientificFilename || leafbeetle.scientificName?.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  if (safeFilename) {
    structuredData.image = {
      "@type": "ImageObject",
      "url": `https://h-amoto.github.io/insects-host-plant-explorer-/images/moths/${safeFilename}.jpg`,
      "caption": `${leafbeetle.name}（${leafbeetle.scientificName}）の写真`,
      "description": `${leafbeetle.name}の生態写真`
    };
  }

  // Enhanced host plant interactions
  if (leafbeetle.hostPlants?.length) {
    structuredData.hasEcologicalInteraction = leafbeetle.hostPlants.map(plant => ({
      "@type": "EcologicalInteraction",
      "interactionType": "herbivory",
      "participantOrganism": {
        "@type": ["Plant", "Species"],
        "name": plant,
        "taxonomicRank": "species"
      },
      "description": `${leafbeetle.name}が${plant}を食草として利用`
    }));
  }

  // Add breadcrumb for better navigation
  structuredData.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "昆虫食草図鑑",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "ハムシ",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/leafbeetle"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": leafbeetle.name,
        "item": `https://h-amoto.github.io/insects-host-plant-explorer-/leafbeetle/${leafbeetle.id}`
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData, null, 2) }}
    />
  );
};

// Enhanced 植物の構造化データ with Species and detailed taxonomy
export const PlantStructuredData = ({ plant, relatedInsects }) => {
  if (!plant) return null;

  // Create comprehensive plant species schema with detailed information
  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Plant", "Species"],
    "name": plant.name,
    "alternateName": plant.scientificName ? [plant.scientificName, plant.name] : [plant.name],
    "scientificName": plant.scientificName || plant.name,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "plant_id",
      "value": plant.id || encodeURIComponent(plant.name)
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": [
        {
          "@type": "Taxon",
          "name": plant.genus || plant.scientificName?.split(' ')[0] || "unknown",
          "taxonRank": "genus"
        },
        {
          "@type": "Taxon",
          "name": plant.family || "科",
          "taxonRank": "family"
        }
      ]
    },
    "description": `${plant.name}${plant.scientificName ? `（${plant.scientificName}）` : ''}${plant.family ? `は${plant.family}に属する植物です。` : 'の詳細情報。'}${relatedInsects?.length ? `この植物を食草とする昆虫：${relatedInsects.slice(0, 3).map(i => i.name).join('、')}など${relatedInsects.length}種の昆虫が利用します。` : ''}`,
    "url": `https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(plant.name)}`,
    "sameAs": `https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(plant.name)}`,
    "inLanguage": "ja",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "和名",
        "value": plant.name
      }
    ]
  };

  // Add scientific name if available
  if (plant.scientificName) {
    structuredData.additionalProperty.push({
      "@type": "PropertyValue",
      "name": "学名",
      "value": plant.scientificName
    });
  }

  // Add family information if available
  if (plant.family) {
    structuredData.additionalProperty.push({
      "@type": "PropertyValue",
      "name": "科名",
      "value": plant.family
    });
  }

  // Add related insects count
  structuredData.additionalProperty.push({
    "@type": "PropertyValue",
    "name": "関連昆虫数",
    "value": relatedInsects?.length || 0
  });

  // Enhanced ecological interactions with insects
  if (relatedInsects?.length) {
    structuredData.hasEcologicalInteraction = relatedInsects.map(insect => ({
      "@type": "EcologicalInteraction",
      "interactionType": "herbivory",
      "participantOrganism": {
        "@type": ["Animal", "Species"],
        "name": insect.name,
        "scientificName": insect.scientificName,
        "taxonomicRank": "species"
      },
      "description": `${insect.name}が${plant.name}を食草として利用`
    }));
  }

  // Add breadcrumb for better navigation
  structuredData.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "昆虫食草図鑑",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "植物",
        "item": "https://h-amoto.github.io/insects-host-plant-explorer-/plant"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": plant.name,
        "item": `https://h-amoto.github.io/insects-host-plant-explorer-/plant/${encodeURIComponent(plant.name)}`
      }
    ]
  };

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
      "target": "https://h-amoto.github.io/insects-host-plant-explorer-/?q={search_term_string}",
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