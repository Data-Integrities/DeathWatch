/**
 * Extract place of birth from text (snippets, titles)
 * Returns { city, state } or null
 */

const VALID_STATE_CODES = new Set([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
]);

const STATE_NAMES = {
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
  'wisconsin': 'WI', 'wyoming': 'WY'
};

const STATE_NAMES_PATTERN = Object.keys(STATE_NAMES).join('|');

/**
 * Extract place of birth from text
 */
function extractPobFromText(text) {
  if (!text) return null;

  const t = text.replace(/\s+/g, ' ').trim();

  // Pattern 1: "born [date] in City, ST"
  const bornInCityStateCode = /born\s+(?:.*?\s+)?in\s+((?:(?:St|Ft|Mt|Pt)\.\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/;
  let match = t.match(bornInCityStateCode);
  if (match && VALID_STATE_CODES.has(match[2])) {
    return { city: match[1], state: match[2] };
  }

  // Pattern 2: "born in City, State Name"
  const bornInCityStateName = new RegExp(
    `born\\s+(?:.*?\\s+)?in\\s+((?:(?:St|Ft|Mt|Pt)\\.\\s+)?[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*),\\s*(${STATE_NAMES_PATTERN})`,
    'i'
  );
  match = t.match(bornInCityStateName);
  if (match) {
    const stateCode = STATE_NAMES[match[2].toLowerCase()];
    if (stateCode) {
      return { city: match[1], state: stateCode };
    }
  }

  // Pattern 3: "native of City, ST"
  const nativeOfCityState = /native\s+of\s+((?:(?:St|Ft|Mt|Pt)\.\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/;
  match = t.match(nativeOfCityState);
  if (match && VALID_STATE_CODES.has(match[2])) {
    return { city: match[1], state: match[2] };
  }

  // Pattern 4: "native of City, State Name"
  const nativeOfCityStateName = new RegExp(
    `native\\s+of\\s+((?:(?:St|Ft|Mt|Pt)\\.\\s+)?[A-Z][a-z]+(?:\\s+[A-Z][a-z]+)*),\\s*(${STATE_NAMES_PATTERN})`,
    'i'
  );
  match = t.match(nativeOfCityStateName);
  if (match) {
    const stateCode = STATE_NAMES[match[2].toLowerCase()];
    if (stateCode) {
      return { city: match[1], state: stateCode };
    }
  }

  return null;
}

module.exports = {
  extractPobFromText
};
