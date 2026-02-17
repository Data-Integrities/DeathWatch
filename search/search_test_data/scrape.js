#!/usr/bin/env node
/**
 * Scrape obituary listings from funeral home websites (Tukios-powered)
 * to generate ground-truth test data for search engine accuracy testing.
 *
 * Uses puppeteer-core with the locally installed Chrome to render
 * client-side JavaScript (Tukios widgets) that cheerio/fetch can't parse.
 *
 * Approach:
 * 1. Launch headless Chrome once, reuse across all sources
 * 2. For each funeral home, navigate to their obituary listing page
 * 3. Wait for Tukios widget to render, extract entries from DOM
 * 4. For entries missing DOD/age, fetch detail pages to extract from full text
 * 5. Filter to recent deaths and output as search-input.json format
 *
 * Usage: node search_test_data/scrape.js [--verbose] [--days N]
 * Output: search_test_data/test-input-YYYY-MM-DD.json
 */

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { extractDodFromText } = require('../src/normalize/dod');
const { logger, LogLevel } = require('../src/utils/logger');

// ============================================================
// Configuration
// ============================================================

let RECENCY_DAYS = 4;
const NAV_TIMEOUT_MS = 20000;
const SELECTOR_TIMEOUT_MS = 5000;
const DELAY_MS = 1500;

// Process CLI flags
if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
  logger.setLevel(LogLevel.DEBUG);
}
const daysIdx = process.argv.indexOf('--days');
if (daysIdx !== -1 && process.argv[daysIdx + 1]) {
  RECENCY_DAYS = parseInt(process.argv[daysIdx + 1], 10) || RECENCY_DAYS;
}

// ============================================================
// Chrome Detection (Windows)
// ============================================================

function findChrome() {
  if (process.env.CHROME_PATH) {
    if (fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    logger.warn(`CHROME_PATH set but not found: ${process.env.CHROME_PATH}`);
  }

  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      logger.debug(`Found Chrome at: ${p}`);
      return p;
    }
  }

  return null;
}

// ============================================================
// Funeral Home Sources (Tukios-powered)
// ============================================================

