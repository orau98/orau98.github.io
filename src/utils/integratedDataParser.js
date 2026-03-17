// 統合CSVデータの解析・処理ユーティリティ
import logger from './logger';
import {
  INSECT_COLLECTION_KEYS,
  createEmptyInsectCollections,
} from './siteTaxonomy.js';

/**
 * 統合CSVの食草データを解析して標準形式に変換
 * @param {Object} row - CSVの行データ
 * @returns {Array} - 標準化された食草配列
 */
export const parseIntegratedHostPlants = (row) => {
  const hostPlants = [];
  
  // 主要食草1-10を処理
  for (let i = 1; i <= 10; i++) {
    const plantName = row[`主要食草${i}`]?.trim();
    const plantFamily = row[`主要食草科${i}`]?.trim();
    const observationType = row[`観察タイプ${i}`]?.trim();
    const plantPart = row[`利用部位${i}`]?.trim();
    const lifeStage = row[`利用ステージ${i}`]?.trim();
    const reference = row[`出典${i}`]?.trim();
    const notes = row[`食草備考${i}`]?.trim();
    
    // 食草データが存在し、かつ"不明"でない場合のみ追加
    // 空文字列やundefinedの場合は追加しない（昆虫自体は表示対象）
    if (plantName && plantName !== '不明' && plantName !== '') {
      // 標準的な表示用文字列を作成（既存システムとの互換性）
      let displayName = plantName;
      if (plantFamily) {
        displayName += `（${plantFamily}）`;
      }
      
      // 詳細情報付きオブジェクトとして格納
      hostPlants.push({
        name: plantName,
        family: plantFamily || '',
        displayName: displayName,
        observationType: observationType || '野外（国内）',
        plantPart: plantPart || '葉',
        lifeStage: lifeStage || '幼虫',
        reference: reference || '',
        notes: notes || '',
        isDetailed: true  // 詳細情報付きであることを示すフラグ
      });
    }
  }
  
  return hostPlants;
};

/**
 * 統合CSVの発生時期データを解析
 * @param {Object} row - CSVの行データ
 * @returns {Array} - 発生時期情報配列
 */
export const parseIntegratedEmergenceTime = (row) => {
  const emergenceData = [];
  
  for (let i = 1; i <= 2; i++) {
    const period = row[`発生時期${i}`]?.trim();
    const source = row[`発生時期出典${i}`]?.trim();
    const region = row[`発生地域${i}`]?.trim();
    const notes = row[`発生時期備考${i}`]?.trim();
    
    if (period && period !== '不明' && period !== '') {
      emergenceData.push({
        period: period,
        source: source || '',
        region: region || '',
        notes: notes || ''
      });
    }
  }
  
  return emergenceData;
};

/**
 * 統合CSVデータを既存フォーマットに変換
 * @param {Array} csvData - 統合CSVの解析済みデータ
 * @returns {Object} - 分類群別に整理されたデータ
 */

export const convertIntegratedDataToStandardFormat = (csvData) => {
  const result = createEmptyInsectCollections(() => []);
  
  csvData.forEach((row, index) => {
    try {
      const classification = row['分類群']?.trim();
      const insectId = row['昆虫ID']?.trim();
      
      if (!classification || !insectId) {
        logger.warn(`統合データ警告: 行${index + 1}で分類群または昆虫IDが不明`);
        return;
      }
      
      // 食草データを解析
      const hostPlants = parseIntegratedHostPlants(row);
      const emergenceData = parseIntegratedEmergenceTime(row);
      
      // 基本昆虫データを構築
      const insectData = {
        id: insectId,
        name: row['和名']?.trim() || '不明',
        scientificName: row['学名']?.trim() || '',
        family: row['科和名']?.trim() || row['科名']?.trim() || '',
        subfamily: row['亜科和名']?.trim() || row['亜科名']?.trim() || '',
        genus: row['属名']?.trim() || '',
        species: row['種小名']?.trim() || '',
        author: row['著者']?.trim() || '',
        year: row['公表年']?.trim() || '',
        classification: {
          family: row['科名']?.trim() || '',
          familyJapanese: row['科和名']?.trim() || '',
          subfamily: row['亜科名']?.trim() || '',
          subfamilyJapanese: row['亜科和名']?.trim() || '',
          tribe: row['族名']?.trim() || '',
          tribeJapanese: row['族和名']?.trim() || ''
        },
        // 互換性のための従来形式（配列）
        hostPlants: hostPlants.map(hp => hp.displayName),
        // 新しい詳細形式
        hostPlantsDetailed: hostPlants,
        emergenceTime: emergenceData.length > 0 ? emergenceData[0].period : '',
        emergenceTimeDetailed: emergenceData,
        dataSource: row['データソース']?.trim() || '',
        notes: row['総合備考']?.trim() || '',
        // 分類用フィールド
        type: getInsectType(classification)
      };
      
      // 分類群ごとに振り分け
      switch (classification) {
        case '蛾類':
          result.moths.push(insectData);
          break;
        case '蝶類':
          result.butterflies.push(insectData);
          break;
        case 'タマムシ類':
          result.beetles.push(insectData);
          break;
        case 'カミキリムシ類':
          result.longhornbeetles.push(insectData);
          break;
        case 'ハムシ類':
          result.leafbeetles.push(insectData);
          break;
        default:
          logger.warn(`未知の分類群: ${classification} (昆虫ID: ${insectId})`);
      }
      
    } catch (error) {
      logger.error(`統合データ処理エラー (行${index + 1}):`, error, row);
    }
  });
  
  logger.debug('統合データ変換完了:', {
    moths: result.moths.length,
    butterflies: result.butterflies.length,
    beetles: result.beetles.length,
    longhornbeetles: result.longhornbeetles.length,
    leafbeetles: result.leafbeetles.length,
    total: result.moths.length + result.butterflies.length + result.beetles.length + result.longhornbeetles.length + result.leafbeetles.length
  });
  
  return result;
};

