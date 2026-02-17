/**
 * Location normalization utilities
 */

const stateAbbreviations = {
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
  'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
  'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
  'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
  'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
  'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
  'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
  'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
  'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC'
};

const validStateCodes = new Set(Object.values(stateAbbreviations));

/**
 * Normalize state to USPS code
 */
function normalizeState(state) {
  const trimmed = state.trim();
  const upper = trimmed.toUpperCase();

  // Already a valid code
  if (validStateCodes.has(upper)) {
    return upper;
  }

  // Look up full name
  const abbr = stateAbbreviations[trimmed.toLowerCase()];
  return abbr || upper;
}

/**
 * Normalize city name - handles St/Saint variations
 */
function normalizeCity(city) {
  let normalized = city
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, ' ');

  // Normalize St/Saint variations
  normalized = normalized
    .replace(/^st\.?\s+/i, 'saint ')
    .replace(/^saint\s+/i, 'saint ');

  return normalized;
}

/**
 * Check if two cities match (accounting for St/Saint)
 */
function citiesMatch(city1, city2) {
  return normalizeCity(city1) === normalizeCity(city2);
}

/**
 * Check if two states match
 */
function statesMatch(state1, state2) {
  return normalizeState(state1) === normalizeState(state2);
}

/**
 * Get all city variants for matching
 */
function getCityVariants(city) {
  const normalized = normalizeCity(city);
  const variants = [normalized];

  if (normalized.startsWith('saint ')) {
    variants.push(normalized.replace('saint ', 'st '));
  } else if (normalized.startsWith('st ')) {
    variants.push(normalized.replace('st ', 'saint '));
  }

  return variants;
}

module.exports = {
  normalizeState,
  normalizeCity,
  citiesMatch,
  statesMatch,
  getCityVariants
};
