/**
 * Name extraction from search result titles, snippets, and URLs.
 * Shared by SerperProvider and SerpApiProvider.
 */

const MONTH_PATTERN = '(?:January|February|March|April|May|June|July|August|September|October|November|December)';

const INVALID_LAST_NAMES = new Set([
  'videos', 'website', 'memorial', 'obituary', 'obituaries',
  'will', 'service', 'services', 'information', 'photos',
  'instagram', 'facebook', 'twitter', 'wall', 'tribute',
  'page', 'home', 'funeral', 'published', 'soon', 'images'
]);

const NAME_SUFFIXES = new Set([
  'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v',
  'esq', 'esq.', 'md', 'm.d.', 'phd', 'ph.d.'
]);

/**
 * Extract a person's name from a search result title.
 * Handles funeral home formats, social media titles, memorial sites, etc.
 */
function extractNameFromTitle(title) {
  if (!title) return { nameFull: null };

  let cleanTitle = title;

  // === Phase 1: Pre-cleaning (before any other processing) ===

  // Strip social media patterns
  cleanTitle = cleanTitle
    .replace(/\s*\(@[^)]*\).*$/g, '')                    // (@username) and everything after
    .replace(/\s*[•·]\s*Instagram.*$/gi, '')              // • Instagram photos and videos
    .replace(/\s*[•·]\s*.*$/g, '')                        // • anything (social bullet separator)
    .replace(/\s+on\s+Instagram$/gi, '')                  // "on Instagram"
    .replace(/\s+photos\s+and\s+videos$/gi, '')           // "photos and videos"
    .replace(/\s*[|]\s*Facebook$/gi, '')                   // "| Facebook"
    .trim();

  // Strip memorial/tribute suffixes
  cleanTitle = cleanTitle
    .replace(/'s\s+Memorial\s+Website$/gi, '')            // "'s Memorial Website"
    .replace(/\s+Memorial\s+Website$/gi, '')              // "Memorial Website"
    .replace(/'s\s+Tribute\s+Wall$/gi, '')                // "'s Tribute Wall"
    .replace(/\s+Tribute\s+Wall$/gi, '')                  // "Tribute Wall"
    .trim();

  // Strip smashed dates (name directly abutting a date with no separator)
  // e.g. "Antonio AvilaFebruary 4, 2026" or "Stephen KellyFebruary 7, 2026"
  const smashedDateRe = new RegExp(`${MONTH_PATTERN}\\s*\\d{1,2},?\\s*\\d{4}.*$`, 'i');
  cleanTitle = cleanTitle.replace(smashedDateRe, '').trim();

  // Also strip dates with a space before them (not caught by delimiter stripping)
  // e.g. leftover "February 7" after partial strip
  const trailingDateRe = new RegExp(`\\s+${MONTH_PATTERN}\\s+\\d{1,2}(?:,?\\s*\\d{4})?.*$`, 'i');
  cleanTitle = cleanTitle.replace(trailingDateRe, '').trim();

  // Strip sentence continuations (Facebook-style long titles)
  cleanTitle = cleanTitle
    .replace(/\s+[Pp]assed\s+away.*$/i, '')              // "Passed away on..."
    .replace(/\s+[Aa]n?\s+obituary.*$/i, '')             // "An obituary..."
    .replace(/\s+[Ss]ervice\s+information.*$/i, '')      // "Service information will be..."
    .replace(/\s+[Aa]nd\s+service\s+information.*$/i, '') // "and service information..."
    .trim();

  // Strip trailing location patterns: "City, State Name" or "City, ST"
  // e.g. "Patricia M. Pierce Rochester, New York" → "Patricia M. Pierce"
  // Only match a single word as the city name to avoid eating person names
  const US_STATES_FULL = 'Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming';
  const trailingLocationRe = new RegExp(`\\s+[A-Z][a-z]+,\\s*(?:${US_STATES_FULL}|[A-Z]{2})\\s*$`);
  cleanTitle = cleanTitle.replace(trailingLocationRe, '').trim();

  // === Phase 2: Standard prefix/suffix removal ===

  // Remove common prefixes
  cleanTitle = cleanTitle
    .replace(/^(information\s+for|obituary\s+for|obituary\s+of|in\s+memory\s+of|in\s+loving\s+memory\s+of|remembering)\s+/gi, '')
    .replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|miss)\s+/gi, '')
    .trim();

  // Remove pipe delimiter (always a section separator)
  cleanTitle = cleanTitle.replace(/\s*[|]\s*.*$/g, '').trim();

  // Remove dash/en-dash/em-dash delimiters — but ONLY when surrounded by spaces
  // This preserves hyphenated names like "Gonzalez-Irizarry"
  cleanTitle = cleanTitle.replace(/\s+[-–—]\s+.*$/g, '').trim();

  // Remove common suffix words
  cleanTitle = cleanTitle
    .replace(/\s*Obituary\s*/gi, '')
    .replace(/\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}.*$/g, '')     // "(02/16/1943..." or "(2/16/43..."
    .replace(/\s*\(\d{4}.*$/g, '')                         // "(1939..." or "(2026)"
    .replace(/\s*\d{4}\s*-\s*\d{4}.*$/g, '')              // "1939-2026" ranges
    .replace(/,\s*\d{1,3}\s*,.*$/g, '')                   // ", 58, Who Gave..."
    .replace(/,\s*\d{1,3}$/g, '')                          // trailing ", 58"
    .replace(/,\s*(Who|What|Where|When|How|That|A\s|The\s).*$/gi, '')
    .replace(/\.{2,}$/g, '')                               // trailing "..." or ".."
    .trim();

  // Strip quoted nicknames for cleaner part splitting, but keep them in nameFull
  const nameFullWithNicknames = cleanTitle;
  const forParsing = cleanTitle.replace(/\s*"[^"]*"\s*/g, ' ').replace(/\s+/g, ' ').trim();

  // === Phase 3: Split and extract first/last ===

  let parts = forParsing.split(/\s+/);

  // Remove name suffixes from the end
  while (parts.length > 2 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
    parts.pop();
  }

  if (parts.length >= 2) {
    const nameFirst = parts[0];
    let nameLast = parts[parts.length - 1];

    // If last part is a single letter (middle initial), use second-to-last
    if (nameLast.length === 1 && parts.length > 2) {
      nameLast = parts[parts.length - 2];
    }

    // Clean up trailing punctuation
    nameLast = nameLast.replace(/[.,;:!?]+$/, '');

    // Validate the parsed name
    if (!isValidParsedName(nameFirst, nameLast)) {
      return { nameFull: nameFullWithNicknames };
    }

    return {
      nameFull: nameFullWithNicknames,
      nameFirst,
      nameLast
    };
  }

  return { nameFull: cleanTitle };
}

