const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { buildGoogleQuery, buildGoogleApiUrl } = require('./googleQuery');
const { generateFingerprint } = require('../../dedupe/fingerprint');
const { extractAgeFromText } = require('../../normalize/age');
const { normalizeState } = require('../../normalize/location');
const config = require('../../config');
const { logger } = require('../../utils/logger');

class GoogleProvider {
  constructor() {
    this.name = 'Google CSE';
    this.type = 'google';
  }

  async search(query) {
    const searchQuery = buildGoogleQuery(query);
    logger.debug('GoogleProvider searching:', searchQuery);

    let results;

    if (config.google.isStubMode) {
      logger.info('Google CSE in stub mode - using sample data');
      results = this._loadStubData();
    } else {
      results = await this._callGoogleApi(searchQuery);
    }

    return this._parseResults(results, query);
  }

  _loadStubData() {
    try {
      const stubPath = path.join(config.cacheDir, 'google-sample.json');
      if (fs.existsSync(stubPath)) {
        const data = fs.readFileSync(stubPath, 'utf-8');
        const stub = JSON.parse(data);
        return stub.results || [];
      }
    } catch (err) {
      logger.error('Error loading stub data:', err);
    }
    return [];
  }

  async _callGoogleApi(query) {
    const url = buildGoogleApiUrl(query, config.google.apiKey, config.google.cseId);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Google API error: ${response.status}`);
      }
      const data = await response.json();
      return data.items || [];
    } catch (err) {
      logger.error('Google API call failed:', err);
      return [];
    }
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
    // Extract name from title
    const nameInfo = this._extractNameFromTitle(result.title);

    // Extract age from snippet
    const age = extractAgeFromText(result.snippet) ||
                extractAgeFromText(result.title);

    // Extract location from snippet
    const locationInfo = this._extractLocation(result.snippet, result.title);

    // Generate fingerprint with available data
    const fingerprint = generateFingerprint({
      lastName: nameInfo.lastName || query.lastName,
      firstName: nameInfo.firstName || query.firstName,
      city: locationInfo.city,
      state: locationInfo.state,
      dod: undefined  // Usually not extractable from snippets
    });

    return {
      id: uuidv4(),
      fullName: nameInfo.fullName || result.title.split(' - ')[0].split('|')[0].trim(),
      firstName: nameInfo.firstName,
      lastName: nameInfo.lastName,
      ageYears: age,
      city: locationInfo.city,
      state: locationInfo.state,
      source: 'Google Search',
      url: result.link,
      snippet: result.snippet,
      score: 0,
      reasons: [],
      fingerprint,
      providerType: 'google'
    };
  }

  _extractNameFromTitle(title) {
    // Common patterns:
    // "John Smith Obituary - City, ST"
    // "Smith, John - Newspaper Name"
    // "John Smith, 71 - Legacy.com"

    const cleanTitle = title.split(' - ')[0].split('|')[0].trim();

    // Try "LastName, FirstName" pattern
    const commaMatch = cleanTitle.match(/^([A-Z][a-z]+),\s+([A-Z][a-z]+)/);
    if (commaMatch) {
      return {
        fullName: `${commaMatch[2]} ${commaMatch[1]}`,
        firstName: commaMatch[2],
        lastName: commaMatch[1]
      };
    }

    // Try "FirstName LastName" pattern
    const spaceMatch = cleanTitle.match(/^([A-Z][a-z]+)\s+(?:[A-Z]\.?\s+)?([A-Z][a-z]+)/);
    if (spaceMatch) {
      return {
        fullName: cleanTitle.replace(/,.*$/, '').trim(),
        firstName: spaceMatch[1],
        lastName: spaceMatch[2]
      };
    }

    // Try extracting from "Name Obituary" pattern
    const obitMatch = cleanTitle.match(/^(.+?)\s+Obituary/i);
    if (obitMatch) {
      const namePart = obitMatch[1].trim();
      const parts = namePart.split(/\s+/);
      if (parts.length >= 2) {
        return {
          fullName: namePart,
          firstName: parts[0],
          lastName: parts[parts.length - 1]
        };
      }
    }

    return { fullName: cleanTitle };
  }

  _extractLocation(snippet, title) {
    const combined = `${title} ${snippet}`;

    // Pattern: "City, ST" or "City, State"
    const statePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*([A-Z]{2})\b/;
    const match = combined.match(statePattern);

    if (match) {
      return {
        city: match[1],
        state: match[2]
      };
    }

    // Try to find just state code - but validate it's a real state
    const validStateCodes = new Set([
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ]);

    // Look for state codes that appear in location context (after comma, "of", "in")
    const stateContextMatch = combined.match(/(?:,\s*|of\s+|in\s+)([A-Z]{2})(?:\s|,|\.|$)/);
    if (stateContextMatch && validStateCodes.has(stateContextMatch[1])) {
      return { state: stateContextMatch[1] };
    }

    return {};
  }
}

const googleProvider = new GoogleProvider();

module.exports = { GoogleProvider, googleProvider };