const SOURCES = [
  // Ohio — confirmed Tukios
  {
    name: 'Newcomer Funeral Homes',
    city: 'Dayton', state: 'OH',
    url: 'https://www.newcomerdayton.com/obituaries',
  },
  {
    name: 'Newcomer Albany',
    city: 'Albany', state: 'NY',
    url: 'https://www.newcomeralbany.com/obituaries',
  },
  {
    name: 'Hodapp Funeral Homes',
    city: 'Cincinnati', state: 'OH',
    url: 'https://www.hodappfuneralhome.com/obituaries',
  },
  {
    name: 'Routsong Funeral Home',
    city: 'Kettering', state: 'OH',
    url: 'https://www.routsong.com/obituaries',
  },

  // Ohio — more Newcomer locations
  {
    name: 'Newcomer Columbus',
    city: 'Columbus', state: 'OH',
    url: 'https://www.newcomercolumbus.com/obituaries',
  },
  {
    name: 'Newcomer Toledo',
    city: 'Toledo', state: 'OH',
    url: 'https://www.newcomertoledo.com/obituaries',
  },

  // Kentucky
  {
    name: 'Newcomer Louisville',
    city: 'Louisville', state: 'KY',
    url: 'https://www.newcomerkentuckiana.com/obituaries',
  },

  // Florida
  {
    name: 'Newcomer Orlando',
    city: 'Orlando', state: 'FL',
    url: 'https://www.newcomerorlando.com/obituaries',
  },
  // Georgia
  {
    name: 'Wages & Sons Funeral Home',
    city: 'Lawrenceville', state: 'GA',
    url: 'https://www.wagesandsons.com/obituaries',
  },
  // Texas
  {
    name: 'Lucas Funeral Home',
    city: 'Hurst', state: 'TX',
    url: 'https://www.lucasfuneralhomes.com/obituaries',
  },

  // New York — Rochester
  {
    name: 'Newcomer Rochester',
    city: 'Rochester', state: 'NY',
    url: 'https://www.newcomerrochester.com/obituaries',
  },

  // Colorado
  {
    name: 'Newcomer Denver',
    city: 'Denver', state: 'CO',
    url: 'https://www.newcomerdenver.com/obituaries',
  },

  // Ohio — Akron area
  {
    name: 'Newcomer Akron',
    city: 'Akron', state: 'OH',
    url: 'https://www.newcomerakron.com/obituaries',
  },

  // === New diverse sources (all verified Tukios) ===

  // West Coast
  {
    name: 'Forest Lawn Funeral Homes',
    city: 'Covina', state: 'CA',
    url: 'https://obituaries.forestlawn.com/obituaries',
  },
  {
    name: 'Riplinger Funeral Home',
    city: 'Spokane', state: 'WA',
    url: 'https://www.riplingerfuneralhome.com/obituaries',
  },

  // Midwest
  {
    name: 'McGuire & Davies Funeral Home',
    city: 'Monmouth', state: 'IL',
    url: 'https://www.mcguireanddaviesfuneralhome.com/obituaries',
  },
  {
    name: 'Stateline Cremations',
    city: 'Loves Park', state: 'IL',
    url: 'https://www.statelinecremations.com/obituaries',
  },
  {
    name: 'Michigan Cremation & Funeral Care',
    city: 'Grand Rapids', state: 'MI',
    url: 'https://www.michigancremation.com/obituaries',
  },
  {
    name: 'Mahn Family Funeral Chapel',
    city: 'Red Wing', state: 'MN',
    url: 'https://www.mahnfamilyfuneralhome.com/obituaries',
  },

  // Northeast
  {
    name: 'Cusick Funeral Home',
    city: 'Somerville', state: 'NJ',
    url: 'https://www.cusickfuneralhome.com/obituaries',
  },
  {
    name: 'Delaney & Son Funeral Home',
    city: 'Walpole', state: 'MA',
    url: 'https://www.delaneyfuneral.com/obituaries',
  },
  {
    name: 'Cognetta Funeral Home',
    city: 'Stamford', state: 'CT',
    url: 'https://www.cognetta.com/obituaries',
  },
  {
    name: 'Newcomer Syracuse',
    city: 'Syracuse', state: 'NY',
    url: 'https://www.newcomersyracuse.com/obituaries',
  },

  // Southeast
  {
    name: 'McClure Funeral Service',
    city: 'Graham', state: 'NC',
    url: 'https://www.mcclurefuneralservice.net/obituaries',
  },
  {
    name: "Murray's Mortuary",
    city: 'Charleston', state: 'SC',
    url: 'https://www.murraysmortuary.com/obituaries',
  },
  {
    name: 'Community Funeral Home',
    city: 'Norfolk', state: 'VA',
    url: 'https://www.communityfh.com/obituaries',
  },
  {
    name: 'Shackelford Funeral Directors',
    city: 'Waynesboro', state: 'TN',
    url: 'https://www.shackelfordfuneraldirectors.com/obituaries',
  },
  {
    name: 'Terrell Broady Funeral Home',
    city: 'Nashville', state: 'TN',
    url: 'https://www.terrellbroadyfuneralhome.com/obituaries',
  },
  {
    name: 'Cherokee Memorial Funeral Home',
    city: 'Centre', state: 'AL',
    url: 'https://www.cherokeememorialfuneralhome.com/obituaries',
  },

  // Southwest
  {
    name: 'Martinez Funeral Chapels',
    city: 'Tucson', state: 'AZ',
    url: 'https://www.martinezfuneralchapels.com/obituaries',
  },

  // Deep South
  {
    name: 'Seale Funeral Service',
    city: 'Denham Springs', state: 'LA',
    url: 'https://www.sealefuneral.com/obituaries',
  },
  {
    name: 'Rose-Neath Funeral Homes',
    city: 'Shreveport', state: 'LA',
    url: 'https://www.rose-neath.com/obituaries',
  },

  // Mountain West
  {
    name: 'Newcomer Casper',
    city: 'Casper', state: 'WY',
    url: 'https://www.newcomercasper.com/obituaries',
  },
];

// ============================================================
// Name Parsing
// ============================================================

const SUFFIXES = new Set([
  'jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v',
  'esq', 'esq.', 'phd', 'ph.d.', 'md', 'm.d.',
]);

