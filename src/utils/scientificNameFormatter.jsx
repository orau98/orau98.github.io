import React from 'react';
import { isEnglishLocale } from './locale.js';

// 学名フォーマッティングユーティリティ
// 属名と種小名のみをイタリック体にし、著者名と年は通常体にする

export const isScientificNameLike = (value = '') => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return false;
  return /[A-Za-z]/.test(text) && !/[\u3040-\u30FF\u3400-\u9FFF]/.test(text);
};

// 潰れた二名法表記を表示用に修復する（例: "Genusspecies" → "Genus species"、
// ファイル名由来の "Genus_species" → "Genus species"）。
// 種小名3文字以上を要求し "Carex" のような一語の属名は誤分割しない。
// ※ formatScientificNameHTML 内部の preRepair はスペース無し一語を信頼して
//   分割しない方針のため、こちらはカード見出し等の明示的な修復用途で使う。
export const repairScientificBinomial = (name) => {
  if (!name || typeof name !== 'string') return name;
  const t = name.trim();
  if (!t) return t;
  if (t.includes(' ')) return t;
  // From filename pattern Genus_species
  if (t.includes('_')) {
    const mU = t.match(/^([A-Z][a-z]+)_([a-z-]{2,})(.*)$/);
    if (mU) return `${mU[1]} ${mU[2]}${mU[3] || ''}`;
  }
  const m = t.match(/^([A-Z][a-z]+)([a-z-]{3,})(.*)$/);
  if (m) return `${m[1]} ${m[2]}${m[3] || ''}`;
  return t;
};

// 学名から亜種小名だけを落とし、種小名・著者名・年は保持する。
export const dropSubspeciesEpithet = (name) => {
  if (!name || typeof name !== 'string') return name;

  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 2) return name; // もともと亜種がない

  const genus = tokens[0];
  if (!genus) return name;

  // 亜属 (Subgenus) を飛ばしつつ最初の小文字トークンを種小名とみなす
  let speciesIdx = -1;
  for (let i = 1; i < tokens.length; i += 1) {
    const t = tokens[i];
    if (/^\(.*\)$/.test(t)) continue; // (Subgenus) をスキップ
    if (/^[a-z][a-z-]*$/.test(t)) { // 純小文字（ハイフン含む）は種小名候補
      speciesIdx = i;
      break;
    }
  }
  if (speciesIdx === -1) return name; // 種が見つからない場合はそのまま

  const species = tokens[speciesIdx];

  const output = [genus, species];
  let skippingInfraspecific = true; // 種直後の純小文字を亜種扱いで除外

  for (let i = speciesIdx + 1; i < tokens.length; i += 1) {
    const t = tokens[i];

    // 亜属など括弧付きはそのまま残す（ただし subspecies とは無関係）
    if (/^\(.*\)$/.test(t)) {
      output.push(t);
      skippingInfraspecific = false;
      continue;
    }

    // 変種/品種などの階級表記（var., f., ssp., subsp. など）は表示しない
    if (/^(subsp\.?|ssp\.?|var\.?|f\.?|forma)$/i.test(t)) {
      skippingInfraspecific = true;
      continue;
    }

    // 種の後に続く純小文字は亜種小名としてスキップ（著者名など大文字開始は残す）
    if (skippingInfraspecific && /^[a-z][a-z-]*$/.test(t)) {
      continue;
    }

    // ここまで来たら著者名・年などなので残す
    output.push(t);
    skippingInfraspecific = false;
  }

  return output.join(' ').replace(/\s+/g, ' ').trim();
};

/**
 * 学名を正しくフォーマットする関数
 * @param {string} scientificName - 学名（著者名・年含む）
 * @returns {string} - フォーマットされたHTMLマークアップ
 */
