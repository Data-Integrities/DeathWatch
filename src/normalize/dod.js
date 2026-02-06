/**
 * Extract date of death from text (snippets, titles)
 * Returns ISO date string (YYYY-MM-DD) or null
 *
 * Aggressively matches many date formats and death-related phrases.
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

// Death-related phrases that indicate a DOD follows
const DEATH_PHRASES = [
  'passed\\s+away',
  'passed\\s+peacefully',
  'passed\\s+unexpectedly',
  'passed\\s+suddenly',
  'passed\\s+on',
  'passed',
  'died',
  'departed\\s+this\\s+life',
  'departed',
  'went\\s+to\\s+be\\s+with\\s+(?:the\\s+)?(?:lord|god|jesus|his\\s+maker|her\\s+maker)',
  'went\\s+home\\s+to\\s+(?:be\\s+with\\s+)?(?:the\\s+)?(?:lord|god|jesus)',
  'called\\s+home',
  'entered\\s+into\\s+(?:eternal\\s+)?rest',
  'entered\\s+eternal\\s+life',
  'entered\\s+heaven',
  'left\\s+this\\s+(?:world|earth|life)',
  'went\\s+to\\s+heaven',
  'went\\s+to\\s+(?:his|her)\\s+eternal\\s+(?:rest|reward|home)',
  'gained\\s+(?:his|her)\\s+wings',
  'received\\s+(?:his|her)\\s+wings',
  'transitioned',
  'was\\s+called\\s+(?:home|to\\s+heaven)',
  'taken\\s+from\\s+us',
  'lost\\s+(?:his|her)\\s+battle',
  'succumbed'
];

const DEATH_PHRASE_PATTERN = DEATH_PHRASES.join('|');

/**
 * Parse a text month into two-digit number
 */
function parseMonth(month) {
  if (!month) return null;
  const m = MONTHS[month.toLowerCase()];
  if (m) return m;
  // Try numeric
  const num = parseInt(month, 10);
  if (num >= 1 && num <= 12) {
    return num.toString().padStart(2, '0');
  }
  return null;
}

/**
 * Convert 2-digit year to 4-digit
 */
function expandYear(year) {
  if (year.length === 4) return year;
  if (year.length === 2) {
    const num = parseInt(year, 10);
    return num > 50 ? '19' + year : '20' + year;
  }
  return null;
}

/**
 * Validate and format a date to ISO
 */
function formatDate(year, month, day) {
  const y = expandYear(year);
  const m = parseMonth(month);
  const d = day.toString().padStart(2, '0');

  if (!y || !m) return null;

  // Validate the date
  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return null;

  // Don't accept future dates (more than 1 day ahead for timezone safety)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date > tomorrow) return null;

  return `${y}-${m}-${d}`;
}

/**
 * Extract DOD from text using multiple patterns
 * Prioritizes explicit death-related phrases, then falls back to date patterns
 */
