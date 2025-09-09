// 正規化データの解析・処理ユーティリティ

/**
 * 正規化された3つのCSVファイルを統合して昆虫データを構築
 * @param {Array} insectsData - insects.csvの解析済みデータ
 * @param {Array} hostplantsData - hostplants.csvの解析済みデータ  
 * @param {Array} generalNotesData - general_notes.csvの解析済みデータ
 * @returns {Object} - 分類群別に整理されたデータ
 */
import logger from './logger';

export const convertNormalizedDataToStandardFormat = (insectsData, hostplantsData, generalNotesData) => {
  const result = {
    moths: [],
    butterflies: [],
    beetles: [],
    leafbeetles: []
  };

  // 食草データをinsect_idでグループ化
  const hostPlantsByInsect = {};
  hostplantsData.forEach(hp => {
    if (!hostPlantsByInsect[hp.insect_id]) {
      hostPlantsByInsect[hp.insect_id] = [];
    }
    
    // 表示用の食草名を構築
    let displayName = hp.plant_name;
    if (hp.plant_family && hp.plant_family !== '以上バラ科' && hp.plant_family !== '以上ブナ科') {
      displayName += `（${hp.plant_family}）`;
    }
    
    // species-6115のデバッグログ
    if (hp.insect_id === 'species-6115') {
      logger.debug('DEBUG species-6115 hostplant data:', {
        plant_name: hp.plant_name,
        observation_type: hp.observation_type,
        plant_part: hp.plant_part,
        life_stage: hp.life_stage,
        reference: hp.reference,
        notes: hp.notes
      });
    }
    
    hostPlantsByInsect[hp.insect_id].push({
      name: hp.plant_name,
      family: hp.plant_family || '',
      displayName: displayName,
      observationType: hp.observation_type || '野外（国内）',
      plantPart: hp.plant_part || '葉',
      lifeStage: hp.life_stage || '幼虫',
      reference: hp.reference || '',
      notes: hp.notes || '',
      isDetailed: true
    });
  });

  // 総合備考をinsect_idでグループ化
  const generalNotesByInsect = {};
  generalNotesData.forEach(note => {
    if (!generalNotesByInsect[note.insect_id]) {
      generalNotesByInsect[note.insect_id] = [];
    }
    generalNotesByInsect[note.insect_id].push({
      type: note.note_type,
      content: note.content,
      reference: note.reference || '',
      page: note.page || '',
      year: note.year || ''
    });
  });

  // 昆虫データを処理
  insectsData.forEach((insect, index) => {
    try {
      const insectId = insect.insect_id?.trim();
      if (!insectId) {
        // 空行や無効行は静かにスキップ（ノイズ抑制）
        const values = Object.values(insect).map(v => (v || '').toString().trim());
        const nonEmptyCount = values.filter(v => v).length;
        if (nonEmptyCount > 0) {
          // 何らかの値があるがIDがない場合のみデバッグ出力
          logger.debug(`正規化データ注意: 行${index + 1}で昆虫IDが未設定（スキップ）`);
        }
        return;
      }

      // 食草データを取得
      const hostPlants = hostPlantsByInsect[insectId] || [];
      const generalNotes = generalNotesByInsect[insectId] || [];
      
      // species-6115のデバッグログ
      if (insectId === 'species-6115') {
        logger.debug('DEBUG species-6115 processing:', {
          insectId: insectId,
          hostPlants: hostPlants,
          hostPlantsCount: hostPlants.length
        });
        
        hostPlants.forEach((hp, idx) => {
          logger.debug(`DEBUG species-6115 hostPlant[${idx}]:`, {
            name: hp.name,
            observationType: hp.observationType,
            plantPart: hp.plantPart,
            lifeStage: hp.lifeStage
          });
        });
      }

      // 基本昆虫データを構築
      // 別名の統合（旧和名・別名・その他の和名）
      const primaryName = (insect.japanese_name || '').trim();
      const altNamesRaw = [];
      const oldName = (insect.old_japanese_name || '').trim();
      const altName = (insect.alternative_name || '').trim();
      const otherNames = (insect.other_names || '').trim();
      if (oldName) altNamesRaw.push(oldName);
      if (altName) altNamesRaw.push(...altName.split(/[、,，]/).map(s => s.trim()).filter(Boolean));
      if (otherNames) altNamesRaw.push(...otherNames.split(/[、,，]/).map(s => s.trim()).filter(Boolean));
      // remove exact duplicates and names identical to the primary name
      const altNames = Array.from(new Set(altNamesRaw.filter(n => n && n !== primaryName)));
      const alternativeNames = altNames.join('、');

      const insectData = {
        id: insectId,
        name: insect.japanese_name?.trim() || '不明',
        scientificName: insect.scientific_name?.trim() || '',
        family: insect.family_jp?.trim() || insect.family?.trim() || '',
        subfamily: insect.subfamily_jp?.trim() || insect.subfamily?.trim() || '',
        genus: insect.genus?.trim() || '',
        species: insect.species?.trim() || '',
        author: insect.author?.trim() || '',
        year: insect.year?.trim() || '',
        classification: {
          family: insect.family?.trim() || '',
          familyJapanese: insect.family_jp?.trim() || '',
          subfamily: insect.subfamily?.trim() || '',
          subfamilyJapanese: insect.subfamily_jp?.trim() || '',
          tribe: insect.tribe?.trim() || '',
          tribeJapanese: insect.tribe_jp?.trim() || ''
        },
        // 従来形式（配列）- 後方互換性のため
        hostPlants: hostPlants.map(hp => hp.displayName),
        // 新しい詳細形式
        hostPlantsDetailed: hostPlants,
        // 総合備考
        generalNotes: generalNotes,
        dataSource: 'normalized_csv',
        notes: insect.notes?.trim() || '',
        alternativeNames,
        // 分類用フィールド
        type: getInsectTypeFromFamily(insect.family_jp || insect.family || '')
      };

      // general_notes から出現時期を既存フィールドへも反映（表示の安定化のため）
      try {
        const emergenceFromNotes = (generalNotes || []).find(n => {
          const t = (n.type || '').trim();
          const c = (n.content || '').trim();
          if (!c) return false;
          const typeHit = ['出現時期', '発生時期', '成虫発生時期', '成虫の発生時期', '出現', '時期']
            .some(k => t.includes(k));
          const contentHit = /\d+\s*月|成虫|発生/.test(c);
          return typeHit || (!t && contentHit);
        });
        if (emergenceFromNotes && (!insectData.emergenceTime || insectData.emergenceTime === '不明')) {
          insectData.emergenceTime = emergenceFromNotes.content;
          insectData.emergenceTimeSource = emergenceFromNotes.reference || '';
          insectData.emergenceTimeDescription = emergenceFromNotes.page ? `p.${emergenceFromNotes.page}` : '';
        }
      } catch {}

      // 分類群ごとに振り分け
      const classification = classifyInsect(insect);
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
        case 'ハムシ類':
          result.leafbeetles.push(insectData);
          break;
        default:
          // デフォルトは蛾類として扱う
          result.moths.push(insectData);
      }

    } catch (error) {
      logger.error(`正規化データ処理エラー (行${index + 1}):`, error, insect);
    }
  });

  logger.debug('正規化データ変換完了:', {
    moths: result.moths.length,
    butterflies: result.butterflies.length,
    beetles: result.beetles.length,
    leafbeetles: result.leafbeetles.length,
    total: result.moths.length + result.butterflies.length + result.beetles.length + result.leafbeetles.length
  });

  return result;
};;

