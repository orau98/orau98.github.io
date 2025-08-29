// 学名フォーマッティングユーティリティ
// 属名と種小名のみをイタリック体にし、著者名と年は通常体にする

/**
 * 学名を正しくフォーマットする関数
 * @param {string} scientificName - 学名（著者名・年含む）
 * @returns {string} - フォーマットされたHTMLマークアップ
 */
export const formatScientificNameHTML = (scientificName) => {
  if (!scientificName || scientificName.trim() === '') {
    return '';
  }

  const trimmed = scientificName.trim();
  
  // 括弧で囲まれた著者名と年を検出
  const bracketPattern = /^(.+?)\s*(\([^)]+\))\s*$/;
  const bracketMatch = trimmed.match(bracketPattern);
  
  if (bracketMatch) {
    const nameWithoutBracket = bracketMatch[1].trim();
    const bracketInfo = bracketMatch[2];
    
    // 属名と種小名を分離（最初の2語のみを取得）
    const nameParts = nameWithoutBracket.split(/\s+/);
    if (nameParts.length >= 2) {
      const genus = nameParts[0];
      const species = nameParts[1];
      const binomialName = `${genus}\u00A0${species}`; // ノーブレークスペース
      const extraInfo = nameParts.slice(2).join(' ');
      
      // イタリック体の学名 + 通常体の著者情報
      return `<em>${binomialName}</em>${extraInfo ? ' ' + extraInfo : ''} ${bracketInfo}`;
    }
  }
  
  // 括弧なしで著者名と年が含まれる場合（例：Genus species Author, 1900）
  const authorYearPattern = /^([A-Z][a-z]+\s+[a-z]+)\s+([A-Z][a-zA-Z\s&.]+(?:,?\s*\d{4})?)\s*$/;
  const authorYearMatch = trimmed.match(authorYearPattern);
  
  if (authorYearMatch) {
    const [genus, species] = authorYearMatch[1].split(/\s+/);
    const binomialName = `${genus}\u00A0${species}`; // ノーブレークスペース
    const authorYear = authorYearMatch[2];
    
    return `<em>${binomialName}</em> ${authorYear}`;
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

  const trimmed = scientificName.trim();
  
  // 括弧で囲まれた著者名と年を検出
  const bracketPattern = /^(.+?)\s*(\([^)]+\))\s*$/;
  const bracketMatch = trimmed.match(bracketPattern);
  
  if (bracketMatch) {
    const nameWithoutBracket = bracketMatch[1].trim();
    const bracketInfo = bracketMatch[2];
    
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
          {` ${bracketInfo}`}
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
        {` ${authorYear}`}
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
  const parts = trimmed.split(/\s+/);
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
  
  // それ以外の場合は全体をイタリック体にする
  return <em>{trimmed}</em>;
};
