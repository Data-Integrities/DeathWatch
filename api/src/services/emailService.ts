const POSTMARK_API_TOKEN = process.env.POSTMARK_API_TOKEN;
const FROM_EMAIL = 'notifications@obitnote.com';
const APP_URL = process.env.APP_URL || 'http://localhost:8081';

interface SearchSummary {
  searchId: string;
  name: string;
  newCount: number;
}

export async function sendMatchNotification(
  toEmail: string,
  searches: SearchSummary[],
  totalNew: number,
) {
  const subject = totalNew === 1
    ? 'ObitNOTE: 1 new match found'
    : `ObitNOTE: ${totalNew} new matches found`;

  const searchLines = searches.map(s =>
    `<tr>
      <td style="padding: 12px 16px; border-bottom: 1px solid #E0E0E0;">
        <a href="${APP_URL}/matches/${s.searchId}" style="color: #2E7D32; font-size: 18px; text-decoration: none; font-weight: 600;">
          ${escapeHtml(s.name)}
        </a>
        <br />
        <span style="color: #616161; font-size: 14px;">${s.newCount} new match${s.newCount !== 1 ? 'es' : ''}</span>
      </td>
    </tr>`
  ).join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF;">
    <tr>
      <td style="padding: 32px 24px; text-align: center; background-color: #2E7D32;">
        <h1 style="margin: 0; color: #FFFFFF; font-size: 28px;">ObitNOTE</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        <h2 style="margin: 0 0 16px; color: #212121; font-size: 22px;">New Matches Found</h2>
        <p style="margin: 0 0 24px; color: #616161; font-size: 18px; line-height: 1.5;">
          We found ${totalNew} new potential match${totalNew !== 1 ? 'es' : ''} for your searches.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">
          ${searchLines}
        </table>
        <div style="text-align: center; margin-top: 32px;">
          <a href="${APP_URL}/matches" style="display: inline-block; padding: 16px 32px; background-color: #2E7D32; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600;">
            View All Matches
          </a>
        </div>
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 24px; text-align: center; color: #9E9E9E; font-size: 12px; border-top: 1px solid #E0E0E0;">
        ObitNOTE — Obituary Monitoring Service
      </td>
    </tr>
  </table>
</body>
</html>`;

  if (!POSTMARK_API_TOKEN) {
    console.log(`[Email] Would send to ${toEmail}: "${subject}"`);
    console.log(`[Email] ${searches.length} searches, ${totalNew} total new matches`);
    return;
  }

  try {
    const resp = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': POSTMARK_API_TOKEN,
      },
      body: JSON.stringify({
        From: FROM_EMAIL,
        To: toEmail,
        Subject: subject,
        HtmlBody: html,
      }),
    });

    if (!resp.ok) {
      const body = await resp.text();
      console.error(`[Email] Postmark error for ${toEmail}:`, body);
    } else {
      console.log(`[Email] Sent notification to ${toEmail}`);
    }
  } catch (err) {
    console.error(`[Email] Failed to send to ${toEmail}:`, err);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
