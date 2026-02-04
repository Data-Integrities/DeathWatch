const { normalizeName, getFirstInitial } = require('../normalize/name');
const { normalizeCity, normalizeState } = require('../normalize/location');

/**
 * Generate a fingerprint for deduplication
 * Format: lastname-firstinitial-city-state-dod
 * Example: smith-j-hamilton-oh-2024-01-15
 */
function generateFingerprint(input) {
  const parts = [];

  // Normalized last name
  parts.push(normalizeName(input.lastName).replace(/\s+/g, '-'));

  // First initial
  parts.push(getFirstInitial(input.firstName));

  // City (normalized)
  if (input.city) {
    parts.push(normalizeCity(input.city).replace(/\s+/g, '-'));
  } else {
    parts.push('unknown');
  }

  // State (normalized)
  if (input.state) {
    parts.push(normalizeState(input.state).toLowerCase());
  } else {
    parts.push('unknown');
  }

  // Date of death
  if (input.dod) {
    // Extract just the date part if it's an ISO string
    const dateMatch = input.dod.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      parts.push(dateMatch[0]);
    } else {
      parts.push('unknown');
    }
  } else {
    parts.push('unknown');
  }

  return parts.join('-');
}

/**
 * Check if two fingerprints likely represent the same person
 */
function fingerprintsMatch(fp1, fp2) {
  return fp1 === fp2;
}

/**
 * Parse fingerprint back into components
 */
function parseFingerprint(fingerprint) {
  const parts = fingerprint.split('-');

  if (parts.length < 4) {
    return {
      lastName: parts[0] || 'unknown',
      firstInitial: parts[1] || '?',
      city: 'unknown',
      state: 'unknown',
      dod: 'unknown'
    };
  }

  const lastName = parts[0];
  const firstInitial = parts[1];

  // Last parts are: state, yyyy, mm, dd (or state and unknown)
  const lastPart = parts[parts.length - 1];
  const isDateFormat = /^\d{2}$/.test(lastPart);

  if (isDateFormat && parts.length >= 7) {
    // Has date: state is parts[-4], dod is parts[-3..-1]
    const state = parts[parts.length - 4];
    const dod = `${parts[parts.length - 3]}-${parts[parts.length - 2]}-${parts[parts.length - 1]}`;
    const city = parts.slice(2, parts.length - 4).join('-');
    return { lastName, firstInitial, city: city || 'unknown', state, dod };
  } else {
    // No date or unknown
    const state = parts[parts.length - 2];
    const dod = parts[parts.length - 1];
    const city = parts.slice(2, parts.length - 2).join('-');
    return { lastName, firstInitial, city: city || 'unknown', state, dod };
  }
}

module.exports = {
  generateFingerprint,
  fingerprintsMatch,
  parseFingerprint
};
