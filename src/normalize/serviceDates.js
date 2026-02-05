/**
 * Extract visitation and funeral/service dates from text
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

  const d = day.padStart(2, '0');
  const y = year.length === 2 ? (parseInt(year) > 50 ? '19' + year : '20' + year) : year;

  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return null;

  return `${y}-${m}-${d}`;
}

/**
 * Extract a date following a keyword pattern
 */
function extractDateAfterKeyword(text, keywordPattern) {
  const pattern = new RegExp(
    `${keywordPattern}[^.]*?(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  const match = text.match(pattern);
  if (match) {
    return parseDate(match[1], match[2], match[3]);
  }
  return null;
}

/**
 * Extract visitation date from text
 */
function extractVisitationDate(text) {
  if (!text) return null;

  const t = text.replace(/\s+/g, ' ').trim();

  // Pattern 1: "visitation will be held on..." or "visitation on..."
  let date = extractDateAfterKeyword(t, 'visitation(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  // Pattern 2: "viewing will be..." or "viewing on..."
  date = extractDateAfterKeyword(t, 'viewing(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  // Pattern 3: "calling hours..."
  date = extractDateAfterKeyword(t, 'calling\\s+hours');
  if (date) return date;

  // Pattern 4: "friends may call..."
  date = extractDateAfterKeyword(t, 'friends\\s+(?:may|will)\\s+(?:be\\s+received|call)');
  if (date) return date;

  return null;
}

/**
 * Extract funeral/memorial service date from text
 */
function extractFuneralDate(text) {
  if (!text) return null;

  const t = text.replace(/\s+/g, ' ').trim();

  // Pattern 1: "funeral service..." or "funeral services..."
  let date = extractDateAfterKeyword(t, 'funeral\\s+services?(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  // Pattern 2: "memorial service..."
  date = extractDateAfterKeyword(t, 'memorial\\s+services?(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  // Pattern 3: "celebration of life..."
  date = extractDateAfterKeyword(t, 'celebration\\s+of\\s+life(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  // Pattern 4: "service will be held..."
  date = extractDateAfterKeyword(t, 'services?\\s+will\\s+be\\s+held');
  if (date) return date;

  // Pattern 5: "graveside service..."
  date = extractDateAfterKeyword(t, 'graveside\\s+services?(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  // Pattern 6: "burial will be..."
  date = extractDateAfterKeyword(t, 'burial(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  // Pattern 7: "interment..."
  date = extractDateAfterKeyword(t, 'interment(?:\\s+will)?(?:\\s+be)?(?:\\s+held)?');
  if (date) return date;

  return null;
}

/**
 * Extract all service dates from text
 */
function extractServiceDates(text) {
  return {
    visitation: extractVisitationDate(text),
    funeral: extractFuneralDate(text)
  };
}

module.exports = {
  extractVisitationDate,
  extractFuneralDate,
  extractServiceDates
};