export const formatScientificNameHTML = (scientificName) => {
  if (!scientificName || scientificName.trim() === '') {
    return '';
  }
  // Pre-repair collapsed binomials like "Genusspecies" -> "Genus species"
  const preRepair = (s) => {
    const t = (s || '').trim();
    if (!t) return t;
    // Underscore variant from filenames: Genus_species -> Genus species
    if (t.includes('_')) {
      const mU = t.match(/^([A-Z][a-z]+)_([a-z-]{2,})(.*)$/);
      if (mU) return `${mU[1]} ${mU[2]}${mU[3] || ''}`;
    }
    // Do NOT attempt to split single-word capitalized strings like "Carex" into "Ca rex"
    // If there are no spaces, trust the input as-is.
    if (!t.includes(' ')) return t;
    return t;
  };

  const trimmed = preRepair(scientificName);
  
  // 括弧で囲まれた著者名と年を検出
  const bracketPattern = /^(.+?)\s*(\([^)]+\))\s*$/;
  const bracketMatch = trimmed.match(bracketPattern);
  
  if (bracketMatch) {
    const nameWithoutBracket = bracketMatch[1].trim();
    const bracketInfo = bracketMatch[2];
    
    // 亜属を含む形式: Genus (Subgenus) species [...]
    const gss = nameWithoutBracket.match(/^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s+([a-z-]+)(\s+.*)?$/);
    if (gss) {
      const genus = gss[1];
      const subgenus = gss[2];
      const species = gss[3];
      const extraInfo = (gss[4] || '').trim();
      return `<em>${genus}</em> (<em>${subgenus}</em>) <em>${species}</em>${extraInfo ? ' ' + extraInfo : ''} <span class="sci-author">${bracketInfo}</span>`;
    }

    // 属名と種小名を分離（最初の2語のみを取得）
    const nameParts = nameWithoutBracket.split(/\s+/);
    if (nameParts.length >= 2) {
      const genus = nameParts[0];
      const species = nameParts[1];
      const binomialName = `${genus}\u00A0${species}`; // ノーブレークスペース
      const extraInfo = nameParts.slice(2).join(' ');
      
      // イタリック体の学名 + 通常体(400固定)の著者情報
      return `<em>${binomialName}</em>${extraInfo ? ' ' + extraInfo : ''} <span class="sci-author">${bracketInfo}</span>`;
    }
  }
  
  // 括弧なしで著者名と年が含まれる場合（例：Genus species Author, 1900）
  const authorYearPattern = /^([A-Z][a-z]+\s+[a-z]+)\s+([A-Z][a-zA-Z\s&.]+(?:,?\s*\d{4})?)\s*$/;
  const authorYearMatch = trimmed.match(authorYearPattern);
  
  if (authorYearMatch) {
    const [genus, species] = authorYearMatch[1].split(/\s+/);
    const binomialName = `${genus}\u00A0${species}`; // ノーブレークスペース
    const authorYear = authorYearMatch[2];
    
    return `<em>${binomialName}</em> <span class="sci-author">${authorYear}</span>`;
  }
  
  // 属名・種小名のみの場合
  const binomialPattern = /^([A-Z][a-z]+\s+[a-z]+)(\s+.*)?$/;
  const binomialMatch = trimmed.match(binomialPattern);
  
  if (binomialMatch) {
    const [genus, species] = binomialMatch[1].split(/\s+/);
    const binomialName = `${genus}\u00A0${species}`; // ノーブレークスペース
    const extraInfo = binomialMatch[2] || '';
    
    return `<em>${binomialName}</em>${extraInfo}`;
  }
  
  // 属名 (亜属) 種小名 の場合（例：Genus (Subgenus) amabilis）
  const genusSubgenusSpeciesPattern = /^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s+([a-z-]+)(\s+.*)?$/;
  const genusSubgenusSpeciesMatch = trimmed.match(genusSubgenusSpeciesPattern);
  if (genusSubgenusSpeciesMatch) {
    const genus = genusSubgenusSpeciesMatch[1];
    const subgenus = genusSubgenusSpeciesMatch[2];
    const species = genusSubgenusSpeciesMatch[3];
    const extra = genusSubgenusSpeciesMatch[4] || '';
    return `<em>${genus}</em> (<em>${subgenus}</em>) <em>${species}</em>${extra}`;
  }

  // 属名のみで亜属名が括弧内にある場合（例：Paridea (Paridea)）
  const genusSubgenusPattern = /^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s*$/;
  const genusSubgenusMatch = trimmed.match(genusSubgenusPattern);
  
  if (genusSubgenusMatch) {
    const genus = genusSubgenusMatch[1];
    const subgenus = genusSubgenusMatch[2];
    
    return `<em>${genus}</em> (${subgenus})`;
  }
  
  // フォールバック: 最初の2語のみをイタリック体にする
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const binomialName = `${parts[0]}\u00A0${parts[1]}`; // ノーブレークスペース
    const remaining = parts.slice(2).join(' ');
    
    return `<em>${binomialName}</em>${remaining ? ' ' + remaining : ''}`;
  }
  
  // それ以外の場合は全体をイタリック体にする
  return `<em>${trimmed}</em>`;
};