const PREFIXES_RE =
  /^(dr\.?|rev\.?|mr\.?|mrs\.?|ms\.?|miss|hon\.?|sgt\.?|cpl\.?|pvt\.?|capt\.?|lt\.?|col\.?|maj\.?|gen\.?|pastor|father|sister|brother|deacon)\s+/i;

function parseName(raw) {
  if (!raw) return null;

  let name = raw
    .replace(/\s+/g, ' ')
    .replace(/["\u201C\u201D][^"\u201C\u201D]*["\u201C\u201D]/g, '')  // remove "nickname" tokens entirely
    .replace(/['\u2018\u2019][^'\u2018\u2019]*['\u2018\u2019]/g, '')  // remove 'nickname' tokens entirely
    .replace(/\(.*?\)/g, '')
    .replace(PREFIXES_RE, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name || name.length < 3) return null;

  const words = name.split(/\s+/);
  if (words.length > 1 && SUFFIXES.has(words[words.length - 1].toLowerCase())) {
    words.pop();
    name = words.join(' ');
  }

  let firstName, middleName, lastName;

  if (name.includes(',')) {
    const [lastPart, ...rest] = name.split(',');
    lastName = lastPart.trim();
    const firstParts = rest.join(',').trim().split(/\s+/);
    firstName = firstParts[0] || '';
    middleName = firstParts.slice(1).join(' ') || '';
  } else {
    const parts = name.split(/\s+/);
    if (parts.length < 2) return null;
    if (parts.length === 2) {
      firstName = parts[0];
      lastName = parts[1];
      middleName = '';
    } else {
      firstName = parts[0];
      lastName = parts[parts.length - 1];
      middleName = parts.slice(1, -1).join(' ');
    }
  }

  firstName = firstName.trim();
  middleName = middleName.trim();
  lastName = lastName.trim();

  if (!firstName || !lastName) return null;
  if (firstName.length < 2 || lastName.length < 2) return null;

  return { firstName, middleName, lastName };
}

// ============================================================
// Age Extraction
// ============================================================

function extractAge(text) {
  if (!text) return null;

  // "at the age of 71" or "age 71" or "Age: 71" or "aged 71"
  let match = text.match(/\b(?:at\s+the\s+)?age[d:]?\s*(?:of\s+)?(\d{1,3})\b/i);
  if (match) {
    const age = parseInt(match[1]);
    if (age >= 0 && age <= 120) return age;
  }

  // ", 71," (age between commas, common in "Name, 71, of City")
  match = text.match(/,\s*(\d{1,3})\s*,/);
  if (match) {
    const age = parseInt(match[1]);
    if (age >= 18 && age <= 120) return age;
  }

  return null;
}

// ============================================================
// City/State Extraction
// ============================================================

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

const STATE_ABBRS = new Set(Object.keys(US_STATES));
const STATE_NAMES_TO_ABBR = {};
for (const [abbr, name] of Object.entries(US_STATES)) {
  STATE_NAMES_TO_ABBR[name.toLowerCase()] = abbr;
}

function extractCityState(text) {
  if (!text) return { city: null, state: null };

  // "of City, ST" — most reliable pattern in obituaries
  // Only match 1-3 capitalized words as the city (avoids grabbing whole clauses)
  let match = text.match(/\bof\s+([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+){0,2}),\s*([A-Z]{2})\b/);
  if (match && STATE_ABBRS.has(match[2])) {
    return { city: match[1].trim(), state: match[2] };
  }

  // "in City, ST" — also common ("resided in Dayton, OH")
  match = text.match(/\bin\s+([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+){0,2}),\s*([A-Z]{2})\b/);
  if (match && STATE_ABBRS.has(match[2])) {
    return { city: match[1].trim(), state: match[2] };
  }

  // "City, State Name" with "of" or "in" prefix
  match = text.match(/\b(?:of|in)\s+([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+){0,2}),\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (match) {
    const stateAbbr = STATE_NAMES_TO_ABBR[match[2].toLowerCase()];
    if (stateAbbr) {
      return { city: match[1].trim(), state: stateAbbr };
    }
  }

  return { city: null, state: null };
}

// ============================================================
// Date Filtering
// ============================================================

function isWithinDays(dateStr, days) {
  if (!dateStr) return false;
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return date >= cutoff && date <= now;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================
// Tukios DOM Extraction (runs inside page.evaluate)
// ============================================================

async function extractTukiosEntries(page) {
  return page.evaluate(() => {
    const entries = [];

    // Tukios listing cards
    const nameEls = document.querySelectorAll('.tukios--obituary-listing-name');

    if (nameEls.length === 0) return entries;

    // Each listing card is typically a parent container with name, dates, snippet, link
    const cards = document.querySelectorAll(
      '.tukios--obituary-listing-card, ' +
      '.tukios--obituary-listing-container, ' +
      '[class*="obituary-listing"]'
    );

    if (cards.length > 0) {
      // Extract from card containers
      for (const card of cards) {
        const nameEl = card.querySelector('.tukios--obituary-listing-name, [class*="listing-name"]');
        const dateEl = card.querySelector('.tukios--obituary-listing-date, [class*="listing-date"]');
        const snippetEl = card.querySelector('.tukios--obituary-listing-snippet, [class*="listing-snippet"]');
        const linkEl = card.querySelector('a[href*="obituar"]') || card.querySelector('a');

        entries.push({
          nameRaw: nameEl ? nameEl.textContent.trim() : null,
          dateText: dateEl ? dateEl.textContent.trim() : null,
          snippetText: snippetEl ? snippetEl.textContent.trim() : null,
          detailUrl: linkEl ? linkEl.href : null,
        });
      }
    } else {
      // Fallback: just grab the name elements and look for siblings
      for (const nameEl of nameEls) {
        const parent = nameEl.closest('div') || nameEl.parentElement;
        const dateEl = parent ? parent.querySelector('.tukios--obituary-listing-date, [class*="listing-date"]') : null;
        const snippetEl = parent ? parent.querySelector('.tukios--obituary-listing-snippet, [class*="listing-snippet"]') : null;
        const linkEl = parent ? (parent.querySelector('a[href*="obituar"]') || parent.querySelector('a')) : null;

        entries.push({
          nameRaw: nameEl.textContent.trim(),
          dateText: dateEl ? dateEl.textContent.trim() : null,
          snippetText: snippetEl ? snippetEl.textContent.trim() : null,
          detailUrl: linkEl ? linkEl.href : null,
        });
      }
    }

    return entries;
  });
}

// ============================================================
// Generic (non-Tukios) DOM Extraction
// ============================================================

async function extractGenericEntries(page) {
  return page.evaluate(() => {
    const entries = [];

    // Common obituary listing selectors across various providers
    const selectors = [
      // Tribute-based sites
      '.obituary-listing .obit-name',
      '.obituary-entry .name',
      // Generic patterns
      '[class*="obituary"] [class*="name"]',
      '[class*="obit"] [class*="name"]',
      '.obit-list .name a',
      // JSON-LD fallback — not accessible in evaluate, handled separately
    ];

    for (const selector of selectors) {
      const nameEls = document.querySelectorAll(selector);
      if (nameEls.length > 0) {
        for (const nameEl of nameEls) {
          const card = nameEl.closest('[class*="obituary"], [class*="obit"], .listing-item, article');
          const dateEl = card ? card.querySelector('[class*="date"]') : null;
          const snippetEl = card ? card.querySelector('[class*="snippet"], [class*="excerpt"], p') : null;
          const linkEl = nameEl.tagName === 'A' ? nameEl : (card ? card.querySelector('a') : null);

          entries.push({
            nameRaw: nameEl.textContent.trim(),
            dateText: dateEl ? dateEl.textContent.trim() : null,
            snippetText: snippetEl ? snippetEl.textContent.trim() : null,
            detailUrl: linkEl ? linkEl.href : null,
          });
        }
        break; // Use first matching selector set
      }
    }

    return entries;
  });
}

// ============================================================
// JSON-LD Extraction (works for sites that embed structured data)
// ============================================================

async function extractJsonLdEntries(page) {
  return page.evaluate(() => {
    const entries = [];
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent);

        // ItemList
        if (data.mainEntity && data.mainEntity.itemListElement) {
          for (const item of data.mainEntity.itemListElement) {
            if (item.name && item.url) {
              entries.push({
                nameRaw: item.name,
                dateText: null,
                snippetText: null,
                detailUrl: item.url,
              });
            }
          }
        }

        if (data['@type'] === 'ItemList' && data.itemListElement) {
          for (const item of data.itemListElement) {
            const thing = item.item || item;
            if (thing.name && thing.url) {
              entries.push({
                nameRaw: thing.name,
                dateText: null,
                snippetText: null,
                detailUrl: thing.url,
              });
            }
          }
        }
      } catch {}
    }

    return entries;
  });
}

// ============================================================
// Detail Page Extraction
// ============================================================

async function extractDetailPageData(page, url) {
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });

    // Give client-side rendering a moment
    await sleep(1000);

    const data = await page.evaluate(() => {
      const bodyText = document.body ? document.body.innerText : '';

      // Try to find structured data
      let jsonLdPerson = null;
      const scripts = document.querySelectorAll('script[type="application/ld+json"]');
      for (const script of scripts) {
        try {
          const d = JSON.parse(script.textContent);
          if (d['@type'] === 'Person') {
            jsonLdPerson = d;
          }
        } catch {}
      }

      return { bodyText, jsonLdPerson };
    });

    const result = { dod: null, age: null, city: null, state: null };

    // From JSON-LD Person
    if (data.jsonLdPerson) {
      if (data.jsonLdPerson.deathPlace && data.jsonLdPerson.deathPlace.address) {
        result.city = data.jsonLdPerson.deathPlace.address.addressLocality || null;
        result.state = data.jsonLdPerson.deathPlace.address.addressRegion || null;
      }
    }

    // From body text
    if (data.bodyText) {
      result.dod = extractDodFromText(data.bodyText);
      result.age = extractAge(data.bodyText);

      if (!result.city || !result.state) {
        const loc = extractCityState(data.bodyText);
        if (!result.city) result.city = loc.city;
        if (!result.state) result.state = loc.state;
      }
    }

    return result;
  } catch (err) {
    logger.debug(`  Detail page error: ${err.message}`);
    return { dod: null, age: null, city: null, state: null };
  }
}

