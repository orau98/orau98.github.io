// Test normalizePlantName function
const normalizePlantName = (plantName) => {
  if (!plantName || typeof plantName !== 'string') {
    return plantName;
  }
  
  // Remove family annotations like 'アカマツ（マツ科）' -> 'アカマツ'
  let normalized = plantName.replace(/（[^）]*科[^）]*）/g, '');
  normalized = normalized.replace(/\([^)]*科[^)]*\)/g, '');
  
  // Remove incomplete parentheses like 'オオカメノキ（' -> 'オオカメノキ'
  normalized = normalized.replace(/（[^）]*$/g, '');
  normalized = normalized.replace(/\([^)]*$/g, '');
  // Only remove closing parentheses at the start if they look like orphaned closing parentheses
  normalized = normalized.replace(/^）/g, '');
  normalized = normalized.replace(/^\)/g, '');
  
  // Remove other common annotations
  normalized = normalized.replace(/（[^）]*）/g, '');
  normalized = normalized.replace(/\([^)]*\)/g, '');
  
  return normalized.trim();
};

const testString = 'その他の単子葉植物';
console.log('Original:', testString);
console.log('After normalization:', normalizePlantName(testString));

const testString2 = 'イネ科; その他の単子葉植物';
console.log('Original:', testString2);
console.log('After normalization:', normalizePlantName(testString2));

// Test each step
let test = 'その他の単子葉植物';
console.log('\nStep by step:');
console.log('0. Original:', test);

test = 'その他の単子葉植物';
test = test.replace(/（[^）]*科[^）]*）/g, '');
console.log('1. After family removal:', test);

test = test.replace(/\([^)]*科[^)]*\)/g, '');
console.log('2. After half-width family removal:', test);

test = test.replace(/（[^）]*$/g, '');
console.log('3. After incomplete opening removal:', test);

test = test.replace(/\([^)]*$/g, '');
console.log('4. After half-width incomplete opening removal:', test);

test = test.replace(/^）/g, '');
console.log('5. After orphaned closing removal:', test);

test = test.replace(/^\)/g, '');
console.log('6. After half-width orphaned closing removal:', test);

test = test.replace(/（[^）]*）/g, '');
console.log('7. After general parentheses removal:', test);

test = test.replace(/\([^)]*\)/g, '');
console.log('8. After half-width general parentheses removal:', test);