import { absUrl } from '../utils/origin';
import { createSafeInsectFilename } from '../utils/image';
import { getMappedScientificFilename } from '../utils/insectImageMappings';
import {
  INSECT_SECTION_CONFIGS,
  buildInsectMetaPagePath,
  buildPlantMetaPagePath,
} from '../utils/siteTaxonomy';

const toJsonLd = (data) =>
  JSON.stringify(data, null, 2).replace(/</g, '\\u003c');

const DATASET_DESCRIPTION =
  '日本産の蛾・蝶・甲虫・アブラムシなど7000種以上について、幼虫の食草、寄主植物、成虫出現時期、植物との相互作用を検索できる昆虫食草データベースです。';

const isFlowerVisitRecord = (record) => {
  if (!record) return false;
  if (record.isFlowerVisit === true) return true;
  const lifeStage = (record.lifeStage || '').trim();
  const plantPart = (record.plantPart || '').trim();
  const partCompact = plantPart.replace(/\s+/g, '');
  const isAdultOrUnknown = lifeStage === '成虫' || lifeStage === '';
  return isAdultOrUnknown && partCompact && partCompact.includes('花');
};

const extractLarvalHostPlants = (hostPlantsDetailed, hostPlantsFallback) => {
  if (Array.isArray(hostPlantsDetailed) && hostPlantsDetailed.length > 0) {
    const names = hostPlantsDetailed
      .filter((record) => !isFlowerVisitRecord(record))
      .map((record) => record.displayName || record.name || record.plant || '')
      .map((name) => String(name || '').trim())
      .filter(Boolean);
    return Array.from(new Set(names));
  }
  if (Array.isArray(hostPlantsFallback)) {
    return Array.from(new Set(hostPlantsFallback.map(s => String(s || '').trim()).filter(Boolean)));
  }
  if (typeof hostPlantsFallback === 'string') {
    return Array.from(new Set(hostPlantsFallback.split(/[、，,;；]/).map(s => s.trim()).filter(Boolean)));
  }
  return [];
};

const resolveInsectImageFilename = (insect) =>
  getMappedScientificFilename(insect?.name || insect?.japaneseName || '') ||
  insect?.scientificFilename ||
  createSafeInsectFilename(insect?.scientificName || '') ||
  '';

const buildInsectImageObject = (insect, caption, description) => {
  const safeFilename = resolveInsectImageFilename(insect);
  if (!safeFilename) return null;
  return {
    "@type": "ImageObject",
    "url": absUrl(`/images/resized/insects/${encodeURIComponent(safeFilename)}.1024.jpg`),
    "caption": caption,
    "description": description,
  };
};

const buildExplorerCanonicalUrl = (pathname = '/') => {
  if (pathname === '/moth') return absUrl('/meta/moth/index.html');
  if (pathname === '/plant') return absUrl('/meta/plant/index.html');
  return absUrl('/');
};

