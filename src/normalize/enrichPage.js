/**
 * Fetch obituary pages and extract service dates from full HTML text.
 * Used when search engine snippets are too truncated to contain funeral/visitation dates.
 */

const { extractServiceDates } = require('./serviceDates');
const { extractDodFromText } = require('./dod');
const { logger } = require('../utils/logger');

// Lazy load to avoid circular dependency
let searchMetrics = null;
function getSearchMetrics() {
  if (!searchMetrics) {
    searchMetrics = require('../index').searchMetrics;
  }
  return searchMetrics;
}

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
 * Extract the primary obituary image URL from HTML
 * Looks for common patterns: og:image meta tag, obituary photo containers, etc.
 */
function extractImageUrl(html, pageUrl) {
  // Check for site-specific patterns first (these are more reliable than generic patterns)

  // Legacy.com uses data-component="obitImage"
  const legacyMatch = html.match(/data-component=["']obitImage["'][^>]*src=["']([^"']+)["']/i)
    || html.match(/src=["']([^"']+)["'][^>]*data-component=["']obitImage["']/i);
  if (legacyMatch && legacyMatch[1]) {
    return resolveUrl(legacyMatch[1], pageUrl);
  }

  // Also check for legacy.com/echovita cache.legacy.net images in any img tag
  const legacyCacheMatch = html.match(/<img[^>]+src=["'](https?:\/\/cache\.legacy\.net\/[^"']+)["']/i);
  if (legacyCacheMatch && legacyCacheMatch[1]) {
    const imgUrl = legacyCacheMatch[1];
    // Skip if it looks like a generic/placeholder
    if (!imgUrl.includes('placeholder') && !imgUrl.includes('default') && !imgUrl.includes('no-photo')) {
      return resolveUrl(imgUrl, pageUrl);
    }
  }

  // Try Open Graph image (but skip if it looks generic)
  const ogMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
  if (ogMatch && ogMatch[1]) {
    const imgUrl = ogMatch[1];
    // Skip generic site logos/placeholders - be more aggressive with filtering
    if (!imgUrl.includes('logo') &&
        !imgUrl.includes('placeholder') &&
        !imgUrl.includes('default') &&
        !imgUrl.includes('share') &&
        !imgUrl.includes('social') &&
        !imgUrl.includes('og-image') &&
        !imgUrl.includes('opengraph')) {
      return resolveUrl(imgUrl, pageUrl);
    }
  }

  // Try Twitter card image
  const twitterMatch = html.match(/<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/i)
    || html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']twitter:image["']/i);
  if (twitterMatch && twitterMatch[1]) {
    const imgUrl = twitterMatch[1];
    if (!imgUrl.includes('logo') && !imgUrl.includes('placeholder') && !imgUrl.includes('default')) {
      return resolveUrl(imgUrl, pageUrl);
    }
  }

  // Look for images in common obituary photo containers
  const containerPatterns = [
    /<(?:div|figure|span)[^>]*class=["'][^"']*(?:obit|photo|portrait|deceased|memorial)[^"']*["'][^>]*>[\s\S]*?<img[^>]+src=["']([^"']+)["']/i,
    /<img[^>]+class=["'][^"']*(?:obit|photo|portrait|deceased|memorial)[^"']*["'][^>]+src=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]+class=["'][^"']*(?:obit|photo|portrait|deceased|memorial)[^"']*["']/i,
  ];

  for (const pattern of containerPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const imgUrl = match[1];
      if (!imgUrl.includes('logo') && !imgUrl.includes('placeholder') && !imgUrl.includes('icon')) {
        return resolveUrl(imgUrl, pageUrl);
      }
    }
  }

  return null;
}

/**
 * Resolve a potentially relative URL against a base URL
 */
function resolveUrl(url, baseUrl) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Fetch a URL and return { text, html } or null on failure
 */
async function fetchPage(url, timeoutMs = 8000) {
  // Track page fetch
  const metrics = getSearchMetrics();
  if (metrics) metrics.enrichmentPageFetches++;

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
    return { html, text: htmlToText(html) };
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
 * Fetch a URL and return the page text, or null on failure
 * @deprecated Use fetchPage() instead for access to both HTML and text
 */
async function fetchPageText(url, timeoutMs = 8000) {
  const result = await fetchPage(url, timeoutMs);
  return result ? result.text : null;
}

/**
 * Enrich a single result by fetching its page and extracting dates + image
 * Only fetches if the result is missing funeralDate or imageUrl and has a URL
 * Returns true if any fields were updated
 */
async function enrichResult(result) {
  if (!result.url) return false;
  if (result.funeralDate && result.visitationDate && result.imageUrl) return false;

  const page = await fetchPage(result.url);
  if (!page) return false;

  const { html, text } = page;
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

  // Extract image URL from HTML
  if (!result.imageUrl) {
    const imageUrl = extractImageUrl(html, result.url);
    if (imageUrl) {
      result.imageUrl = imageUrl;
      updated = true;
      logger.debug(`Enriched image URL for ${result.fullName}: ${imageUrl}`);
    }
  }

  // Fallback: if DOD is still missing, use funeral or visitation date
  // (person definitely died before their funeral/visitation)
  if (!result.dod) {
    if (result.funeralDate) {
      result.dod = result.funeralDate;
      updated = true;
      logger.debug(`Using funeral date as DOD fallback for ${result.fullName}: ${result.funeralDate}`);
    } else if (result.visitationDate) {
      result.dod = result.visitationDate;
      updated = true;
      logger.debug(`Using visitation date as DOD fallback for ${result.fullName}: ${result.visitationDate}`);
    }
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
  // Only enrich results that need it (missing dates or image)
  const toEnrich = results
    .filter(r => r.url && (!r.funeralDate || !r.visitationDate || !r.imageUrl))
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
  fetchPage,
  fetchPageText,
  htmlToText,
  extractImageUrl
};
