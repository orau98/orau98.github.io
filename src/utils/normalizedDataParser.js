// 正規化データの解析・処理ユーティリティ

/**
 * 正規化された3つのCSVファイルを統合して昆虫データを構築
 * @param {Array} insectsData - insects.csvの解析済みデータ
 * @param {Array} hostplantsData - hostplants.csvの解析済みデータ  
 * @param {Array} generalNotesData - general_notes.csvの解析済みデータ
 * @returns {Object} - 分類群別に整理されたデータ
 */
import logger from './logger.js';
import { createSafeInsectFilename } from './image.js';

export const convertNormalizedDataToStandardFormat = (insectsData, hostplantsData, generalNotesData) => {
  const result = {
    moths: [],
    butterflies: [],
    beetles: [],
    leafbeetles: []
  };
  const dedupeMaps = {
    moths: new Map(),
    butterflies: new Map(),
    beetles: new Map(),
    leafbeetles: new Map()
  };

  const normalizeScientificBase = (name = '') => {
    const s = (name || '').toString().trim();
    if (!s) return '';
    return s
      .replace(/\([^)]*\)/g, '')
      .replace(/\s+\d{4}.*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  const buildDedupKey = (insectRow, insectData) => {
    const name = (insectData?.name || '').trim();
    if (!name) return null;
    const genus = (insectRow?.genus || insectData?.genus || '').trim();
    const species = (insectRow?.species || insectData?.species || '').trim();
    const subspecies = (insectRow?.subspecies || '').trim();
    let binomial = [genus, species, subspecies].filter(Boolean).join(' ').trim();
    if (!binomial) binomial = normalizeScientificBase(insectData?.scientificName || '');
    if (!binomial) return null; // avoid accidental merges when scientific info is absent
    return `${name}__${binomial.toLowerCase()}`;
  };

  const preferValue = (current, incoming) => {
    const a = (current ?? '').toString().trim();
    const b = (incoming ?? '').toString().trim();
    if (!b) return current;
    if (!a) return incoming;
    return b.length > a.length ? incoming : current;
  };

  const mergeByKey = (baseList = [], incomingList = [], keyFn, mergeFn) => {
    const map = new Map();
    (baseList || []).forEach((item) => {
      if (!item) return;
      const key = keyFn(item);
      if (!key) return;
      map.set(key, item);
    });
    (incomingList || []).forEach((item) => {
      if (!item) return;
      const key = keyFn(item);
      if (!key) return;
      if (map.has(key)) {
        const existing = map.get(key);
        if (mergeFn) mergeFn(existing, item);
      } else {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  };

  const mergeInsectRecords = (target, incoming) => {
    if (!target || !incoming) return target;
    target.scientificName = preferValue(target.scientificName, incoming.scientificName);
    target.scientificFilename = createSafeInsectFilename(target.scientificName);
    target.family = preferValue(target.family, incoming.family);
    target.subfamily = preferValue(target.subfamily, incoming.subfamily);
    target.genus = preferValue(target.genus, incoming.genus);
    target.species = preferValue(target.species, incoming.species);
    target.author = preferValue(target.author, incoming.author);
    target.year = preferValue(target.year, incoming.year);
    target.notes = preferValue(target.notes, incoming.notes);
    target.alternativeNames = preferValue(target.alternativeNames, incoming.alternativeNames);
    target.emergenceTime = preferValue(target.emergenceTime, incoming.emergenceTime);
    target.emergenceTimeSource = preferValue(target.emergenceTimeSource, incoming.emergenceTimeSource);
    target.emergenceTimeDescription = preferValue(target.emergenceTimeDescription, incoming.emergenceTimeDescription);

    const targetClass = target.classification || (target.classification = {});
    const incomingClass = incoming.classification || {};
    ['family', 'familyJapanese', 'subfamily', 'subfamilyJapanese', 'tribe', 'tribeJapanese'].forEach((key) => {
      targetClass[key] = preferValue(targetClass[key], incomingClass[key]);
    });

    target.hostPlants = Array.from(new Set([...(target.hostPlants || []), ...(incoming.hostPlants || [])]));

    const detailKey = (d) => [
      (d?.name || '').trim(),
      (d?.lifeStage || '').trim(),
      (d?.plantPart || '').trim(),
      (d?.reference || '').trim(),
      (d?.notes || '').trim()
    ].join('|');
    const noteKey = (n) => [
      (n?.type || '').trim(),
      (n?.content || '').trim(),
      (n?.reference || '').trim(),
      (n?.page || '').trim(),
      (n?.year || '').trim()
    ].join('|');
    const emergenceKey = (e) => [
      (e?.period || '').trim(),
      (e?.source || '').trim(),
      (e?.region || '').trim(),
      (e?.notes || '').trim()
    ].join('|');

    target.hostPlantsDetailed = mergeByKey(
      target.hostPlantsDetailed || [],
      incoming.hostPlantsDetailed || [],
      detailKey,
      (a, b) => {
        a.displayName = preferValue(a.displayName, b.displayName);
        a.observationType = preferValue(a.observationType, b.observationType);
        a.plantPart = preferValue(a.plantPart, b.plantPart);
        a.lifeStage = preferValue(a.lifeStage, b.lifeStage);
        a.reference = preferValue(a.reference, b.reference);
        a.notes = preferValue(a.notes, b.notes);
      }
    );
    target.generalNotes = mergeByKey(target.generalNotes || [], incoming.generalNotes || [], noteKey);
    target.emergenceTimeDetailed = mergeByKey(target.emergenceTimeDetailed || [], incoming.emergenceTimeDetailed || [], emergenceKey);
    return target;
  };

  // 食草データをinsect_idでグループ化
  const hostPlantsByInsect = {};
  hostplantsData.forEach(hp => {
    if (!hp) return;

    // 無効な食草名を除外（年号や空値の混入対策）
    const rawName = (hp.plant_name || '').trim();
    // 例: "1900)", "[1799])", "1978", "1828)" などを弾く（括弧や角括弧の有無・重複にも対応）
    const looksLikeYearOnly = /^[\[(（]?\s*\d{3,4}\s*[\])）)]*\s*$/.test(rawName);
    const isUnknown = rawName === '' || rawName === '未知' || rawName === '不明';
    if (looksLikeYearOnly || isUnknown) {
      return; // この行はスキップ
    }

    if (!hostPlantsByInsect[hp.insect_id]) {
      hostPlantsByInsect[hp.insect_id] = [];
    }
    
    // 表示用の食草名を構築
    let displayName = rawName;
    if (hp.plant_family && hp.plant_family !== '以上バラ科' && hp.plant_family !== '以上ブナ科') {
      displayName += `（${hp.plant_family}）`;
    }
    
    // species-6115のデバッグログ
    if (hp.insect_id === 'species-6115') {
      logger.debug('DEBUG species-6115 hostplant data:', {
        plant_name: rawName,
        observation_type: hp.observation_type,
        plant_part: hp.plant_part,
        life_stage: hp.life_stage,
        reference: hp.reference,
        notes: hp.notes
      });
    }
    
    const lifeStageRaw = (hp.life_stage || '').trim();
    const plantPartRaw = (hp.plant_part || '').trim();
    const partCompact = plantPartRaw.replace(/\s+/g, '');
    const isAdultOrUnknown = lifeStageRaw === '成虫' || lifeStageRaw === '';
    const isFlowerVisit = isAdultOrUnknown && partCompact && partCompact.includes('花');

    hostPlantsByInsect[hp.insect_id].push({
      name: rawName,
      family: hp.plant_family || '',
      displayName: displayName,
      observationType: hp.observation_type || '野外（国内）',
      // Keep display defaults but preserve flower-visit detection via isFlowerVisit flag.
      plantPart: plantPartRaw || '葉',
      lifeStage: lifeStageRaw || '幼虫',
      reference: hp.reference || '',
      notes: hp.notes || '',
      isDetailed: true,
      isFlowerVisit
    });
  });

  // 総合備考をinsect_idでグループ化
  const generalNotesByInsect = {};
  generalNotesData.forEach(note => {
    if (!generalNotesByInsect[note.insect_id]) {
      generalNotesByInsect[note.insect_id] = [];
    }
    generalNotesByInsect[note.insect_id].push({
      type: note.note_type || note.type || '',
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
      const looksLikeYearOnly = (value = '') => /^[\[(（]?\s*\d{3,4}\s*[\])）)]*\s*$/.test((value || '').toString().trim());
      const rawPrimaryName = (insect.japanese_name || '').trim();
      const primaryName = looksLikeYearOnly(rawPrimaryName) ? '' : rawPrimaryName;
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

      // 和名が欠落/壊れている場合（例: "1758)" など年号だけが入っている）に、表示用の名称をフォールバック
      const displayName = (() => {
        if (primaryName) return primaryName;
        const fallbackFromAlt = altNames.find((n) => n && !looksLikeYearOnly(n));
        if (fallbackFromAlt) return fallbackFromAlt;
        const sci = (insect.scientific_name || '').trim();
        if (sci) return `${sci}（和名未記載）`;
        const genus = (insect.genus || '').trim();
        const species = (insect.species || '').trim();
        const subspecies = (insect.subspecies || '').trim();
        const binomial = [genus, species, subspecies].filter(Boolean).join(' ').trim();
        if (binomial) return `${binomial}（和名未記載）`;
        return '不明';
      })();

      // 出現時期（general_notesからの詳細一覧も構築）
      const emergenceNotes = (generalNotes || []).filter(n => {
        const t = (n.type || '').trim();
        return t.includes('出現時期') || t.includes('成虫発生時期') || t.includes('発生時期') || t.includes('出現');
      }).map(n => ({
        period: (n.content || '').trim(),
        source: (n.reference || '').trim(),
        region: '',
        notes: (n.page || '').trim()
      }));

      // 英語キーでのタイプ判定（UIコンポーネントの条件分岐で使用）
      const getTypeKey = (famJp = '', fam = '') => {
        const fj = (famJp || '').trim();
        const f = (fam || '').trim();
        if (fj.includes('チョウ') || fj.includes('シジミ') || fj.includes('セセリ')) return 'butterfly';
        if (f === 'Chrysomelidae' || fj.includes('ハムシ')) return 'leafbeetle';
        if (f === 'Buprestidae' || fj.includes('タマムシ')) return 'beetle';
        return 'moth';
      };

      const hostPlantList = Array.from(new Set(
        hostPlants
          .filter(hp => !hp.isFlowerVisit)
          .map(hp => hp.displayName)
          .filter(Boolean)
      ));

      const insectData = {
        id: insectId,
        name: displayName,
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
        hostPlants: hostPlantList,
        // 新しい詳細形式
        hostPlantsDetailed: hostPlants,
        // 総合備考
        generalNotes: generalNotes,
        // 詳細な成虫発生時期（ノート由来）
        emergenceTimeDetailed: emergenceNotes,
        dataSource: 'normalized_csv',
        notes: insect.notes?.trim() || '',
        alternativeNames,
        // 分類用フィールド（英語キー）
        type: getTypeKey(insect.family_jp, insect.family)
      };

      insectData.scientificFilename = createSafeInsectFilename(insectData.scientificName);

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

      // 分類群ごとに振り分け（同名・同学名の重複は統合）
      const classification = classifyInsect(insect);
      const pushWithDedupe = (bucket, map) => {
        const key = buildDedupKey(insect, insectData);
        if (key && map.has(key)) {
          mergeInsectRecords(map.get(key), insectData);
          return;
        }
        bucket.push(insectData);
        if (key) map.set(key, insectData);
      };
      switch (classification) {
        case '蛾類':
          pushWithDedupe(result.moths, dedupeMaps.moths);
          break;
        case '蝶類':
          pushWithDedupe(result.butterflies, dedupeMaps.butterflies);
          break;
        case 'タマムシ類':
          pushWithDedupe(result.beetles, dedupeMaps.beetles);
          break;
        case 'ハムシ類':
          pushWithDedupe(result.leafbeetles, dedupeMaps.leafbeetles);
          break;
        default:
          // デフォルトは蛾類として扱う
          pushWithDedupe(result.moths, dedupeMaps.moths);
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
  
  // カミキリムシ（Cerambycidae）を甲虫（beetle）として扱う
  if (familyJp.includes('カミキリ')) {
    return 'タマムシ類'; // beetle bucket（サイトでは beetles 集合に集約）
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
  
  if (family === 'Cerambycidae') {
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
