const { v4: uuidv4 } = require('uuid');
const { generateFingerprint } = require('../../dedupe/fingerprint');
const { extractAgeFromText } = require('../../normalize/age');
const config = require('../../config');
const { logger } = require('../../utils/logger');

class SerperProvider {
  constructor() {
    this.name = 'Serper';
    this.type = 'serper';
  }

  async search(query) {
    const searchQuery = this._buildQuery(query);
    logger.debug('SerperProvider searching:', searchQuery);

    if (!config.serper.apiKey) {
      logger.error('Serper API key not configured');
      return [];
    }

    try {
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

  _buildQuery(query) {
    const parts = [];
    parts.push(query.firstName);
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

    // Extract name from title
    const nameInfo = this._extractNameFromTitle(title);

    // Extract age from snippet
    const age = extractAgeFromText(snippet) || extractAgeFromText(title);

    // Extract location from snippet
    const locationInfo = this._extractLocation(combined);

    // Generate fingerprint
    const fingerprint = generateFingerprint({
      lastName: nameInfo.lastName || query.lastName,
      firstName: nameInfo.firstName || query.firstName,
      city: locationInfo.city,
      state: locationInfo.state,
      dod: undefined
    });

    return {
      id: uuidv4(),
      fullName: nameInfo.fullName || title.split(' - ')[0].split('|')[0].trim(),
      firstName: nameInfo.firstName,
      lastName: nameInfo.lastName,
      ageYears: age,
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
