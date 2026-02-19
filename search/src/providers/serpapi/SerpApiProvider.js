const { v4: uuidv4 } = require('uuid');
const { generateFingerprint } = require('../../dedupe/fingerprint');
const { extractAgeFromText } = require('../../normalize/age');
const { extractDodFromText } = require('../../normalize/dod');
const { extractServiceDates } = require('../../normalize/serviceDates');
const { extractNameFromTitle, extractNameFromSnippet, extractNameFromUrl, isValidParsedName, isGenericTitle } = require('../../normalize/nameExtract');
const { buildOrClause } = require('../../normalize/nameVariants');
const config = require('../../config');
const { logger } = require('../../utils/logger');

class SerpApiProvider {
  constructor() {
    this.name = 'SerpAPI';
    this.type = 'serpapi';
  }

  async search(query) {
    const searchQuery = this._buildQuery(query);
    logger.debug('SerpApiProvider searching:', searchQuery);

    if (!config.serpapi.apiKey) {
      logger.error('SerpAPI key not configured');
      return [];
    }

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        api_key: config.serpapi.apiKey,
        num: '10'
      });

      const url = `https://serpapi.com/search.json?${params.toString()}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`SerpAPI error: ${response.status}`);
      }

      const data = await response.json();
      return this._parseResults(data.organic_results || [], query);
    } catch (err) {
      logger.error('SerpAPI call failed:', err);
      return [];
    }
  }

  _buildQuery(query) {
    const parts = [];

    // If nickname is provided and different from nameFirst, use OR clause
    if (query.nameNickname && query.nameFirst &&
        query.nameNickname.toLowerCase() !== query.nameFirst.toLowerCase()) {
      parts.push(buildOrClause([query.nameFirst, query.nameNickname]));
    } else {
      parts.push(query.nameFirst);
    }

    parts.push(query.nameLast);
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

    // Extract name: title → snippet → URL fallback
    let nameInfo = extractNameFromTitle(title);
    if (isGenericTitle(nameInfo.nameFull) || !isValidParsedName(nameInfo.nameFirst, nameInfo.nameLast)) {
      const snippetNameInfo = extractNameFromSnippet(snippet, query);
      if (snippetNameInfo.nameFirst && snippetNameInfo.nameLast) {
        nameInfo = snippetNameInfo;
      }
    }
    if (!isValidParsedName(nameInfo.nameFirst, nameInfo.nameLast)) {
      const urlNameInfo = extractNameFromUrl(result.link);
      if (urlNameInfo.nameFirst && urlNameInfo.nameLast) {
        nameInfo = urlNameInfo;
      }
    }

    // Extract age from snippet
    const age = extractAgeFromText(snippet) || extractAgeFromText(title);

    // Extract date of death from snippet/title
    const dod = extractDodFromText(snippet) || extractDodFromText(title);

    // Extract service dates (visitation, funeral) - use DOD for year inference
    const serviceDates = extractServiceDates(snippet, dod);

    // Extract location from snippet
    const locationInfo = this._extractLocation(combined);

    // Generate fingerprint
    const fingerprint = generateFingerprint({
      nameLast: nameInfo.nameLast || query.nameLast,
      nameFirst: nameInfo.nameFirst || query.nameFirst,
      city: locationInfo.city,
      state: locationInfo.state,
      dod
    });

    return {
      id: uuidv4(),
      nameFull: nameInfo.nameFull || title.split(' - ')[0].split('|')[0].trim(),
      nameFirst: nameInfo.nameFirst,
      nameLast: nameInfo.nameLast,
      ageYears: age,
      dod,
      dateVisitation: serviceDates.visitation,
      dateFuneral: serviceDates.funeral,
      city: locationInfo.city,
      state: locationInfo.state,
      source: 'SerpAPI',
      url: result.link,
      snippet: snippet,
      score: 0,
      reasons: [],
      fingerprint,
      typeProvider: 'serpapi'
    };
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
    // Handles abbreviated prefixes like "St.", "Ft.", "Mt.", "Pt." and multi-word cities
    const statePattern = /(?:of\s+)?((?:(?:St|Ft|Mt|Pt)\.\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})\b/;
    const match = text.match(statePattern);

    if (match && validStateCodes.has(match[2])) {
      return {
        city: match[1],
        state: match[2]
      };
    }

    // Try "City, State" with full state name
    const fullStatePattern = /(?:of\s+)?((?:(?:St|Ft|Mt|Pt)\.\s+)?[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*(Ohio|California|Florida|Texas|New York)/i;
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

const serpApiProvider = new SerpApiProvider();

module.exports = { SerpApiProvider, serpApiProvider };