/**
 * 分類群から昆虫タイプを決定
 * @param {string} classification - 分類群
 * @returns {string} - 昆虫タイプ
 */
const getInsectType = (classification) => {
  switch (classification) {
    case '蛾類': return 'moth';
    case '蝶類': return 'butterfly';
    case 'タマムシ類': return 'beetle';
    case 'カミキリムシ類': return 'longhornbeetle';
    case 'ハムシ類': return 'leafbeetle';
    default: return 'unknown';
  }
};

/**
 * フォールバック処理: 統合データが利用できない場合の処理
 * @param {Array} legacyData - 従来形式のデータ
 * @returns {Array} - 統合データ形式に変換されたデータ
 */
export const convertLegacyToIntegratedFormat = (legacyData, insectType = 'moth') => {
  return legacyData.map((item, index) => {
    // 食草データを新形式に変換
    const hostPlantsDetailed = (item.hostPlants || []).map(plantText => ({
      name: plantText.replace(/（.*）$/, ''), // 科名を除去
      family: extractFamily(plantText),
      displayName: plantText,
      observationType: '野外（国内）', // デフォルト
      plantPart: '葉', // デフォルト
      lifeStage: '幼虫', // デフォルト
      reference: '', // 既存データでは不明
      notes: '',
      isDetailed: false // 推定データであることを示す
    }));
    
    return {
      ...item,
      hostPlantsDetailed: hostPlantsDetailed,
      emergenceTimeDetailed: item.emergenceTime ? [{ 
        period: item.emergenceTime, 
        source: '', 
        region: '', 
        notes: '' 
      }] : [],
      type: insectType,
      dataSource: 'legacy'
    };
  });
};

/**
 * 科名を抽出するヘルパー関数
 * @param {string} plantText - 植物名テキスト
 * @returns {string} - 科名
 */
const extractFamily = (plantText) => {
  const match = plantText.match(/（([^）]+科)）/);
  return match ? match[1] : '';
};

/**
 * データ品質チェック
 * @param {Object} data - 統合データ
 * @returns {Object} - 品質レポート
 */
export const validateIntegratedData = (data) => {
  const report = {
    totalRecords: 0,
    withHostPlants: 0,
    withDetailedHostPlants: 0,
    withEmergenceTime: 0,
    errors: []
  };
  
  INSECT_COLLECTION_KEYS.forEach(type => {
    if (data[type]) {
      data[type].forEach((item, index) => {
        report.totalRecords++;
        
        if (item.hostPlants && item.hostPlants.length > 0) {
          report.withHostPlants++;
        }
        
        if (item.hostPlantsDetailed && item.hostPlantsDetailed.length > 0) {
          report.withDetailedHostPlants++;
        }
        
        if (item.emergenceTime) {
          report.withEmergenceTime++;
        }
        
        // データ検証
        if (!item.name || item.name === '不明') {
          report.errors.push(`${type}[${index}]: 和名が不明`);
        }
        
        if (!item.scientificName) {
          report.errors.push(`${type}[${index}]: 学名が未設定`);
        }
      });
    }
  });
  
  return report;
};
