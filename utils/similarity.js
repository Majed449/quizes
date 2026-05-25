/**
 * Normalizes Arabic text by removing tashkeel (diacritics),
 * standardizing letters (Alef, Yeh, Teh Marbuta), and stripping punctuation.
 * 
 * @param {string} text 
 * @returns {string}
 */
function normalizeArabic(text) {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    // Remove Arabic diacritics (tashkeel/harakat)
    .replace(/[\u064B-\u0652]/g, '')
    // Normalize Alef variants to bare Alef
    .replace(/[أإآ]/g, 'ا')
    // Normalize Yeh / Alef Maksura to standard Yeh
    .replace(/ى/g, 'ي')
    // Normalize Teh Marbuta to Heh
    .replace(/ة/g, 'ه')
    // Remove standard Arabic/English punctuation and symbols
    .replace(/[؟!\.,\-\:;()\{\}\[\]"']/g, ' ')
    // Replace multiple spaces/tabs with single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates character bigrams of a string.
 * @param {string} str 
 * @returns {Set<string>}
 */
function getBigrams(str) {
  const bigrams = new Set();
  for (let i = 0; i < str.length - 1; i++) {
    bigrams.add(str.substring(i, i + 2));
  }
  return bigrams;
}

/**
 * Calculates similarity score between two normalized strings
 * using a hybrid Sorensen-Dice bigram and word-token overlap coefficient.
 * 
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Value between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  const norm1 = normalizeArabic(str1);
  const norm2 = normalizeArabic(str2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  // 1. Character-level Bigram Sorensen-Dice similarity
  let dice = 0;
  if (norm1.length >= 2 && norm2.length >= 2) {
    const bigrams1 = getBigrams(norm1);
    const bigrams2 = getBigrams(norm2);
    let intersection = 0;
    for (const b of bigrams1) {
      if (bigrams2.has(b)) {
        intersection++;
      }
    }
    dice = (2 * intersection) / (bigrams1.size + bigrams2.size);
  } else {
    // Fallback for extremely short words
    dice = norm1 === norm2 ? 1.0 : 0.0;
  }

  // 2. Word token overlap similarity (Jaccard index on words)
  const words1 = new Set(norm1.split(' ').filter(Boolean));
  const words2 = new Set(norm2.split(' ').filter(Boolean));
  let wordMatches = 0;
  for (const w of words1) {
    if (words2.has(w)) {
      wordMatches++;
    }
  }
  const unionSize = new Set([...words1, ...words2]).size;
  const jaccard = unionSize > 0 ? (wordMatches / unionSize) : 0;

  // 3. Combined hybrid similarity (Dice accounts for typos, Jaccard accounts for correct words)
  return 0.4 * dice + 0.6 * jaccard;
}

module.exports = {
  normalizeArabic,
  calculateSimilarity
};