/**
 * 昆虫の分類群を判定
 * @param {Object} insect - 昆虫データ
 * @returns {string} - 分類群
 */
const classifyInsect = (insect) => {
  const familyJp = insect.family_jp?.trim() || '';
  const family = insect.family?.trim() || '';
  
  // 日本語科名による判定
  if (familyJp.includes('チョウ') || familyJp.includes('シジミ') || familyJp.includes('セセリ')) {
    return '蝶類';
  }
  
  if (familyJp.includes('タマムシ')) {
    return 'タマムシ類';
  }
  
  if (familyJp.includes('ハムシ')) {
    return 'ハムシ類';
  }
  
  // 英語科名による判定
  if (family === 'Chrysomelidae') {
    return 'ハムシ類';
  }
  
  if (family === 'Buprestidae') {
    return 'タマムシ類';
  }
  
  // その他は蛾類として扱う
  return '蛾類';
};

/**
 * 科名から昆虫タイプを決定（後方互換性のため）
 * @param {string} family - 科名
 * @returns {string} - 昆虫タイプ
 */
const getInsectTypeFromFamily = (family) => {
  if (family.includes('チョウ') || family.includes('シジミ') || family.includes('セセリ')) {
    return 'butterfly';
  }
  
  if (family.includes('タマムシ')) {
    return 'beetle';
  }
  
  if (family.includes('ハムシ')) {
    return 'leafbeetle';
  }
  
  return 'moth';
};

/**
 * データ品質チェック
 * @param {Object} data - 正規化データ
 * @returns {Object} - 品質レポート
 */
export const validateNormalizedData = (data) => {
  const report = {
    totalRecords: 0,
    withHostPlants: 0,
    withDetailedHostPlants: 0,
    withGeneralNotes: 0,
    errors: []
  };

  ['moths', 'butterflies', 'beetles', 'leafbeetles'].forEach(type => {
    if (data[type]) {
      data[type].forEach((item, index) => {
        report.totalRecords++;

        if (item.hostPlants && item.hostPlants.length > 0) {
          report.withHostPlants++;
        }

        if (item.hostPlantsDetailed && item.hostPlantsDetailed.length > 0) {
          report.withDetailedHostPlants++;
        }

        if (item.generalNotes && item.generalNotes.length > 0) {
          report.withGeneralNotes++;
        }

        // データ検証
        if (!item.name || item.name === '不明') {
          report.errors.push(`${type}[${index}]: 和名が不明`);
        }

        if (!item.scientificName) {
          report.errors.push(`${type}[${index}]: 学名が未設定 (${item.name})`);
        }
      });
    }
  });

  return report;
};