function extractDodFromText(text) {
  if (!text) return null;

  // Normalize text: collapse whitespace, remove ordinal suffixes
  const t = text
    .replace(/\s+/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')  // "15th" -> "15"
    .trim();

  // ===== EXPLICIT DEATH PHRASES WITH DATES =====

  // Pattern 1: "[death phrase] [on] [day,] Month DD, YYYY"
  // e.g., "passed away on Monday, December 29, 2025"
  const deathPhraseMonthPattern = new RegExp(
    `(?:${DEATH_PHRASE_PATTERN})\\s+(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  let match = t.match(deathPhraseMonthPattern);
  if (match) {
    const result = formatDate(match[3], match[1], match[2]);
    if (result) return result;
  }

  // Pattern 2: "[death phrase] [on] MM/DD/YYYY or MM-DD-YYYY"
  const deathPhraseNumericPattern = new RegExp(
    `(?:${DEATH_PHRASE_PATTERN})\\s+(?:on\\s+)?(\\d{1,2})[/\\-](\\d{1,2})[/\\-](\\d{2,4})`,
    'i'
  );
  match = t.match(deathPhraseNumericPattern);
  if (match) {
    const result = formatDate(match[3], match[1], match[2]);
    if (result) return result;
  }

  // Pattern 3: "[death phrase] [on] DD Month YYYY" (day-first)
  const deathPhraseDayFirstPattern = new RegExp(
    `(?:${DEATH_PHRASE_PATTERN})\\s+(?:on\\s+)?(?:the\\s+)?(\\d{1,2})\\s+(?:of\\s+)?(${MONTH_PATTERN}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(deathPhraseDayFirstPattern);
  if (match) {
    const result = formatDate(match[3], match[2], match[1]);
    if (result) return result;
  }

  // ===== DATE RANGES (BIRTH - DEATH) =====

  // Pattern 4: "Month DD, YYYY - Month DD, YYYY" (take second date as DOD)
  const rangeMonthPattern = new RegExp(
    `(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*[-–—]\\s*(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(rangeMonthPattern);
  if (match) {
    const result = formatDate(match[6], match[4], match[5]);
    if (result) return result;
  }

  // Pattern 5: "MM/DD/YYYY - MM/DD/YYYY" numeric range
  const rangeNumericPattern = /(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})\s*[-–—]\s*(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/;
  match = t.match(rangeNumericPattern);
  if (match) {
    const result = formatDate(match[6], match[4], match[5]);
    if (result) return result;
  }

  // Pattern 6: "YYYY - YYYY" year range (less precise)
  const yearRangePattern = /\(?\s*(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2})\s*\)?/;
  match = t.match(yearRangePattern);
  if (match) {
    const deathYear = match[2];
    return `${deathYear}-01-01`;
  }

  // ===== STANDALONE DATES IN OBITUARY CONTEXT =====

  const isObituaryContext = /obituary|death|died|passed|memorial|funeral|visitation|viewing|service|survived\s+by|preceded\s+in\s+death|loving\s+memory/i.test(t);

  if (isObituaryContext) {
    // Pattern 7: "Month DD, YYYY" standalone
    const standaloneMonthPattern = new RegExp(
      `(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(20[0-2][0-9])`,
      'i'
    );
    match = t.match(standaloneMonthPattern);
    if (match) {
      const result = formatDate(match[3], match[1], match[2]);
      if (result) return result;
    }

    // Pattern 8: "DD Month YYYY" day-first standalone
    const standaloneDayFirstPattern = new RegExp(
      `(\\d{1,2})\\s+(?:of\\s+)?(${MONTH_PATTERN}),?\\s+(20[0-2][0-9])`,
      'i'
    );
    match = t.match(standaloneDayFirstPattern);
    if (match) {
      const result = formatDate(match[3], match[2], match[1]);
      if (result) return result;
    }

    // Pattern 9: "MM/DD/YYYY" or "M/D/YYYY" standalone numeric
    const standaloneNumericPattern = /\b(\d{1,2})[/\-](\d{1,2})[/\-](20[0-2][0-9])\b/;
    match = t.match(standaloneNumericPattern);
    if (match) {
      const result = formatDate(match[3], match[1], match[2]);
      if (result) return result;
    }

    // Pattern 10: "MM/DD/YY" two-digit year
    const standaloneShortYearPattern = /\b(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})\b/;
    match = t.match(standaloneShortYearPattern);
    if (match) {
      const result = formatDate(match[3], match[1], match[2]);
      if (result) return result;
    }
  }

  // ===== LAST RESORT: ANY RECENT DATE =====

  // Pattern 11: Any "Month DD, 202X" (very loose, recent years only)
  const anyRecentMonthPattern = new RegExp(
    `(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(202[0-9])`,
    'gi'
  );
  const allMatches = [...t.matchAll(anyRecentMonthPattern)];
  if (allMatches.length > 0) {
    // Prefer the last match (more likely to be DOD in "born X, died Y" patterns)
    const lastMatch = allMatches[allMatches.length - 1];
    const result = formatDate(lastMatch[3], lastMatch[1], lastMatch[2]);
    if (result) return result;
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
