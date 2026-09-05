import { isFlowerVisitRecord } from './flowerVisitPlants.js';
import { isPlantHostRecord } from './hostResource.js';

// 昆虫カード（一覧・コンパクト表示）で使う食草/訪花の表示用データ整形。
// MothList と MothListItem の双方から参照するため独立モジュールに置く。

// カード上で食草/訪花名を何件まで出すか（超過分は「他N種」に集約してカード高を揃える）
export const CARD_PLANT_PREVIEW_CAP = 6;



export const cleanPlantName = (plant) => {
  if (!plant || typeof plant !== 'string') return '';
  if (plant === '不明') return '不明';
  return plant.replace(/[（(][^）)]*科[^）)]*[）)]/g, '').trim();
};

const filterUnknownPlantNames = (names = []) => {
  const hasSpecific = names.some((name) => name && name !== '不明');
  return hasSpecific ? names.filter((name) => name !== '不明') : names;
};

export const buildPlantDisplayData = (moth) => {
  let hostNames = [];
  let flowerNames = [];

  if (Array.isArray(moth?.hostPlantsDetailed) && moth.hostPlantsDetailed.length > 0) {
    moth.hostPlantsDetailed.forEach((record) => {
      if (!isPlantHostRecord(record)) return;
      const raw = record.displayName || record.name || '';
      const cleaned = cleanPlantName(String(raw).trim());
      if (!cleaned) return;
      if (isFlowerVisitRecord(record)) {
        flowerNames.push(cleaned);
      } else {
        hostNames.push(cleaned);
      }
    });
  } else if (moth?.hostPlants) {
    if (typeof moth.hostPlants === 'string') {
      hostNames = moth.hostPlants
        .split(/[;；、,]/)
        .map((plant) => cleanPlantName(plant.trim()))
        .filter(Boolean);
    } else if (Array.isArray(moth.hostPlants)) {
      hostNames = moth.hostPlants
        .map((plant) => cleanPlantName(String(plant || '').trim()))
        .filter(Boolean);
    }
  }

  if (Array.isArray(moth?.flowerVisitPlants)) {
    flowerNames.push(
      ...moth.flowerVisitPlants
        .map((plant) => cleanPlantName(String(plant || '').trim()))
        .filter(Boolean),
    );
  }

  return {
    hostNames: [...new Set(filterUnknownPlantNames(hostNames))],
    flowerNames: [...new Set(filterUnknownPlantNames(flowerNames))],
  };
};
