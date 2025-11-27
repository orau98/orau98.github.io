// Utilities related to insect image filenames

// Create a safe filename from a scientific name (Genus species ...)
// - Removes authorship/year and parentheses
// - Keeps only Genus and species, joined with underscore
export const createSafeInsectFilename = (scientificName = '') => {
  if (!scientificName) return '';
  let cleanedName = String(scientificName)
    .replace(/\s*\(.*?(?:\)|\s*$)/g, '') // remove parenthetical
    .replace(/\s*,\s*\d{4}\s*$/, '') // remove trailing year
    .replace(/\s*[A-Z][a-zA-Z\s&.,]+\s*\d{4}\s*$/, '') // remove trailing author + year
    .replace(/^([A-Z][a-z]+)\s+([a-z]+).*$/, '$1 $2') // keep genus + species only
    .replace(/[^a-zA-Z0-9\s]/g, '') // remove non-word
    .trim()
    .replace(/\s+/g, '_'); // space to underscore
  return cleanedName;
};