/**
 * 学名をReactコンポーネント用にフォーマットする関数
 * @param {string} scientificName - 学名（著者名・年含む）
 * @returns {JSX.Element} - フォーマットされたReact要素
 */
export const formatScientificNameReact = (scientificName) => {
  if (!scientificName || scientificName.trim() === '') {
    return null;
  }
  // Pre-repair collapsed binomials like "Genusspecies" -> "Genus species"
  const preRepair = (s) => {
    const t = (s || '').trim();
    if (!t) return t;
    if (t.includes('_')) {
      const mU = t.match(/^([A-Z][a-z]+)_([a-z-]{2,})(.*)$/);
      if (mU) return `${mU[1]} ${mU[2]}${mU[3] || ''}`;
    }
    // Avoid incorrectly splitting single-word genus names (e.g., "Carex")
    if (!t.includes(' ')) return t;
    return t;
  };

  const trimmed = preRepair(scientificName);
  
  // 括弧で囲まれた著者名と年を検出
  const bracketPattern = /^(.+?)\s*(\([^)]+\))\s*$/;
  const bracketMatch = trimmed.match(bracketPattern);
  
  if (bracketMatch) {
    const nameWithoutBracket = bracketMatch[1].trim();
    const bracketInfo = bracketMatch[2];
    
    // 亜属を含む形式: Genus (Subgenus) species [...]
    const gss = nameWithoutBracket.match(/^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s+([a-z-]+)(\s+.*)?$/);
    if (gss) {
      const genus = gss[1];
      const subgenus = gss[2];
      const species = gss[3];
      const extraInfo = (gss[4] || '').trim();
      return (
        <>
          <em>{genus}</em> (<em>{subgenus}</em>) <em>{species}</em>
          {extraInfo && ` ${extraInfo}`}
          {' '}
          <span className="sci-author">{bracketInfo}</span>
        </>
      );
    }

    // 属名と種小名を分離（最初の2語のみを取得）
    const nameParts = nameWithoutBracket.split(/\s+/);
    if (nameParts.length >= 2) {
      const genus = nameParts[0];
      const species = nameParts[1];
      const extraInfo = nameParts.slice(2).join(' ');
      
      return (
        <>
          <em className="whitespace-nowrap">{genus}{'\u00A0'}{species}</em>
          {extraInfo && ` ${extraInfo}`}
          {' '}
          <span className="sci-author">{bracketInfo}</span>
        </>
      );
    }
  }
  
  // 括弧なしで著者名と年が含まれる場合（例：Genus species Author, 1900）
  const authorYearPattern = /^([A-Z][a-z]+\s+[a-z]+)\s+([A-Z][a-zA-Z\s&.]+(?:,?\s*\d{4})?)\s*$/;
  const authorYearMatch = trimmed.match(authorYearPattern);
  
  if (authorYearMatch) {
    const [genus, species] = authorYearMatch[1].split(/\s+/);
    const authorYear = authorYearMatch[2];
    
    return (
      <>
        <em className="whitespace-nowrap">{genus}{'\u00A0'}{species}</em>
        {' '}
        <span className="sci-author">{authorYear}</span>
      </>
    );
  }
  
  // 属名・種小名のみの場合
  const binomialPattern = /^([A-Z][a-z]+\s+[a-z]+)(\s+.*)?$/;
  const binomialMatch = trimmed.match(binomialPattern);
  
  if (binomialMatch) {
    const [genus, species] = binomialMatch[1].split(/\s+/);
    const extraInfo = binomialMatch[2] || '';
    
    return (
      <>
        <em className="whitespace-nowrap">{genus}{'\u00A0'}{species}</em>
        {extraInfo}
      </>
    );
  }
  
  // 属名 (亜属) 種小名 の場合（例：Genus (Subgenus) amabilis）
  const genusSubgenusSpeciesPattern = /^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s+([a-z-]+)(\s+.*)?$/;
  const genusSubgenusSpeciesMatch = trimmed.match(genusSubgenusSpeciesPattern);
  if (genusSubgenusSpeciesMatch) {
    const genus = genusSubgenusSpeciesMatch[1];
    const subgenus = genusSubgenusSpeciesMatch[2];
    const species = genusSubgenusSpeciesMatch[3];
    const extra = genusSubgenusSpeciesMatch[4] || '';
    return (
      <>
        <em>{genus}</em> (<em>{subgenus}</em>) <em>{species}</em>
        {extra}
      </>
    );
  }

  // 属名のみで亜属名が括弧内にある場合（例：Paridea (Paridea)）
  const genusSubgenusPattern = /^([A-Z][a-z]+)\s+\(([A-Z][a-z]+)\)\s*$/;
  const genusSubgenusMatch = trimmed.match(genusSubgenusPattern);
  
  if (genusSubgenusMatch) {
    const genus = genusSubgenusMatch[1];
    const subgenus = genusSubgenusMatch[2];
    
    return (
      <>
        <em>{genus}</em> ({subgenus})
      </>
    );
  }
  
  // フォールバック: 最初の2語のみをイタリック体にする
  // 種小名位置が "sp." / "sp" / "属" 等の非学名トークンなら属名だけイタリックにし、
  // これらはローマン体のまま残す（"Carex sp"、"Schima属" の誤ったイタリック化を防ぐ）。
  const NON_SPECIES_TOKEN = /^(sp{1,2}\.?|属|cf\.?|aff\.?|indet\.?)$/i;
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && NON_SPECIES_TOKEN.test(parts[1])) {
    const genus = parts[0];
    const remaining = parts.slice(1).join(' ');
    return (
      <>
        <em>{genus}</em>
        {remaining && ` ${remaining}`}
      </>
    );
  }
  if (parts.length >= 2) {
    const genus = parts[0];
    const species = parts[1];
    const remaining = parts.slice(2).join(' ');
    
    return (
      <>
        <em className="whitespace-nowrap">{genus}{'\u00A0'}{species}</em>
        {remaining && ` ${remaining}`}
      </>
    );
  }
  
  // 単語1つ。「◯◯属」など日本語の属名連結はローマン体のまま
  if (/属$/.test(trimmed)) {
    return trimmed;
  }
  // それ以外の場合は全体をイタリック体にする
  return <em>{trimmed}</em>;
};

export const renderLocalizedScientificNameListReact = (values = [], locale = 'ja') => {
  const items = Array.isArray(values)
    ? values
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : [];
  const separator = isEnglishLocale(locale) ? ', ' : '、';

  return items.map((value, index) => (
    <React.Fragment key={`${value}-${index}`}>
      {index > 0 && separator}
      {isScientificNameLike(value) ? formatScientificNameReact(value) : value}
    </React.Fragment>
  ));
};