// Enhanced 蛾の構造化データ with Species and detailed taxonomy
export const MothStructuredData = ({ moth }) => {
  if (!moth) return null;

  const detailUrl = absUrl(buildInsectMetaPagePath(moth.type, moth.id, 'moth'));

  // Normalize hostPlants to an array for safe operations
  const hostPlantsList = extractLarvalHostPlants(moth.hostPlantsDetailed, moth.hostPlants);

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
    "description": `${moth.name}（${moth.scientificName}）は${moth.classification?.familyJapanese || moth.family || '蛾科'}に属する蛾の一種です。${hostPlantsList.length ? `主な食草：${hostPlantsList.slice(0, 3).join('、')}など${hostPlantsList.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    "url": detailUrl,
    "sameAs": detailUrl,
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
        "value": hostPlantsList.length || 0
      }
    ]
  };

  // Add image if available
  const imageObject = buildInsectImageObject(
    moth,
    `${moth.name}（${moth.scientificName}）の写真`,
    `${moth.name}の生態写真`,
  );
  if (imageObject) {
    structuredData.image = imageObject;
  }

  // Enhanced host plant interactions
  if (hostPlantsList.length) {
    structuredData.hasEcologicalInteraction = hostPlantsList.map(plant => ({
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
        "name": "昆虫植物図鑑",
        "item": absUrl('/')
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "昆虫",
        "item": absUrl('/meta/moth/index.html')
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": moth.name,
        "item": detailUrl
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

// Enhanced 蝶の構造化データ with Species and detailed taxonomy
export const ButterflyStructuredData = ({ butterfly }) => {
  if (!butterfly) return null;

  const detailUrl = absUrl(
    buildInsectMetaPagePath(butterfly.type, butterfly.id, 'butterfly'),
  );

  const hostPlantsList = extractLarvalHostPlants(butterfly.hostPlantsDetailed, butterfly.hostPlants);

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
    "description": `${butterfly.name}（${butterfly.scientificName}）は${butterfly.classification?.familyJapanese || butterfly.family || '蝶科'}に属する蝶の一種です。${hostPlantsList.length ? `主な食草：${hostPlantsList.slice(0, 3).join('、')}など${hostPlantsList.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    "url": detailUrl,
    "sameAs": detailUrl,
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
        "value": hostPlantsList.length || 0
      }
    ]
  };

  // Add image if available
  const imageObject = buildInsectImageObject(
    butterfly,
    `${butterfly.name}（${butterfly.scientificName}）の写真`,
    `${butterfly.name}の生態写真`,
  );
  if (imageObject) {
    structuredData.image = imageObject;
  }

  // Enhanced host plant interactions
  if (hostPlantsList.length) {
    structuredData.hasEcologicalInteraction = hostPlantsList.map(plant => ({
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
        "name": "昆虫植物図鑑",
        "item": absUrl('/')
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "昆虫",
        "item": absUrl('/meta/butterfly/index.html')
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": butterfly.name,
        "item": detailUrl
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

// Enhanced タマムシの構造化データ with Species and detailed taxonomy
export const BeetleStructuredData = ({ beetle }) => {
  if (!beetle) return null;

  const detailUrl = absUrl(
    buildInsectMetaPagePath(beetle.type, beetle.id, 'beetle'),
  );

  const hostPlantsList = extractLarvalHostPlants(beetle.hostPlantsDetailed, beetle.hostPlants);

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
    "description": `${beetle.name}（${beetle.scientificName}）は${beetle.classification?.family || 'タマムシ科'}に属するタマムシの一種です。${hostPlantsList.length ? `主な食草：${hostPlantsList.slice(0, 3).join('、')}など${hostPlantsList.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    "url": detailUrl,
    "sameAs": detailUrl,
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
        "value": hostPlantsList.length || 0
      }
    ]
  };

  // Add image if available
  const imageObject = buildInsectImageObject(
    beetle,
    `${beetle.name}（${beetle.scientificName}）の写真`,
    `${beetle.name}の生態写真`,
  );
  if (imageObject) {
    structuredData.image = imageObject;
  }

  // Enhanced host plant interactions
  if (hostPlantsList.length) {
    structuredData.hasEcologicalInteraction = hostPlantsList.map(plant => ({
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
        "name": "昆虫植物図鑑",
        "item": absUrl('/')
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "昆虫",
        "item": absUrl('/meta/beetle/index.html')
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": beetle.name,
        "item": detailUrl
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

// Enhanced カミキリムシの構造化データ with Species and detailed taxonomy
export const LonghornBeetleStructuredData = ({ longhornbeetle }) => {
  if (!longhornbeetle) return null;

  const detailUrl = absUrl(
    buildInsectMetaPagePath(
      longhornbeetle.type,
      longhornbeetle.id,
      'longhornbeetle',
    ),
  );
  const hostPlantsList = extractLarvalHostPlants(longhornbeetle.hostPlantsDetailed, longhornbeetle.hostPlants);

  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": longhornbeetle.name,
    "alternateName": [longhornbeetle.scientificName, longhornbeetle.name],
    "scientificName": longhornbeetle.scientificName,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "species_id",
      "value": longhornbeetle.id
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": [
        {
          "@type": "Taxon",
          "name": longhornbeetle.classification?.genus || longhornbeetle.scientificName?.split(' ')[0] || "unknown",
          "taxonRank": "genus"
        },
        {
          "@type": "Taxon",
          "name": longhornbeetle.classification?.subfamily || "カミキリムシ亜科",
          "taxonRank": "subfamily"
        },
        {
          "@type": "Taxon",
          "name": longhornbeetle.classification?.family || "カミキリムシ科",
          "taxonRank": "family"
        },
        {
          "@type": "Taxon",
          "name": "鞘翅目",
          "taxonRank": "order"
        }
      ]
    },
    "description": `${longhornbeetle.name}（${longhornbeetle.scientificName}）は${longhornbeetle.classification?.family || 'カミキリムシ科'}に属するカミキリムシの一種です。${hostPlantsList.length ? `主な食草：${hostPlantsList.slice(0, 3).join('、')}など${hostPlantsList.length}種の植物を利用します。` : '食草情報は現在調査中です。'}`,
    "url": detailUrl,
    "sameAs": detailUrl,
    "inLanguage": "ja",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "和名",
        "value": longhornbeetle.name
      },
      {
        "@type": "PropertyValue",
        "name": "学名",
        "value": longhornbeetle.scientificName
      },
      {
        "@type": "PropertyValue",
        "name": "分類",
        "value": longhornbeetle.classification?.family || "カミキリムシ科"
      },
      {
        "@type": "PropertyValue",
        "name": "食草数",
        "value": hostPlantsList.length || 0
      }
    ]
  };

  const imageObject = buildInsectImageObject(
    longhornbeetle,
    `${longhornbeetle.name}（${longhornbeetle.scientificName}）の写真`,
    `${longhornbeetle.name}の生態写真`,
  );
  if (imageObject) {
    structuredData.image = imageObject;
  }

  if (hostPlantsList.length) {
    structuredData.hasEcologicalInteraction = hostPlantsList.map(plant => ({
      "@type": "EcologicalInteraction",
      "interactionType": "herbivory",
      "participantOrganism": {
        "@type": ["Plant", "Species"],
        "name": plant,
        "taxonomicRank": "species"
      },
      "description": `${longhornbeetle.name}が${plant}を食草として利用`
    }));
  }

  structuredData.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "昆虫植物図鑑",
        "item": absUrl('/')
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "昆虫",
        "item": absUrl('/meta/longhornbeetle/index.html')
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": longhornbeetle.name,
        "item": detailUrl
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

// Enhanced ハムシの構造化データ with Species, detailed taxonomy and emergence time
export const LeafBeetleStructuredData = ({ leafbeetle }) => {
  if (!leafbeetle) return null;

  const detailUrl = absUrl(
    buildInsectMetaPagePath(leafbeetle.type, leafbeetle.id, 'leafbeetle'),
  );

  const hostPlantsList = extractLarvalHostPlants(leafbeetle.hostPlantsDetailed, leafbeetle.hostPlants);

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
    "description": `${leafbeetle.name}（${leafbeetle.scientificName}）はハムシ科に属するハムシの一種です。${hostPlantsList.length ? `主な食草：${hostPlantsList.slice(0, 3).join('、')}など${hostPlantsList.length}種の植物を利用します。` : '食草情報は現在調査中です。'}${leafbeetle.emergenceTime && leafbeetle.emergenceTime !== '不明' ? ` 成虫発生時期：${leafbeetle.emergenceTime}` : ''}`,
    "url": detailUrl,
    "sameAs": detailUrl,
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
        "value": hostPlantsList.length || 0
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
  const imageObject = buildInsectImageObject(
    leafbeetle,
    `${leafbeetle.name}（${leafbeetle.scientificName}）の写真`,
    `${leafbeetle.name}の生態写真`,
  );
  if (imageObject) {
    structuredData.image = imageObject;
  }

  // Enhanced host plant interactions
  if (hostPlantsList.length) {
    structuredData.hasEcologicalInteraction = hostPlantsList.map(plant => ({
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
        "name": "昆虫植物図鑑",
        "item": absUrl('/')
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "昆虫",
        "item": absUrl('/meta/leafbeetle/index.html')
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": leafbeetle.name,
        "item": detailUrl
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

export const AphidStructuredData = ({ aphid }) => {
  if (!aphid) return null;

  const detailUrl = absUrl(
    buildInsectMetaPagePath(aphid.type, aphid.id, 'aphid'),
  );

  const hostPlantsList = extractLarvalHostPlants(
    aphid.hostPlantsDetailed,
    aphid.hostPlants,
  );
  const familyName =
    aphid.classification?.familyJapanese || aphid.family || 'アブラムシ科';

  const structuredData = {
    "@context": "https://schema.org",
    "@type": ["Animal", "Species"],
    "name": aphid.name,
    "alternateName": [aphid.scientificName, aphid.name],
    "scientificName": aphid.scientificName,
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "species_id",
      "value": aphid.id
    },
    "classification": {
      "@type": "Taxon",
      "taxonRank": "species",
      "parentTaxon": [
        {
          "@type": "Taxon",
          "name": aphid.classification?.genus || aphid.scientificName?.split(' ')[0] || "unknown",
          "taxonRank": "genus"
        },
        {
          "@type": "Taxon",
          "name": familyName,
          "taxonRank": "family"
        },
        {
          "@type": "Taxon",
          "name": "カメムシ目",
          "taxonRank": "order"
        }
      ]
    },
    "description": `${aphid.name}（${aphid.scientificName}）は${familyName}に属するアブラムシの一種です。${hostPlantsList.length ? `主な寄主植物：${hostPlantsList.slice(0, 3).join('、')}など${hostPlantsList.length}種の植物を利用します。` : '寄主植物情報は現在調査中です。'}`,
    "url": detailUrl,
    "sameAs": detailUrl,
    "inLanguage": "ja",
    "additionalProperty": [
      {
        "@type": "PropertyValue",
        "name": "和名",
        "value": aphid.name
      },
      {
        "@type": "PropertyValue",
        "name": "学名",
        "value": aphid.scientificName
      },
      {
        "@type": "PropertyValue",
        "name": "分類",
        "value": familyName
      },
      {
        "@type": "PropertyValue",
        "name": "寄主植物数",
        "value": hostPlantsList.length || 0
      }
    ]
  };

  const imageObject = buildInsectImageObject(
    aphid,
    `${aphid.name}（${aphid.scientificName}）の写真`,
    `${aphid.name}の生態写真`,
  );
  if (imageObject) {
    structuredData.image = imageObject;
  }

  if (hostPlantsList.length) {
    structuredData.hasEcologicalInteraction = hostPlantsList.map((plant) => ({
      "@type": "EcologicalInteraction",
      "interactionType": "herbivory",
      "participantOrganism": {
        "@type": ["Plant", "Species"],
        "name": plant,
        "taxonomicRank": "species"
      },
      "description": `${aphid.name}が${plant}を寄主植物として利用`
    }));
  }

  structuredData.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "昆虫植物図鑑",
        "item": absUrl('/')
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "昆虫",
        "item": absUrl('/meta/aphid/index.html')
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": aphid.name,
        "item": detailUrl
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

// Enhanced 植物の構造化データ with Species and detailed taxonomy
export const PlantStructuredData = ({ plant, relatedInsects }) => {
  if (!plant) return null;

  const canonicalPlantName = plant.canonicalName || plant.name;
  const plantMetaUrl = absUrl(buildPlantMetaPagePath(canonicalPlantName));

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
    "url": plantMetaUrl,
    "sameAs": plantMetaUrl,
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
        "name": "昆虫植物図鑑",
        "item": absUrl('/')
      },
      {
        "@type": "ListItem", 
        "position": 2,
        "name": "植物",
        "item": absUrl('/meta/plant/index.html')
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": plant.name,
        "item": plantMetaUrl
      }
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

// メインページの構造化データ
export const MainStructuredData = () => {
  const siteUrl = absUrl('/');
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}#website`,
    "name": "昆虫植物図鑑",
    "alternateName": ["昆虫食草図鑑", "昆虫食草DB", "InsectPlantDB"],
    "url": siteUrl,
    "description": "蛾・蝶・タマムシ・カミキリムシ・ハムシ・アブラムシなど、日本産昆虫と食草・寄主植物の関係を検索できるデータベース。",
    "inLanguage": "ja",
    "image": absUrl('/images/resized/insects/Cucullia_argentea.1024.jpg'),
    "isAccessibleForFree": true,
    "sameAs": [
      "https://www.instagram.com/onychodactylus_nipponoborealis/"
    ],
    "author": {
      "@type": "Organization",
      "name": "昆虫植物図鑑"
    },
    "publisher": {
      "@type": "Organization",
      "name": "昆虫植物図鑑",
      "url": siteUrl,
      "logo": {
        "@type": "ImageObject",
        "url": absUrl('/favicon-192.png'),
        "width": 192,
        "height": 192
      }
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${siteUrl}?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    },
    "mainEntity": {
      "@type": "Dataset",
      "@id": `${siteUrl}#dataset`,
      "name": "日本産昆虫と食草・寄主植物データベース",
      "description": DATASET_DESCRIPTION,
      "url": siteUrl,
      "inLanguage": "ja",
      "isAccessibleForFree": true,
      "image": absUrl('/images/resized/insects/Cucullia_argentea.1024.jpg'),
      "keywords": ["昆虫", "食草", "蛾", "蝶", "タマムシ", "カミキリムシ", "ハムシ", "植物", "生態学"],
      "creator": {
        "@type": "Organization",
        "name": "昆虫植物図鑑"
      }
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLd(structuredData) }}
    />
  );
};

export const ExplorerStructuredData = ({
  pathname = '/',
  pageTitle,
  pageDescription,
  counts,
  featuredInsects = [],
  featuredPlants = [],
}) => {
  if (!counts) return null;

  const pageUrl = buildExplorerCanonicalUrl(pathname);
  const siteUrl = absUrl('/');
  const totalInsects =
    (counts.moths || 0) +
    (counts.butterflies || 0) +
    (counts.beetles || 0) +
    (counts.longhornbeetles || 0) +
    (counts.leafbeetles || 0) +
    (counts.aphids || 0);

  const buildListItem = (entry, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    item: {
      '@type': 'WebPage',
      name: entry.name,
      url: entry.url,
      ...(entry.description ? { description: entry.description } : {}),
    },
  });

  let listName = '主要カテゴリ';
  let listDescription = '主要な分類ページ一覧';
  let itemEntries = [];

  if (pathname === '/moth') {
    listName = '昆虫一覧の代表種';
    listDescription = '昆虫一覧ページから参照できる代表的な昆虫メタページ';
    itemEntries = featuredInsects.slice(0, 10).map((insect) => ({
      name: insect?.name || insect?.japaneseName || '',
      url: absUrl(buildInsectMetaPagePath(insect?.type, insect?.id, 'moth')),
      description: insect?.scientificName || '',
    })).filter((entry) => entry.name && entry.url);
  } else if (pathname === '/plant') {
    listName = '植物一覧の代表種';
    listDescription = '植物一覧ページから参照できる代表的な植物メタページ';
    itemEntries = featuredPlants.slice(0, 10).map((plant) => ({
      name: plant?.name || '',
      url: absUrl(buildPlantMetaPagePath(plant?.name)),
      description: Number.isFinite(plant?.count)
        ? `${plant.count}種の昆虫が関連`
        : '',
    })).filter((entry) => entry.name && entry.url);
  } else {
    itemEntries = [
      ...INSECT_SECTION_CONFIGS.map((section) => ({
        name: `${section.label} ${counts[section.collectionKey] || 0}種`,
        url: absUrl(`/meta/${section.routeSegment}/index.html`),
        description: `${section.label}のメタページ一覧`,
      })),
      {
        name: `植物 ${counts.hostPlants || 0}種`,
        url: absUrl('/meta/plant/index.html'),
        description: '食草・訪花植物のメタページ一覧',
      },
    ];
  }

  const itemList = itemEntries.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        '@id': `${pageUrl}#itemlist`,
        name: listName,
        description: listDescription,
        numberOfItems: itemEntries.length,
        itemListElement: itemEntries.map(buildListItem),
      }
    : null;

  const aboutEntries =
    pathname === '/plant'
      ? [
          {
            '@type': 'Thing',
            name: `食草・訪花植物 ${counts.hostPlants || 0}種`,
          },
        ]
      : [
          {
            '@type': 'Thing',
            name: `昆虫 ${totalInsects}種`,
          },
          {
            '@type': 'Thing',
            name: `植物 ${counts.hostPlants || 0}種`,
          },
        ];

  const collectionPage = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${pageUrl}#collection`,
    name: pageTitle,
    description: pageDescription,
    url: pageUrl,
    inLanguage: 'ja',
    isPartOf: {
      '@id': `${siteUrl}#website`,
    },
    about: aboutEntries,
    ...(itemList ? { mainEntity: { '@id': `${pageUrl}#itemlist` } } : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toJsonLd(collectionPage) }}
      />
      {itemList && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: toJsonLd(itemList) }}
        />
      )}
    </>
  );
};
