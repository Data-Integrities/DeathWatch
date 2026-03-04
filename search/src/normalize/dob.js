/**
 * Extract date of birth from text (snippets, titles)
 * Returns ISO date string (YYYY-MM-DD), year-only string, or null
 *
 * Modeled after dod.js patterns.
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

function parseMonth(month) {
  if (!month) return null;
  const m = MONTHS[month.toLowerCase()];
  if (m) return m;
  const num = parseInt(month, 10);
  if (num >= 1 && num <= 12) {
    return num.toString().padStart(2, '0');
  }
  return null;
}

function expandYear(year) {
  if (year.length === 4) return year;
  if (year.length === 2) {
    const num = parseInt(year, 10);
    return num > 50 ? '19' + year : '20' + year;
  }
  return null;
}

function formatDate(year, month, day) {
  const y = expandYear(year);
  const m = parseMonth(month);
  const d = day.toString().padStart(2, '0');

  if (!y || !m) return null;

  const date = new Date(`${y}-${m}-${d}`);
  if (isNaN(date.getTime())) return null;

  // DOB should not be in the future
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date > tomorrow) return null;

  return `${y}-${m}-${d}`;
}

/**
 * Extract DOB from text using multiple patterns
 */
function extractDobFromText(text) {
  if (!text) return null;

  const t = text
    .replace(/\s+/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1')
    .trim();

  // Pattern 1: "born [on] Month DD, YYYY [in ...]"
  const bornMonthPattern = new RegExp(
    `born\\s+(?:on\\s+)?(?:\\w+,\\s+)?(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  let match = t.match(bornMonthPattern);
  if (match) {
    const result = formatDate(match[3], match[1], match[2]);
    if (result) return result;
  }

  // Pattern 2: "b. Month DD, YYYY"
  const bDotPattern = new RegExp(
    `\\bb\\.\\s*(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(bDotPattern);
  if (match) {
    const result = formatDate(match[3], match[1], match[2]);
    if (result) return result;
  }

  // Pattern 3: "born [on] DD Month YYYY" (day-first)
  const bornDayFirstPattern = new RegExp(
    `born\\s+(?:on\\s+)?(?:the\\s+)?(\\d{1,2})\\s+(?:of\\s+)?(${MONTH_PATTERN}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(bornDayFirstPattern);
  if (match) {
    const result = formatDate(match[3], match[2], match[1]);
    if (result) return result;
  }

  // Pattern 4: Date range "(Month DD, YYYY - Month DD, YYYY)" — first date is DOB
  const rangeMonthPattern = new RegExp(
    `(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})\\s*[-–—]\\s*(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s+(\\d{4})`,
    'i'
  );
  match = t.match(rangeMonthPattern);
  if (match) {
    const result = formatDate(match[3], match[1], match[2]);
    if (result) return result;
  }

  // Pattern 5: "YYYY - YYYY" year range — first year is DOB
  const yearRangePattern = /\(?\s*(19\d{2}|20\d{2})\s*[-–—]\s*(19\d{2}|20\d{2})\s*\)?/;
  match = t.match(yearRangePattern);
  if (match) {
    return match[1];
  }

  // Pattern 6: "born MM/DD/YYYY"
  const bornNumericPattern = /born\s+(?:on\s+)?(\d{1,2})[/\-](\d{1,2})[/\-](\d{2,4})/i;
  match = t.match(bornNumericPattern);
  if (match) {
    const result = formatDate(match[3], match[1], match[2]);
    if (result) return result;
  }

  return null;
}

module.exports = {
  extractDobFromText
};
