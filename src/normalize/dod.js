/**
 * Extract date of death from text (snippets, titles)
 * Returns ISO date string (YYYY-MM-DD) or null
 */

const MONTHS = {
  'january': '01', 'jan': '01',
  'february': '02', 'feb': '02',
  'march': '03', 'mar': '03',
  'april': '04', 'apr': '04',
  'may': '05',
  'june': '06', 'jun': '06',
  'july': '07', 'jul': '07',
  'august': '08', 'aug': '08',
  'september': '09', 'sep': '09', 'sept': '09',
  'october': '10', 'oct': '10',
  'november': '11', 'nov': '11',
  'december': '12', 'dec': '12'
};

const MONTH_PATTERN = Object.keys(MONTHS).join('|');

/**
 * Parse a date string into ISO format
 */
function parseDate(month, day, year) {
  const m = MONTHS[month.toLowerCase()];
  if (!m) return null;

  const d = day.padStart(2, '0');
  const y = year.length === 2 ? (parseInt(year) > 50 ? '19' + year : '20' + year) : year;

  // Validate
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return null;

  return `${y}-${m}-${d}`;
}

/**
 * Extract DOD from text using multiple patterns
 * Prioritizes explicit death-related phrases
 */
function extractDodFromText(text) {
  if (!text) return null;

  // Normalize text
  const t = text.replace(/\s+/g, ' ').trim();

  // Pattern 1: "passed away on [day], Month DD, YYYY" or "passed away on Month DD, YYYY"
  // e.g., "passed away on Monday, December 29, 2025"
  const passedAwayPattern = new RegExp(
    `passed\\s+away\\s+(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  let match = t.match(passedAwayPattern);
  if (match) {
    const result = parseDate(match[1], match[2], match[3]);
    if (result) return result;
  }

  // Pattern 2: "died [on] Month DD, YYYY"
  const diedPattern = new RegExp(
    `died\\s+(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(diedPattern);
  if (match) {
    const result = parseDate(match[1], match[2], match[3]);
    if (result) return result;
  }

  // Pattern 3: "passed [on] Month DD, YYYY" (without "away")
  const passedPattern = new RegExp(
    `passed\\s+(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(passedPattern);
  if (match) {
    const result = parseDate(match[1], match[2], match[3]);
    if (result) return result;
  }

  // Pattern 4: "went to be with the Lord on Month DD, YYYY"
  const lordPattern = new RegExp(
    `(?:went\\s+to\\s+be\\s+with|called\\s+home|entered\\s+eternal).*?(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(lordPattern);
  if (match) {
    const result = parseDate(match[1], match[2], match[3]);
    if (result) return result;
  }

  // Pattern 5: "Month DD, YYYY - Month DD, YYYY" (birth - death range)
  // Take the second date as DOD
  const rangePattern = new RegExp(
    `(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*[-–—]\\s*(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(rangePattern);
  if (match) {
    const result = parseDate(match[4], match[5], match[6]);
    if (result) return result;
  }

  // Pattern 6: "YYYY - YYYY" year range in title (less precise, just year)
  // e.g., "(1939 - 2025)" or "1939-2025"
  const yearRangePattern = /\(?\s*(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2})\s*\)?/;
  match = t.match(yearRangePattern);
  if (match) {
    const deathYear = match[2];
    // Return just the year (January 1 as placeholder)
    return `${deathYear}-01-01`;
  }

  // Pattern 7: Date near death keywords (looser match)
  // "on December 29, 2025" when near obituary context
  if (/obituary|death|died|passed|memorial|funeral/i.test(t)) {
    const loosePattern = new RegExp(
      `(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(202[0-9])`,
      'i'
    );
    match = t.match(loosePattern);
    if (match) {
      const result = parseDate(match[1], match[2], match[3]);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Extract just the death year from text (faster, less precise)
 */
function extractDeathYear(text) {
  const dod = extractDodFromText(text);
  if (dod) {
    return parseInt(dod.substring(0, 4));
  }
  return null;
}

module.exports = {
  extractDodFromText,
  extractDeathYear
};
