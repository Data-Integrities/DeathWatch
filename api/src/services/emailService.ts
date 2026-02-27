import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.ZOHO_SMTP_HOST || 'smtp.zoho.com';
const SMTP_PORT = parseInt(process.env.ZOHO_SMTP_PORT || '465', 10);
const SMTP_USER = process.env.ZOHO_SMTP_USER || '';
const SMTP_PASSWORD = process.env.ZOHO_SMTP_PASSWORD || '';
const FROM_EMAIL = SMTP_USER || 'support@obitnote.com';
const APP_URL = process.env.APP_URL || 'http://localhost:8081';
const API_URL = process.env.API_URL || 'http://localhost:3001';

const isDev = !SMTP_PASSWORD;

const transporter = isDev
  ? null
  : nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin: 0; padding: 0; background-color: #F5F5F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF;">
    <tr>
      <td style="padding: 32px 24px; text-align: center; background-color: #663399;">
        <h1 style="margin: 0; color: #FFFFFF; font-size: 28px;">ObitNOTE<span style="font-size: 14px; font-weight: 400; vertical-align: top; line-height: 1;">&trade;</span></h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 24px;">
        ${body}
      </td>
    </tr>
    <tr>
      <td style="padding: 16px 24px; text-align: center; color: #9E9E9E; font-size: 12px; border-top: 1px solid #E0E0E0;">
        Copyright &copy; 2009-${new Date().getFullYear()} UltraSafe Data, LLC (US). All rights reserved.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaButton(href: string, label: string): string {
  return `<div style="text-align: center; margin-top: 32px;">
  <a href="${href}" style="display: inline-block; padding: 16px 32px; background-color: #2E7D32; color: #FFFFFF; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: 600;">
    ${escapeHtml(label)}
  </a>
</div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (isDev || !transporter) {
    console.log(`[Email] Would send to ${to}: "${subject}"`);
    console.log(`[Email] Body preview: ${html.replace(/<[^>]+>/g, '').substring(0, 200)}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: `"ObitNOTE" <${FROM_EMAIL}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to}: "${subject}"`);
  } catch (err) {
    console.error(`[Email] Failed to send to ${to}:`, err);
  }
}

export async function sendWelcomeEmail(toEmail: string, firstName: string, verificationToken: string) {
  const verifyUrl = `${API_URL}/api/auth/verify-email?token=${verificationToken}`;
  const html = wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #212121; font-size: 22px;">Welcome to ObitNOTE, ${escapeHtml(firstName)}!</h2>
    <p style="margin: 0 0 16px; color: #616161; font-size: 18px; line-height: 1.5;">
      Your account has been created. ObitNOTE monitors obituary listings and notifies you when potential matches are found for your searches.
    </p>
    <p style="margin: 0 0 16px; color: #616161; font-size: 18px; line-height: 1.5;">
      Please verify your email address to complete your setup:
    </p>
    ${ctaButton(verifyUrl, 'Verify Email')}
    <p style="margin: 24px 0 0; color: #616161; font-size: 16px; line-height: 1.5;">
      Once verified, get started by creating your first search. You'll receive daily notifications when new matches are found.
    </p>
    <p style="margin: 24px 0 0; color: #9E9E9E; font-size: 14px; line-height: 1.5;">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${verifyUrl}" style="color: #2E7D32; word-break: break-all;">${verifyUrl}</a>
    </p>
  `);

  await sendEmail(toEmail, 'Welcome to ObitNOTE', html);
}

export async function sendVerificationEmail(toEmail: string, firstName: string, token: string) {
  const verifyUrl = `${API_URL}/api/auth/verify-email?token=${token}`;
  const html = wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #212121; font-size: 22px;">Verify Your Email</h2>
    <p style="margin: 0 0 16px; color: #616161; font-size: 18px; line-height: 1.5;">
      Hi ${escapeHtml(firstName)}, please verify your email address by clicking the button below.
    </p>
    <p style="margin: 0 0 16px; color: #616161; font-size: 18px; line-height: 1.5;">
      This link will expire in 24 hours.
    </p>
    ${ctaButton(verifyUrl, 'Verify Email')}
    <p style="margin: 24px 0 0; color: #9E9E9E; font-size: 14px; line-height: 1.5;">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${verifyUrl}" style="color: #2E7D32; word-break: break-all;">${verifyUrl}</a>
    </p>
  `);

  await sendEmail(toEmail, 'ObitNOTE: Verify your email address', html);
}

export async function sendPasswordResetEmail(toEmail: string, token: string) {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const html = wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #212121; font-size: 22px;">Reset Your Password</h2>
    <p style="margin: 0 0 16px; color: #616161; font-size: 18px; line-height: 1.5;">
      We received a request to reset your password. Click the button below to choose a new password.
    </p>
    <p style="margin: 0 0 16px; color: #616161; font-size: 18px; line-height: 1.5;">
      This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
    </p>
    ${ctaButton(resetUrl, 'Reset Password')}
    <p style="margin: 24px 0 0; color: #9E9E9E; font-size: 14px; line-height: 1.5;">
      If the button doesn't work, copy and paste this link into your browser:<br />
      <a href="${resetUrl}" style="color: #2E7D32; word-break: break-all;">${resetUrl}</a>
    </p>
  `);

  await sendEmail(toEmail, 'ObitNOTE: Reset your password', html);
}

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

  const html = wrapHtml(`
    <h2 style="margin: 0 0 16px; color: #212121; font-size: 22px;">New Matches Found</h2>
    <p style="margin: 0 0 24px; color: #616161; font-size: 18px; line-height: 1.5;">
      We found ${totalNew} new potential match${totalNew !== 1 ? 'es' : ''} for your searches.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #E0E0E0; border-radius: 8px; overflow: hidden;">
      ${searchLines}
    </table>
    ${ctaButton(`${APP_URL}/matches`, 'View All Matches')}
  `);

  await sendEmail(toEmail, subject, html);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
