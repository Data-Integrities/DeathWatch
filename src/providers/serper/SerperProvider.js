const { v4: uuidv4 } = require('uuid');
const { generateFingerprint } = require('../../dedupe/fingerprint');
const { extractAgeFromText } = require('../../normalize/age');
const { extractDodFromText } = require('../../normalize/dod');
const { extractServiceDates } = require('../../normalize/serviceDates');
const { getFirstNameVariants, buildOrClause } = require('../../normalize/nameVariants');
const config = require('../../config');
const { logger } = require('../../utils/logger');

// Lazy load to avoid circular dependency
let searchMetrics = null;
function getSearchMetrics() {
  if (!searchMetrics) {
    searchMetrics = require('../../index').searchMetrics;
  }
  return searchMetrics;
}

class SerperProvider {
  constructor() {
    this.name = 'Serper';
    this.type = 'serper';
  }

  async search(query) {
    // Get first name variants for expanded search
    const firstNameVariants = await getFirstNameVariants(query.firstName);
    const searchQuery = this._buildQuery(query, firstNameVariants);
    logger.debug('SerperProvider searching:', searchQuery);

    if (!config.serper.apiKey) {
      logger.error('Serper API key not configured');
      return [];
    }

    try {
      // Track API call
      const metrics = getSearchMetrics();
      if (metrics) metrics.serperApiCalls++;

      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': config.serper.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          q: searchQuery,
          num: 10
        })
      });

      if (!response.ok) {
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data = await response.json();
      return this._parseResults(data.organic || [], query);
    } catch (err) {
      logger.error('Serper API call failed:', err);
      return [];
    }
  }

  _buildQuery(query, firstNameVariants = []) {
    const parts = [];

    // Use OR clause for first name variants if available
    if (firstNameVariants.length > 1) {
      parts.push(buildOrClause(firstNameVariants));
    } else {
      parts.push(query.firstName);
    }

    parts.push(query.lastName);
    parts.push('obituary');

    if (query.city) {
      parts.push(query.city);
    }
    if (query.state) {
      parts.push(query.state);
    }

    return parts.join(' ');
  }

  _parseResults(results, query) {
    const candidates = [];

    for (const result of results) {
      const parsed = this._parseResult(result, query);
      if (parsed) {
        candidates.push(parsed);
      }
    }

    return candidates;
  }

  _parseResult(result, query) {
    const title = result.title || '';
    const snippet = result.snippet || '';
    const combined = `${title} ${snippet}`;

    // Extract name from title, fall back to snippet if title is generic
    let nameInfo = this._extractNameFromTitle(title);
    if (this._isGenericTitle(nameInfo.fullName)) {
      const snippetNameInfo = this._extractNameFromSnippet(snippet, query);
      if (snippetNameInfo.firstName && snippetNameInfo.lastName) {
        nameInfo = snippetNameInfo;
      }
    }

    // Extract age from snippet
    const age = extractAgeFromText(snippet) || extractAgeFromText(title);

    // Extract date of death from snippet/title
    let dod = extractDodFromText(snippet) || extractDodFromText(title);

    // Extract service dates (visitation, funeral) - use DOD for year inference
    const serviceDates = extractServiceDates(snippet, dod);

    // Fallback: if DOD is missing, use funeral or visitation date
    // (person definitely died before their funeral/visitation)
    if (!dod) {
      dod = serviceDates.funeral || serviceDates.visitation || null;
    }

    // Extract location from snippet
    const locationInfo = this._extractLocation(combined);

    // Generate fingerprint
    const fingerprint = generateFingerprint({
      lastName: nameInfo.lastName || query.lastName,
      firstName: nameInfo.firstName || query.firstName,
      city: locationInfo.city,
      state: locationInfo.state,
      dod
    });

    return {
      id: uuidv4(),
      fullName: nameInfo.fullName || title.split(' - ')[0].split('|')[0].trim(),
      firstName: nameInfo.firstName,
      lastName: nameInfo.lastName,
      ageYears: age,
      dod,
      visitationDate: serviceDates.visitation,
      funeralDate: serviceDates.funeral,
      city: locationInfo.city,
      state: locationInfo.state,
      source: 'Serper',
      url: result.link,
      snippet: snippet,
      score: 0,
      reasons: [],
      fingerprint,
      providerType: 'serper'
    };
  }

  _extractNameFromTitle(title) {
    // Remove common prefixes
    let cleanTitle = title
      .replace(/^(information\s+for|obituary\s+for|obituary\s+of|in\s+memory\s+of|in\s+loving\s+memory\s+of|remembering)\s+/gi, '')
      .replace(/^(mr\.?|mrs\.?|ms\.?|dr\.?|miss)\s+/gi, '')  // Remove honorifics
      .trim();

    // Remove common suffixes and patterns
    cleanTitle = cleanTitle
      .replace(/\s*[|\-–—]\s*.*/g, '')      // Remove everything after | or -
      .replace(/\s*Obituary\s*/gi, '')       // Remove "Obituary"
      .replace(/\s*\(\d{4}.*$/g, '')         // Remove year patterns like "(1939" or "(2026)"
      .replace(/\s*\d{4}\s*-\s*\d{4}.*$/g, '') // Remove "1939-2026" date ranges
      .replace(/,\s*\d{1,3}\s*,.*$/g, '')   // Remove ", 58, Who Gave..." (age followed by description)
      .replace(/,\s*\d{1,3}$/g, '')          // Remove trailing ", 58" (just age)
      .replace(/,\s*(Who|What|Where|When|How|That|A\s|The\s).*$/gi, '') // Remove descriptive clauses
      .replace(/\.{2,}$/g, '')               // Remove trailing "..." or ".."
      .trim();

    // Split into parts
    let parts = cleanTitle.split(/\s+/);

    // Remove name suffixes from the end
    const suffixes = ['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v', 'esq', 'esq.', 'md', 'm.d.', 'phd', 'ph.d.'];
    while (parts.length > 2 && suffixes.includes(parts[parts.length - 1].toLowerCase())) {
      parts.pop();
    }

    // Find the last name (skip middle names/initials)
    if (parts.length >= 2) {
      const firstName = parts[0];
      // Last name is the last part that's not a single letter (middle initial)
      let lastName = parts[parts.length - 1];

      // If last part is a single letter, use second-to-last
      if (lastName.length === 1 && parts.length > 2) {
        lastName = parts[parts.length - 2];
      }

      // Clean up lastName - remove any remaining punctuation
      lastName = lastName.replace(/[.,;:!?]+$/, '');

      return {
        fullName: cleanTitle,
        firstName: firstName,
        lastName: lastName
      };
    }

    return { fullName: cleanTitle };
  }

  /**
   * Check if a title is generic (not a person's name)
   */
  _isGenericTitle(title) {
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

    // Also check if it's too short or doesn't look like a name (no spaces, all caps, etc.)
    if (title.length < 3) return true;
    if (!/[a-z]/.test(title)) return true;  // No lowercase letters
    if (!/\s/.test(title.trim())) return true;  // No spaces (single word)

    return false;
  }

  /**
   * Extract name from snippet text, using query name as a hint
   */
  _extractNameFromSnippet(snippet, query) {
    if (!snippet) return { fullName: null };

    // Common patterns for names in obituary snippets:
    // "John Smith passed away..."
    // "John Michael Smith, 83, of..."
    // "...services for John Smith will be..."

    // Pattern 1: "FirstName [MiddleName] LastName passed away" or "FirstName [MiddleName] LastName, age"
    const passedAwayPattern = /([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)+)\s+(?:passed\s+away|died|departed)/i;
    const match1 = snippet.match(passedAwayPattern);
    if (match1) {
      return this._extractNameFromTitle(match1[1]);
    }

    // Pattern 2: "FirstName LastName, 83," or "FirstName LastName, age 83"
    const nameAgePattern = /([A-Z][a-z]+(?:\s+[A-Z]\.?)?(?:\s+[A-Z][a-z]+)+),\s*(?:age\s*)?\d{1,3},/i;
    const match2 = snippet.match(nameAgePattern);
    if (match2) {
      return this._extractNameFromTitle(match2[1]);
    }

    // Pattern 3: Look for query lastName near the start of snippet with a first name before it
    if (query.lastName) {
      const lastNamePattern = new RegExp(
        `([A-Z][a-z]+(?:\\s+[A-Z]\\.?)?(?:\\s+[A-Z][a-z]+)*)\\s+${query.lastName}\\b`,
        'i'
      );
      const match3 = snippet.match(lastNamePattern);
      if (match3) {
        const fullMatch = match3[0];
        return this._extractNameFromTitle(fullMatch);
      }
    }

    return { fullName: null };
  }

  _extractLocation(text) {
    const validStateCodes = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ]);

    // Pattern: "City, ST" or "of City, State"
    const statePattern = /(?:of\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/;
    const match = text.match(statePattern);

    if (match && validStateCodes.has(match[2])) {
      return {
        city: match[1],
        state: match[2]
      };
    }

    // Try "City, State" with full state name
    const fullStatePattern = /(?:of\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(Ohio|California|Florida|Texas|New York)/i;
    const fullMatch = text.match(fullStatePattern);

    if (fullMatch) {
      const stateMap = {
        'ohio': 'OH', 'california': 'CA', 'florida': 'FL',
        'texas': 'TX', 'new york': 'NY'
      };
      return {
        city: fullMatch[1],
        state: stateMap[fullMatch[2].toLowerCase()] || fullMatch[2]
      };
    }

    return {};
  }
}

const serperProvider = new SerperProvider();

module.exports = { SerperProvider, serperProvider };
