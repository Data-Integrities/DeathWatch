/**
 * Fetch obituary pages and extract service dates from full HTML text.
 * Used when search engine snippets are too truncated to contain funeral/visitation dates.
 */

const { extractServiceDates } = require('./serviceDates');
const { extractDodFromText } = require('./dod');
const { logger } = require('../utils/logger');

/**
 * Strip HTML tags and decode entities to get plain text
 */
function htmlToText(html) {
  let text = html
    // Remove script and style blocks entirely
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    // Replace block-level elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Remove all remaining tags
    .replace(/<[^>]+>/g, ' ')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    // Collapse whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();

  return text;
}

/**
 * Fetch a URL and return the page text, or null on failure
 */
async function fetchPageText(url, timeoutMs = 8000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ObitEngine/1.0)',
        'Accept': 'text/html'
      }
    });

    clearTimeout(timer);

    if (!response.ok) {
      logger.debug(`Page fetch failed for ${url}: HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      logger.debug(`Skipping non-HTML content at ${url}: ${contentType}`);
      return null;
    }

    const html = await response.text();
    return htmlToText(html);
  } catch (err) {
    if (err.name === 'AbortError') {
      logger.debug(`Page fetch timed out for ${url}`);
    } else {
      logger.debug(`Page fetch error for ${url}: ${err.message}`);
    }
    return null;
  }
}

/**
 * Enrich a single result by fetching its page and extracting dates
 * Only fetches if the result is missing funeralDate and has a URL
 * Returns true if any fields were updated
 */
async function enrichResult(result) {
  if (!result.url) return false;
  if (result.funeralDate && result.visitationDate) return false;

  const text = await fetchPageText(result.url);
  if (!text) return false;

  let updated = false;

  // Try to extract DOD from full page if we don't have it
  if (!result.dod) {
    const dod = extractDodFromText(text);
    if (dod) {
      result.dod = dod;
      updated = true;
      logger.debug(`Enriched DOD for ${result.fullName}: ${dod}`);
    }
  }

  // Extract service dates from full page text
  const serviceDates = extractServiceDates(text, result.dod);

  if (!result.funeralDate && serviceDates.funeral) {
    result.funeralDate = serviceDates.funeral;
    updated = true;
    logger.debug(`Enriched funeral date for ${result.fullName}: ${serviceDates.funeral}`);
  }

  if (!result.visitationDate && serviceDates.visitation) {
    result.visitationDate = serviceDates.visitation;
    updated = true;
    logger.debug(`Enriched visitation date for ${result.fullName}: ${serviceDates.visitation}`);
  }

  return updated;
}

/**
 * Enrich multiple results by fetching their pages.
 * Processes up to maxEnrich results concurrently (limited concurrency).
 * @param {Array} results - Ranked results (will be mutated in place)
 * @param {number} maxEnrich - Max results to enrich (default: top 5)
 * @param {number} concurrency - Concurrent fetches (default: 3)
 */
async function enrichResults(results, maxEnrich = 5, concurrency = 3) {
  // Only enrich results that need it
  const toEnrich = results
    .filter(r => r.url && (!r.funeralDate || !r.visitationDate))
    .slice(0, maxEnrich);

  if (toEnrich.length === 0) return 0;

  logger.info(`Enriching ${toEnrich.length} results by fetching pages...`);

  let enriched = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < toEnrich.length; i += concurrency) {
    const batch = toEnrich.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(r => enrichResult(r)));
    enriched += results.filter(Boolean).length;
  }

  if (enriched > 0) {
    logger.info(`Enriched ${enriched} results with page data`);
  }

  return enriched;
}

module.exports = {
  enrichResults,
  enrichResult,
  fetchPageText,
  htmlToText
};
