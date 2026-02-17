/**
 * Extract visitation and funeral/service dates from text
 * When year is missing, infer from DOD:
 *   - Assume same year as DOD
 *   - If service month/day is before DOD month/day, it's the following year
 * Returns { visitation: 'YYYY-MM-DD', funeral: 'YYYY-MM-DD' } or nulls
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

  const d = day.replace(/(?:st|nd|rd|th)$/i, '').padStart(2, '0');
  const y = year.length === 2 ? (parseInt(year) > 50 ? '19' + year : '20' + year) : year;

  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return null;

  return `${y}-${m}-${d}`;
}

/**
 * Given a month and day with no year, infer the year from DOD.
 * The service date must be on or after the DOD.
 */
function inferYearFromDod(month, day, dod) {
  if (!dod) return null;

  const m = MONTHS[month.toLowerCase()];
  if (!m) return null;

  const d = day.replace(/(?:st|nd|rd|th)$/i, '').padStart(2, '0');
  const dodParts = dod.split('-');
  if (dodParts.length !== 3) return null;

  const dodYear = parseInt(dodParts[0]);
  const dodMonth = dodParts[1];
  const dodDay = dodParts[2];

  // Try same year as DOD
  const serviceInDodYear = `${m}${d}`;
  const dodMonthDay = `${dodMonth}${dodDay}`;

  // Service must be on or after DOD
  if (serviceInDodYear >= dodMonthDay) {
    return `${dodYear}-${m}-${d}`;
  }

  // Service month/day is before DOD month/day — must be next year
  // (e.g., DOD Dec 29, funeral Jan 3)
  return `${dodYear + 1}-${m}-${d}`;
}

/**
 * Extract a date following a keyword pattern
 * Tries full date (with year) first, then month/day only (inferred from DOD)
 */
function extractDateAfterKeyword(text, keywordPattern, dod) {
  // Try with full year first
  const fullPattern = new RegExp(
    `${keywordPattern}[^.]*?(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})`,
    'i'
  );
  let match = text.match(fullPattern);
  if (match) {
    const result = parseDate(match[1], match[2], match[3]);
    if (result) return result;
  }

  // Try without year — "Month DD" or "Month DDth"
  if (dod) {
    const noYearPattern = new RegExp(
      `${keywordPattern}[^.]*?(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\b|,|\\s)`,
      'i'
    );
    match = text.match(noYearPattern);
    if (match) {
      const result = inferYearFromDod(match[1], match[2], dod);
      if (result) return result;
    }
  }

  return null;
}

/**
 * Extract visitation date from text
 */
function extractVisitationDate(text, dod) {
  if (!text) return null;

  const t = text.replace(/\s+/g, ' ').trim();

  let date = extractDateAfterKeyword(t, 'visitation(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'viewing(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'calling\\s+hours', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'friends\\s+(?:may|will)\\s+(?:be\\s+received|call)', dod);
  if (date) return date;

  return null;
}

/**
 * Extract funeral/memorial service date from text
 */
function extractFuneralDate(text, dod) {
  if (!text) return null;

  const t = text.replace(/\s+/g, ' ').trim();

  let date = extractDateAfterKeyword(t, 'funeral\\s+services?(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'memorial\\s+(?:services?|gathering)(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'celebration\\s+of\\s+life(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'services?\\s+will\\s+be\\s+(?:held|at)', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'the\\s+service\\s+will\\s+be\\s+at', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'graveside\\s+services?(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'burial(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  date = extractDateAfterKeyword(t, 'interment(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?', dod);
  if (date) return date;

  return null;
}

/**
 * Extract all service dates from text
 * @param {string} text - snippet/title text
 * @param {string|null} dod - ISO date of death (YYYY-MM-DD) for year inference
 */
function extractServiceDates(text, dod) {
  return {
    visitation: extractVisitationDate(text, dod),
    funeral: extractFuneralDate(text, dod)
  };
}

module.exports = {
  extractVisitationDate,
  extractFuneralDate,
  extractServiceDates,
  inferYearFromDod
};
