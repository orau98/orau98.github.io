/**
 * Formats scientific names according to proper nomenclature rules:
 * - Genus and species names should be italic
 * - Author names and publication years should be in regular font
 */

export const formatScientificName = (scientificName) => {
  if (!scientificName) return null;
  
  // Pattern to match scientific name with author and year
  // e.g., "Genus species (Author, Year)" or "Genus species Author, Year"
  const namePattern = /^([A-Z][a-z]+\s+[a-z]+)(.*)$/;
  const match = scientificName.match(namePattern);
  
  if (!match) {
    // If no match, assume the entire string is the binomial name and italicize all
    return <em>{scientificName}</em>;
  }
  
  const [, binomialName, authorInfo] = match;
  
  return (
    <>
      <em>{binomialName}</em>
      {authorInfo && (
        <span className="scientific-name-author">
          {authorInfo}
        </span>
      )}
    </>
  );
};

export default formatScientificName;