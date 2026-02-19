import puppeteer, { Browser } from 'puppeteer';

let browser: Browser | null = null;

// Simple in-memory cache: url → { html, fetchedAt }
const cache = new Map<string, { html: string; fetchedAt: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });
  }
  return browser;
}

/**
 * Fetch a URL using headless Chrome.
 * Handles Cloudflare challenges by waiting for the page to fully load.
 * Returns the page HTML or null on failure.
 */
export async function browserFetch(url: string, timeoutMs = 20000): Promise<string | null> {
  // Check cache
  const cached = cache.get(url);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.html;
  }

  let page = null;
  try {
    const b = await getBrowser();
    page = await b.newPage();

    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate and wait for network to settle
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: timeoutMs,
    });

    // If Cloudflare challenge page, wait a bit for it to resolve
    const title = await page.title();
    if (title.includes('Just a moment') || title.includes('Attention Required')) {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => {});
    }

    const html = await page.content();

    // Verify we got real content, not a challenge page
    if (html.includes('Just a moment') && html.includes('challenge-platform')) {
      console.log('[BrowserFetch] Cloudflare challenge not resolved for:', url);
      return null;
    }

    // Cache the result
    cache.set(url, { html, fetchedAt: Date.now() });

    return html;
  } catch (err: any) {
    console.error('[BrowserFetch] Failed:', url, err.message);
    return null;
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
  }
}

/**
 * Shut down the browser (call on process exit)
 */
export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
}