/**
 * Extract name from snippet text, using query name as a hint.
 */
function extractNameFromSnippet(snippet, query) {
  if (!snippet) return { nameFull: null };

  // Pattern 1: "LASTNAME, Firstname" (newspaper/funeral home style)
  // e.g. "KELLY, Stephen "Steve"" or "SMITH, John Michael"
  if (query && query.nameLast) {
    const uppercaseLastPattern = new RegExp(
      `${query.nameLast.toUpperCase()}\\s*,\\s*([A-Z][a-z]+(?:\\s+(?:"[^"]*"\\s+)?[A-Z]?\\.?\\s*[A-Z]?[a-z]*)*)`,
      'i'
    );
    const matchUpper = snippet.match(uppercaseLastPattern);
    if (matchUpper) {
      const firstName = matchUpper[1].replace(/"[^"]*"/g, '').trim().split(/\s+/)[0];
      return {
        nameFull: `${firstName} ${query.nameLast.charAt(0).toUpperCase() + query.nameLast.slice(1).toLowerCase()}`,
        nameFirst: firstName,
        nameLast: query.nameLast.charAt(0).toUpperCase() + query.nameLast.slice(1).toLowerCase()
      };
    }
  }

  // Pattern 2: "FirstName [MiddleName] LastName passed away" or "died"
  const passedAwayPattern = /([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)+)\s+(?:passed\s+away|died|departed)/i;
  const match1 = snippet.match(passedAwayPattern);
  if (match1) {
    return extractNameFromTitle(match1[1]);
  }

  // Pattern 3: "FirstName LastName, 83," or "FirstName LastName, age 83"
  const nameAgePattern = /([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)+),\s*(?:age\s*)?\d{1,3},/i;
  const match2 = snippet.match(nameAgePattern);
  if (match2) {
    return extractNameFromTitle(match2[1]);
  }

  // Pattern 4: Look for query nameLast near the start of snippet
  // No 'i' flag — requires capitalized words to avoid matching "Services for" etc.
  if (query && query.nameLast) {
    const escapedLast = query.nameLast.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const lastNamePattern = new RegExp(
      `([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?(?:\\s+[A-Z][a-z]+)*)\\s+${escapedLast}\\b`
    );
    const match3 = snippet.match(lastNamePattern);
    if (match3) {
      const fullMatch = match3[0];
      return extractNameFromTitle(fullMatch);
    }
  }

  return { nameFull: null };
}

