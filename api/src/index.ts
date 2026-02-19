import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import authRoutes from './routes/auth';
import searchRoutes from './routes/searches';
import matchRoutes from './routes/matches';
import notificationRoutes from './routes/notifications';
import { runBatch, getUsersWithNewResults } from './services/batchService';
import { sendMatchNotification } from './services/emailService';
import { browserFetch, closeBrowser } from './services/browserFetch';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/searches', searchRoutes);
app.use('/api/matches', matchRoutes);
app.use('/api/notifications', notificationRoutes);

// Proxy: serves obituary pages in an iframe-friendly way.
// If the real page can be fetched, serve it with headers stripped.
// If blocked (Cloudflare/403), serve a styled fallback page with the data we have.
app.get('/api/proxy', async (req, res) => {
  const url = req.query.url as string;
  const name = (req.query.name as string) || '';
  const snippet = (req.query.snippet as string) || '';
  const age = (req.query.age as string) || '';
  const location = (req.query.location as string) || '';
  const dod = (req.query.dod as string) || '';
  const source = (req.query.source as string) || '';
  const imageUrl = (req.query.imageUrl as string) || '';

  if (!url) {
    res.status(400).send('url required');
    return;
  }

  const sendFallback = () => {
    if (res.headersSent) return;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(buildFallbackPage({ url, name, snippet, age, location, dod, source, imageUrl }));
  };

  const sendHtml = (html: string) => {
    if (res.headersSent) return;
    const origin = new URL(url).origin;
    const cleaned = html.replace(/(<head[^>]*>)/i, `$1<base href="${origin}/">`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(cleaned);
  };

  // Overall timeout: if nothing responds in 6s, serve fallback immediately
  const fallbackTimer = setTimeout(() => {
    console.log('[Proxy] Overall timeout — serving fallback for:', url);
    sendFallback();
  }, 6000);

  try {
    // Strategy 1: Try simple fetch (fast, works for non-Cloudflare sites)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      clearTimeout(timer);

      if (response.ok) {
        const html = await response.text();
        const isCloudflare = html.includes('Just a moment') && (html.includes('cf-browser-verification') || html.includes('challenge-platform'));

        if (!isCloudflare) {
          clearTimeout(fallbackTimer);
          sendHtml(html);
          return;
        }
      }
      console.log('[Proxy] Simple fetch blocked, trying headless browser for:', url);
    } catch (err: any) {
      console.log('[Proxy] Simple fetch failed, trying headless browser for:', url);
    }

    // Strategy 2: Use headless Chrome (handles Cloudflare JS challenges)
    if (!res.headersSent) {
      try {
        const html = await browserFetch(url, 8000);
        if (html && !res.headersSent) {
          clearTimeout(fallbackTimer);
          sendHtml(html);
          return;
        }
      } catch (err: any) {
        console.error('[Proxy] Browser fetch failed:', url, err.message);
      }
    }

    // Strategy 3: Fallback
    clearTimeout(fallbackTimer);
    sendFallback();
  } catch (err: any) {
    clearTimeout(fallbackTimer);
    console.error('[Proxy] Unexpected error:', err.message);
    sendFallback();
  }
});

function buildFallbackPage(data: { url: string; name: string; snippet: string; age: string; location: string; dod: string; source: string; imageUrl?: string }): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const details: string[] = [];
  if (data.age) details.push(`Age ${esc(data.age)}`);
  if (data.location) details.push(esc(data.location));
  if (data.dod) details.push(esc(formatDate(data.dod)));

  // Extract source domain for display
  let sourceDomain = '';
  try { sourceDomain = new URL(data.url).hostname.replace('www.', ''); } catch {}

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    background: #f8f6f2; color: #2a2a2a;
    padding: 32px 20px; line-height: 1.7;
    display: flex; align-items: center; justify-content: center;
  }
  .obit {
    max-width: 580px; width: 100%;
    background: #fff; border-radius: 12px;
    padding: 40px 36px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.06);
    border-top: 4px solid #2E7D32;
  }
  .photo {
    display: block; width: 160px; height: 160px;
    border-radius: 50%; object-fit: cover;
    margin: 0 auto 24px; border: 3px solid #e8e8e8;
  }
  h1 {
    font-size: 32px; font-weight: 700; text-align: center;
    color: #1a1a1a; margin-bottom: 8px;
    font-family: Georgia, serif;
  }
  .details {
    text-align: center; font-size: 17px; color: #666;
    margin-bottom: 28px; font-family: -apple-system, sans-serif;
  }
  .details span { margin: 0 6px; }
  .details span:not(:last-child)::after { content: '·'; margin-left: 12px; color: #ccc; }
  .divider {
    width: 60px; height: 2px; background: #2E7D32;
    margin: 0 auto 28px; border-radius: 1px;
  }
  .text {
    font-size: 19px; line-height: 1.8; color: #333;
    text-align: left;
  }
  .source {
    margin-top: 28px; padding-top: 16px;
    border-top: 1px solid #eee;
    font-size: 13px; color: #aaa; text-align: center;
    font-family: -apple-system, sans-serif;
  }
</style></head><body>
<div class="obit">
  ${data.imageUrl ? `<img class="photo" src="${esc(data.imageUrl)}" alt="${esc(data.name)}">` : ''}
  <h1>${esc(data.name) || 'Obituary'}</h1>
  ${details.length > 0 ? `<div class="details">${details.map(d => `<span>${d}</span>`).join('')}</div>` : ''}
  <div class="divider"></div>
  ${data.snippet ? `<div class="text">${esc(data.snippet)}</div>` : '<div class="text" style="color:#999;text-align:center;">No obituary text available.</div>'}
  ${sourceDomain ? `<div class="source">Source: ${esc(sourceDomain)}</div>` : ''}
</div>
</body></html>`;
}

function formatDate(d: string): string {
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  } catch { return d; }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`ObitNOTE API running on http://localhost:${PORT}`);
});

// Daily batch: run at 11:00 AM ET (16:00 UTC)
cron.schedule('0 16 * * *', async () => {
  console.log('[Cron] Starting daily batch search...');
  try {
    await runBatch();

    // Send notifications
    const users = await getUsersWithNewResults();
    for (const u of users) {
      await sendMatchNotification(u.email, u.searches, u.new_count);
    }
    console.log(`[Cron] Sent notifications to ${users.length} users`);
  } catch (err) {
    console.error('[Cron] Batch failed:', err);
  }
});

// Clean up headless browser on shutdown
process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });

export { app };