// ============================================================
// Per-Source Scraping
// ============================================================

async function scrapeSource(browser, source) {
  const result = {
    name: source.name,
    entries: [],
    error: null,
    detailFetches: 0,
    detailSuccesses: 0,
  };

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Navigate to listing page
    logger.info(`[${source.name}] Navigating: ${source.url}`);
    await page.goto(source.url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS });

    // Try Tukios selectors first
    let entries = [];
    let detectionMethod = 'none';

    try {
      await page.waitForSelector('.tukios--obituary-listing-name', { timeout: SELECTOR_TIMEOUT_MS });
      entries = await extractTukiosEntries(page);
      detectionMethod = 'tukios';
    } catch {
      // Not Tukios — try generic
      logger.debug(`[${source.name}] No Tukios widget, trying generic selectors`);
      entries = await extractGenericEntries(page);
      if (entries.length > 0) {
        detectionMethod = 'generic';
      } else {
        // Try JSON-LD
        entries = await extractJsonLdEntries(page);
        if (entries.length > 0) {
          detectionMethod = 'json-ld';
        }
      }
    }

    logger.info(`[${source.name}] Found ${entries.length} entries (${detectionMethod})`);

    if (entries.length === 0) {
      // Log page title for debugging
      const title = await page.title();
      logger.debug(`[${source.name}] Page title: "${title}"`);
      await page.close();
      return result;
    }

    // Process each entry
    for (const entry of entries) {
      if (!entry.nameRaw) continue;

      // Extract DOD from date text or snippet
      let dod = null;
      let age = null;
      let city = null;
      let state = null;

      if (entry.dateText) {
        dod = extractDodFromText(entry.dateText);
      }
      if (entry.snippetText) {
        if (!dod) dod = extractDodFromText(entry.snippetText);
        age = extractAge(entry.snippetText);
        const loc = extractCityState(entry.snippetText);
        city = loc.city;
        state = loc.state;
      }

      // If missing critical data and we have a detail URL, fetch the detail page
      if ((!dod || !age) && entry.detailUrl) {
        result.detailFetches++;
        logger.debug(`[${source.name}] Fetching detail: ${entry.nameRaw}`);

        await sleep(DELAY_MS);
        const detail = await extractDetailPageData(page, entry.detailUrl);

        if (detail.dod || detail.age || detail.city) {
          result.detailSuccesses++;
        }

        if (!dod && detail.dod) dod = detail.dod;
        if (!age && detail.age) age = detail.age;
        if (!city && detail.city) city = detail.city;
        if (!state && detail.state) state = detail.state;

        // Navigate back to listing page for next entry's detail if needed
        // (page.goto in extractDetailPageData already navigated away)
      }

      result.entries.push({
        nameRaw: entry.nameRaw,
        dod,
        age,
        city: city || source.city,
        state: state || source.state,
        detailUrl: entry.detailUrl || null,
      });
    }
  } catch (err) {
    result.error = err.message;
  } finally {
    if (page) {
      try { await page.close(); } catch {}
    }
  }

  return result;
}

