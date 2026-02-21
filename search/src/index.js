const crypto = require('crypto');
const { googleProvider } = require('./providers/google/GoogleProvider');
const { serpApiProvider } = require('./providers/serpapi/SerpApiProvider');
const { serperProvider } = require('./providers/serper/SerperProvider');
const { scoreAndRankCandidates } = require('./scoring/criteriaScore');
const { deduplicateCandidates } = require('./dedupe/dedupe');
const { exclusionStore } = require('./data/ExclusionStore');
const { parseFingerprint } = require('./dedupe/fingerprint');
const { normalizeName } = require('./normalize/name');
const { getNicknameVariants } = require('./normalize/nicknames');
const { normalizeCity, normalizeState } = require('./normalize/location');
const config = require('./config');
const { enrichResults } = require('./normalize/enrichPage');
const { logger } = require('./utils/logger');

// Global metrics tracking (can be accessed by run scripts)
const searchMetrics = {
  serperApiCalls: 0,
  enrichmentPageFetches: 0,
  reset() {
    this.serperApiCalls = 0;
    this.enrichmentPageFetches = 0;
  }
};

/**
 * Generate a search key for exclusion matching
 * Hash of normalized: nameLast + nameFirst + city + state + ageRange
 */
function generateKeySearch(query) {
  const parts = [
    query.nameLastNorm,
    query.nameFirstNorm,
    query.cityNorm || '',
    query.stateNorm || '',
    query.age?.toString() || ''
  ];

  const input = parts.join('|').toLowerCase();
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Normalize a search query
 * Accepts user-facing input (firstName, lastName) and outputs internal format (nameFirst, nameLast)
 */
function normalizeQuery(query) {
  // Accept both user-facing (firstName) and internal (nameFirst) formats
  const nameNickname = query.nameNickname || query.nickname || null;
  let nameFirst = query.nameFirst || query.firstName;
  const nameLast = query.nameLast || query.lastName;
  const nameMiddle = query.nameMiddle || query.middleName;

  // If nameFirst is missing but nickname is provided, use nickname as nameFirst (for scoring)
  if (!nameFirst && nameNickname) {
    nameFirst = nameNickname;
  }

  const nameFirstNorm = normalizeName(nameFirst);
  const nameLastNorm = normalizeName(nameLast);
  const cityNorm = query.city ? normalizeCity(query.city) : undefined;
  const stateNorm = query.state ? normalizeState(query.state) : undefined;

  const nameFirstVariants = getNicknameVariants(nameFirstNorm);

  // Use inputDate if provided, otherwise default to today
  const inputDate = query.inputDate || new Date().toISOString().split('T')[0];

  // Parse keyWords: accept both keyWords and keywords, comma-separated string → lowercase array
  const rawKeyWords = query.keyWords || query.keywords || null;
  let keyWords = null;
  if (rawKeyWords) {
    const parsed = (typeof rawKeyWords === 'string' ? rawKeyWords : '').split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0);
    if (parsed.length > 0) keyWords = parsed;
  }

  const normalized = {
    ...query,
    nameFirst,
    nameLast,
    nameMiddle,
    nameNickname,
    nameFirstNorm,
    nameLastNorm,
    cityNorm,
    stateNorm,
    nameFirstVariants,
    keyWords,
    inputDate,
    keySearch: ''  // Will be set after full object is created
  };

  normalized.keySearch = generateKeySearch(normalized);

  return normalized;
}

/**
 * Get all providers based on config
 */
function getProviders() {
  const provider = config.searchProvider.toLowerCase();

  switch (provider) {
    case 'serper':
      if (!config.serper.isEnabled) {
        logger.error('Serper selected but SERPER_API_KEY not set');
        return [googleProvider]; // fallback
      }
      logger.debug('Using Serper provider');
      return [serperProvider];

    case 'serpapi':
      if (!config.serpapi.isEnabled) {
        logger.error('SerpAPI selected but SERPAPI_KEY not set');
        return [googleProvider]; // fallback
      }
      logger.debug('Using SerpAPI provider');
      return [serpApiProvider];

    case 'google':
      logger.debug('Using Google provider');
      return [googleProvider];

    default:
      logger.warn(`Unknown provider "${provider}", falling back to Google`);
      return [googleProvider];
  }
}

