const crypto = require('crypto');
const { googleProvider } = require('./providers/google/GoogleProvider');
const { serpApiProvider } = require('./providers/serpapi/SerpApiProvider');
const { serperProvider } = require('./providers/serper/SerperProvider');
const { scoreAndRankCandidates } = require('./scoring/criteriaScore');
const { deduplicateCandidates } = require('./dedupe/dedupe');
const { exclusionStore } = require('./data/ExclusionStore');
const { normalizeName } = require('./normalize/name');
const { getNicknameVariants } = require('./normalize/nicknames');
const { normalizeCity, normalizeState } = require('./normalize/location');
const config = require('./config');
const { logger } = require('./utils/logger');

/**
 * Generate a search key for exclusion matching
 * Hash of normalized: lastName + firstName + city + state + ageRange
 */
function generateSearchKey(query) {
  const parts = [
    query.normalizedLastName,
    query.normalizedFirstName,
    query.normalizedCity || '',
    query.normalizedState || '',
    query.age?.toString() || ''
  ];

  const input = parts.join('|').toLowerCase();
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
}

/**
 * Normalize a search query
 */
function normalizeQuery(query) {
  const normalizedFirstName = normalizeName(query.firstName);
  const normalizedLastName = normalizeName(query.lastName);
  const normalizedCity = query.city ? normalizeCity(query.city) : undefined;
  const normalizedState = query.state ? normalizeState(query.state) : undefined;

  const firstNameVariants = getNicknameVariants(normalizedFirstName);

  // Use inputDate if provided, otherwise default to today
  const inputDate = query.inputDate || new Date().toISOString().split('T')[0];

  const normalized = {
    ...query,
    normalizedFirstName,
    normalizedLastName,
    normalizedCity,
    normalizedState,
    firstNameVariants,
    inputDate,
    searchKey: ''  // Will be set after full object is created
  };

  normalized.searchKey = generateSearchKey(normalized);

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

  // 4. Filter out excluded candidates (by fingerprint OR URL)
  const filtered = deduplicated.filter(c => {
    const { excluded } = exclusionStore.isExcluded(c, normalizedQuery.searchKey);
    return !excluded;
  });

  const excludedCount = deduplicated.length - filtered.length;
  if (excludedCount > 0) {
    logger.info(`Filtered out ${excludedCount} excluded results`);
  }

  // 5. Score and rank all candidates (sorts by finalScore, assigns rank)
  const rankedCandidates = scoreAndRankCandidates(filtered, normalizedQuery);

  // 6. Limit results
  const limited = rankedCandidates.slice(0, config.maxResults);

  logger.info(`Returning ${limited.length} results`);

  return {
    results: limited,
    searchKey: normalizedQuery.searchKey
  };
}

module.exports = {
  searchObits,
  normalizeQuery,
  generateSearchKey
};