// ============================================================
// Edge-Case Name Search (via Serper API)
// ============================================================

// Names that collide with obituary content or date words.
// We search for real recent obituaries with these names to ensure
// name extraction and scoring handle them correctly.
const EDGE_CASE_NAMES = [
  // First names that appear in obituary content ("loving", "hope", "faith")
  { firstName: 'Hope', lastName: null },
  { firstName: 'Faith', lastName: null },
  // Last names that appear in obituary content ("love", "loving")
  { firstName: null, lastName: 'Love' },
  { firstName: null, lastName: 'Loving' },
  // Last names that are also month names (date confusion)
  { firstName: null, lastName: 'May' },
  { firstName: null, lastName: 'March' },
  { firstName: null, lastName: 'August' },
];

/**
 * Search Serper for a recent obituary matching an edge-case name pattern.
 * Returns the top funeral-home result (skips aggregators like legacy.com).
 * Uses a wider recency window (7 days) since these specific names are harder to find.
 */
const EDGE_CASE_RECENCY_DAYS = 7;

async function searchEdgeCaseName(browser, nameSpec) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    logger.warn('SERPER_API_KEY not set, skipping edge-case name search');
    return null;
  }

  const name = nameSpec.firstName || nameSpec.lastName;
  const targetName = name.toLowerCase();
  const now = new Date();
  const monthName = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();

  // Skip aggregators and social media
  const SKIP_DOMAINS = /legacy\.com|echovita\.com|dignitymemorial\.com|tributes\.com|obituaries\.com|everhere\.com|facebook\.com|instagram\.com/i;

  // Try multiple query strategies (first names are easier; last names need inurl to avoid content noise)
  const queries = nameSpec.firstName
    ? [`"${name}" obituary ${monthName} ${year} funeral home`]
    : [
        `inurl:${targetName} obituary ${monthName} ${year} funeral`,
        `"${name}" obituary 2026 inurl:obituaries inurl:${targetName}`,
        `"${name}" obituary ${monthName} ${year} funeral home`,
      ];

  try {
    for (const query of queries) {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: 20 }),
      });
      if (!response.ok) continue;

      const data = await response.json();
      const results = data.organic || [];

      for (const r of results) {
        if (!r.link || SKIP_DOMAINS.test(r.link)) continue;

        // Must look like an individual obituary page
        if (!/obituar|tribute|memorial/i.test(r.link)) continue;

        // URL slug must contain the target name as a distinct segment (not part of another word)
        let urlPath;
        try { urlPath = new URL(r.link).pathname.toLowerCase(); } catch { continue; }
        const slugPattern = new RegExp('[-/]' + targetName + '(?:[-/?]|$)');
        if (!slugPattern.test(urlPath)) continue;

        // Try to extract data from the search snippet
        const snippet = r.snippet || '';
        const title = r.title || '';
        const combined = `${title} ${snippet}`;

        const dod = extractDodFromText(snippet) || extractDodFromText(title);
        if (!dod || !isWithinDays(dod, EDGE_CASE_RECENCY_DAYS)) continue;

        const age = extractAge(combined);
        const loc = extractCityState(combined);

        // Extract name from title — strip site suffix, "Obituary", and trailing dates
        const titleClean = title
          .split(/\s*[-|–—]\s*/)[0]
          .replace(/\s*obituary\s*/gi, ' ')
          .replace(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi, '')
          .replace(/\s+/g, ' ')
          .trim();
        const parsed = parseName(titleClean);
        if (!parsed) continue;

        // Verify the edge-case name is in the correct position (first vs last)
        const firstLower = parsed.firstName.toLowerCase();
        const lastLower = parsed.lastName.toLowerCase();
        if (nameSpec.firstName && firstLower !== targetName) continue;
        if (nameSpec.lastName && lastLower !== targetName) continue;

        // Fetch the actual page for more accurate data
        let detailData = { dod, age, city: loc.city, state: loc.state };
        try {
          const page = await browser.newPage();
          const detail = await extractDetailPageData(page, r.link);
          await page.close();
          if (detail.dod) detailData.dod = detail.dod;
          if (detail.age) detailData.age = detail.age;
          if (detail.city) detailData.city = detail.city;
          if (detail.state) detailData.state = detail.state;
        } catch {
          // Use snippet data as fallback
        }

        // Final recency check with detail data
        if (!detailData.dod || !isWithinDays(detailData.dod, EDGE_CASE_RECENCY_DAYS)) continue;

        logger.info(`[EdgeCase] Found: ${parsed.firstName} ${parsed.lastName} (${r.link})`);

        return {
          firstName: parsed.firstName,
          middleName: parsed.middleName || '',
          lastName: parsed.lastName,
          apxAge: detailData.age || age || null,
          city: detailData.city || loc.city || '',
          state: detailData.state || loc.state || '',
          dod: detailData.dod,
          dataSourceName: new URL(r.link).hostname.replace(/^www\./, ''),
          dataSourceLocation: `${detailData.city || '?'}, ${detailData.state || '?'}`,
          dataSourceUrl: r.link,
          edgeCaseTag: nameSpec.firstName
            ? `firstName:${nameSpec.firstName}`
            : `lastName:${nameSpec.lastName}`,
        };
      }

      await sleep(300); // Rate limit between query strategies
    }
  } catch (err) {
    logger.debug(`[EdgeCase] Search failed for ${name}: ${err.message}`);
  }

  return null;
}

