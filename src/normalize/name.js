/**
 * Name normalization utilities
 */

function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')  // Remove punctuation except hyphens
    .replace(/\s+/g, ' ');     // Collapse multiple spaces
}

function getFirstInitial(name) {
  const normalized = normalizeName(name);
  return normalized.charAt(0);
}

function getMiddleInitial(middleName) {
  if (!middleName) return undefined;
  const normalized = normalizeName(middleName);
  return normalized.charAt(0) || undefined;
}

function namesMatch(name1, name2) {
  return normalizeName(name1) === normalizeName(name2);
}

function firstInitialsMatch(name1, name2) {
  return getFirstInitial(name1) === getFirstInitial(name2);
}

module.exports = {
  normalizeName,
  getFirstInitial,
  getMiddleInitial,
  namesMatch,
  firstInitialsMatch
};