/**
 * Extract name from URL path as a last-resort fallback.
 * Many funeral home URLs contain: /obituaries/firstname-lastname
 */
function extractNameFromUrl(url) {
  if (!url) return { nameFull: null };

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;

    // Match common funeral home URL patterns
    // /obituaries/antonio-avila, /obituary/john-smith, /obits/jane-doe
    const obituaryPathRe = /\/(?:obituaries|obituary|obits|tribute)\/([a-z]+-[a-z]+(?:-[a-z]+)*)/i;
    const match = path.match(obituaryPathRe);

    if (match) {
      const slugParts = match[1].split('-');

      // Filter out common non-name slug parts
      const nonNameSlugs = new Set(['obituary', 'memorial', 'tribute', 'funeral', 'service']);
      const nameParts = slugParts.filter(p => !nonNameSlugs.has(p.toLowerCase()));

      if (nameParts.length >= 2) {
        const nameFirst = nameParts[0].charAt(0).toUpperCase() + nameParts[0].slice(1);
        const nameLast = nameParts[nameParts.length - 1].charAt(0).toUpperCase() + nameParts[nameParts.length - 1].slice(1);

        if (isValidParsedName(nameFirst, nameLast)) {
          return {
            nameFull: nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' '),
            nameFirst,
            nameLast
          };
        }
      }
    }
  } catch {
    // Invalid URL, ignore
  }

  return { nameFull: null };
}

/**
 * Validate that extracted first/last names look like real names.
 * Returns false for month names, years, and common non-name words.
 */
function isValidParsedName(nameFirst, nameLast) {
  if (!nameFirst || !nameLast) return false;

  const lastLower = nameLast.toLowerCase();

  // Reject if last name is a 4-digit year
  if (/^\d{4}$/.test(nameLast)) return false;

  // Reject if last name is a known non-name word
  if (INVALID_LAST_NAMES.has(lastLower)) return false;

  // Reject if last name is all digits
  if (/^\d+$/.test(nameLast)) return false;

  return true;
}

/**
 * Check if a title is generic (not a person's name)
 */
function isGenericTitle(title) {
  if (!title) return true;

  const genericPatterns = [
    /^search\s+for\s+/i,
    /^find\s+/i,
    /^obituaries?\s*(for|in|from|search)?/i,
    /^recent\s+obituaries?/i,
    /^most\s+recent/i,
    /^local\s+obituaries?/i,
    /^current\s+services?/i,
    /^funeral\s+services?/i,
    /^death\s+notices?/i,
    /^browse\s+/i,
    /^view\s+all/i,
    /^all\s+obituaries?/i,
    /^\d+\s+obituaries?/i,
    /^contributions?\s+to/i,
    /^condolences?\s+for/i,
    /^full\s+text\s+of/i,
    /^\[?pdf\]?/i,
    /^researching/i,
  ];

  const lowerTitle = title.toLowerCase().trim();

  for (const pattern of genericPatterns) {
    if (pattern.test(lowerTitle)) {
      return true;
    }
  }

  if (title.length < 3) return true;
  if (!/[a-z]/.test(title)) return true;
  if (!/\s/.test(title.trim())) return true;

  return false;
}

module.exports = {
  extractNameFromTitle,
  extractNameFromSnippet,
  extractNameFromUrl,
  isValidParsedName,
  isGenericTitle
};