// ============================================================
// Main
// ============================================================

async function main() {
  // Find Chrome
  const chromePath = findChrome();
  if (!chromePath) {
    console.error('Chrome not found. Set CHROME_PATH env var or install Chrome.');
    console.error('Checked:');
    console.error('  C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    console.error('  C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
    process.exit(1);
  }
  logger.info(`Using Chrome: ${chromePath}`);

  // Launch browser
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const allRecords = [];
  const sourceStats = [];

  console.log('='.repeat(60));
  console.log('Obituary Test Data Scraper (Funeral Home Websites)');
  console.log(`Looking for deaths within the last ${RECENCY_DAYS} days`);
  console.log(`Scraping ${SOURCES.length} funeral home sources`);
  console.log('='.repeat(60) + '\n');

  try {
    for (let i = 0; i < SOURCES.length; i++) {
      const source = SOURCES[i];

      if (i > 0) await sleep(DELAY_MS);

      const result = await scrapeSource(browser, source);

      if (result.error) {
        logger.warn(`[${result.name}] FAILED: ${result.error}`);
        sourceStats.push({ name: result.name, status: 'FAILED', reason: result.error, count: 0 });
        continue;
      }

      // Filter to recent DODs and convert to output format
      let recentCnt = 0;
      let filteredCnt = 0;
      let noDodCnt = 0;

      for (const entry of result.entries) {
        if (!entry.dod) {
          noDodCnt++;
          continue;
        }

        if (!isWithinDays(entry.dod, RECENCY_DAYS)) {
          filteredCnt++;
          continue;
        }

        const parsed = parseName(entry.nameRaw);
        if (!parsed) continue;

        allRecords.push({
          firstName: parsed.firstName,
          middleName: parsed.middleName || '',
          lastName: parsed.lastName,
          apxAge: entry.age || null,
          city: entry.city || '',
          state: entry.state || '',
          dod: entry.dod,
          dataSourceName: source.name,
          dataSourceLocation: `${source.city}, ${source.state}`,
          dataSourceUrl: entry.detailUrl || null,
        });

        recentCnt++;
      }

      logger.info(
        `[${result.name}] Results: ${recentCnt} recent, ${filteredCnt} too old, ` +
          `${noDodCnt} no DOD (${result.detailSuccesses}/${result.detailFetches} details OK)`
      );

      sourceStats.push({
        name: result.name,
        status: 'OK',
        total: result.entries.length,
        recent: recentCnt,
        filtered: filteredCnt,
        noDod: noDodCnt,
        detailFetches: result.detailFetches,
        detailSuccesses: result.detailSuccesses,
        count: recentCnt,
      });
    }

    // --- Edge-case name search ---
    console.log('\n' + '-'.repeat(60));
    console.log('Searching for edge-case names (content/date word collisions)');
    console.log('-'.repeat(60));

    let edgeCaseCnt = 0;
    for (const nameSpec of EDGE_CASE_NAMES) {
      const label = nameSpec.firstName
        ? `firstName:${nameSpec.firstName}`
        : `lastName:${nameSpec.lastName}`;

      const rec = await searchEdgeCaseName(browser, nameSpec);
      if (rec) {
        allRecords.push(rec);
        edgeCaseCnt++;
        console.log(`  ✓ ${label} → ${rec.firstName} ${rec.lastName} (${rec.city}, ${rec.state})`);
      } else {
        console.log(`  ✗ ${label} → no recent match found`);
      }
      await sleep(500); // Rate limit Serper calls
    }
    console.log(`Edge-case results: ${edgeCaseCnt}/${EDGE_CASE_NAMES.length} found`);
  } finally {
    await browser.close();
  }

  // Deduplicate by first+last+state+age (prevents different people with same name colliding)
  const seen = new Set();
  const deduped = [];
  for (const rec of allRecords) {
    const key = `${rec.firstName.toLowerCase()}-${rec.lastName.toLowerCase()}-${(rec.state || '').toLowerCase()}-${rec.apxAge || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(rec);
    }
  }

  // Write output
  const today = new Date().toISOString().slice(0, 10);
  const outPath = path.join(__dirname, `test-input-${today}.json`);
  fs.writeFileSync(outPath, JSON.stringify(deduped, null, 2));

  // ============================================================
  // Summary
  // ============================================================

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const ok = sourceStats.filter((s) => s.status === 'OK');
  const failed = sourceStats.filter((s) => s.status === 'FAILED');

  console.log(
    `\nSources: ${SOURCES.length} attempted, ${ok.length} succeeded, ${failed.length} failed`
  );
  console.log(`Records: ${allRecords.length} total, ${deduped.length} after dedup`);
  console.log(`Output:  ${outPath}`);

  if (failed.length > 0) {
    console.log('\nFailed sources:');
    for (const s of failed) {
      console.log(`  ${s.name}: ${s.reason}`);
    }
  }

  if (ok.length > 0) {
    console.log('\nSuccessful sources:');
    for (const s of ok) {
      console.log(
        `  ${s.name}: ${s.count} recent / ${s.total} parsed` +
          ` (${s.detailSuccesses}/${s.detailFetches} details OK)`
      );
    }
  }

  // Geographic breakdown
  const byState = {};
  for (const r of deduped) {
    if (r.state) byState[r.state] = (byState[r.state] || 0) + 1;
  }
  if (Object.keys(byState).length > 0) {
    console.log('\nBy state:');
    for (const [state, count] of Object.entries(byState).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${state}: ${count}`);
    }
  }

  // Data completeness
  const withAge = deduped.filter((r) => r.apxAge !== null).length;
  const withCity = deduped.filter((r) => r.city).length;
  console.log(`\nData completeness (${deduped.length} records):`);
  console.log(
    `  With age:   ${withAge} (${deduped.length ? Math.round((withAge / deduped.length) * 100) : 0}%)`
  );
  console.log(
    `  With city:  ${withCity} (${deduped.length ? Math.round((withCity / deduped.length) * 100) : 0}%)`
  );
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
