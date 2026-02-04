const config = require('../config');

/**
 * Age window validation utilities
 */

/**
 * Calculate age range from a target age using configured window
 */
function getAgeRange(targetAge, windowYears) {
  const window = windowYears ?? config.ageWindowYears;
  return {
    min: targetAge - window,
    max: targetAge + window
  };
}

/**
 * Check if an age falls within range of target age
 */
function isAgeInRange(candidateAge, targetAge, windowYears) {
  const range = getAgeRange(targetAge, windowYears);
  return candidateAge >= range.min && candidateAge <= range.max;
}

/**
 * Check if an age falls within explicit min/max range
 */
function isAgeInExplicitRange(candidateAge, minAge, maxAge) {
  if (minAge !== undefined && candidateAge < minAge) return false;
  if (maxAge !== undefined && candidateAge > maxAge) return false;
  return true;
}

/**
 * Calculate age from date of birth
 */
function calculateAge(dob, dod) {
  try {
    const birthDate = new Date(dob);
    const endDate = dod ? new Date(dod) : new Date();

    let age = endDate.getFullYear() - birthDate.getFullYear();
    const monthDiff = endDate.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && endDate.getDate() < birthDate.getDate())) {
      age--;
    }

    return age >= 0 ? age : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Extract age from text using regex patterns
 */
function extractAgeFromText(text) {
  // Common patterns: "age 71", "aged 71", ", 71,", "71 years old"
  const patterns = [
    /\bage[d]?\s+(\d{1,3})\b/i,
    /\b(\d{1,3})\s+years?\s+old\b/i,
    /,\s*(\d{2,3})\s*,/,
    /\b(\d{2,3})\s*,?\s*(?:of|from)\s+\w+/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const age = parseInt(match[1], 10);
      if (age > 0 && age < 150) {
        return age;
      }
    }
  }

  return undefined;
}

module.exports = {
  getAgeRange,
  isAgeInRange,
  isAgeInExplicitRange,
  calculateAge,
  extractAgeFromText
};