/**
 * Main search function
 */
async function searchObits(query) {
  logger.info('Starting obituary search:', query);

  // 1. Normalize query
  const normalizedQuery = normalizeQuery(query);
  logger.debug('Normalized query:', normalizedQuery);

  // 2. Run all providers in parallel
  const providers = getProviders();
  const providerPromises = providers.map(async (provider) => {
    try {
      logger.debug(`Running provider: ${provider.name}`);
      const results = await provider.search(normalizedQuery);
      logger.debug(`Provider ${provider.name} returned ${results.length} results`);
      return results;
    } catch (err) {
      logger.error(`Provider ${provider.name} failed:`, err);
      return [];
    }
  });

  const providerResults = await Promise.all(providerPromises);
  const allCandidates = providerResults.flat();
  logger.info(`Total candidates from all providers: ${allCandidates.length}`);

  // 3. Deduplicate first (before scoring)
  const deduplicated = deduplicateCandidates(allCandidates);
  logger.info(`After deduplication: ${deduplicated.length} candidates`);

  // 3b. Filter out blocked domains (e.g. .gov — never contain obituaries)
  const beforeDomainFilter = deduplicated.length;
  const domainFiltered = deduplicated.filter(c => {
    if (!c.url) return true;
    try {
      const hostname = new URL(c.url).hostname.toLowerCase();
      return !config.domainsBlocked.some(d => hostname.endsWith(d));
    } catch {
      return true;
    }
  });
  const domainBlockedCnt = beforeDomainFilter - domainFiltered.length;
  if (domainBlockedCnt > 0) {
    logger.info(`Filtered out ${domainBlockedCnt} results from blocked domains`);
  }

  // 4. Filter out excluded candidates
  // - Fingerprint with DOD: fingerprint match alone excludes (same person, high confidence)
  // - Fingerprint without DOD ("unknown"): too coarse, require URL match as well
  // - URL match: always excludes (exact same page)
  const fingerprintsExcluded = await exclusionStore.getFingerprintsExcluded(normalizedQuery.keySearch);
  const urlsExcluded = await exclusionStore.getUrlsExcluded(normalizedQuery.keySearch);
  const filtered = domainFiltered.filter(c => {
    const urlNorm = c.url ? exclusionStore._normalizeUrl(c.url) : null;
    const urlMatched = urlNorm && urlsExcluded.has(urlNorm);

    // URL match alone always excludes
    if (urlMatched) return false;

    // Fingerprint match: only exclude if DOD is present (not "unknown")
    if (c.fingerprint && fingerprintsExcluded.has(c.fingerprint)) {
      const parsed = parseFingerprint(c.fingerprint);
      if (parsed.dod !== 'unknown') return false;
    }

    return true;
  });

  const excludedCnt = domainFiltered.length - filtered.length;
  if (excludedCnt > 0) {
    logger.info(`Filtered out ${excludedCnt} excluded results`);
  }

  // 5. Score and rank all candidates (sorts by scoreFinal, assigns rank)
  const rankedCandidates = scoreAndRankCandidates(filtered, normalizedQuery);

  // 6. Enrich top results by fetching obituary pages (for funeral dates, etc.)
  if (config.enrichment.enabled) {
    await enrichResults(
      rankedCandidates,
      config.enrichment.maxPerQuery,
      config.enrichment.concurrency
    );
  }

  // 7. Limit results
  const limited = rankedCandidates.slice(0, config.maxResults);

  logger.info(`Returning ${limited.length} results`);

  return {
    results: limited,
    keySearch: normalizedQuery.keySearch
  };
}

module.exports = {
  searchObits,
  normalizeQuery,
  generateKeySearch,
  searchMetrics
};
