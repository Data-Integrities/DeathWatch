import twilio from 'twilio';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER || '';

const isDev = !ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER;

const client = isDev ? null : twilio(ACCOUNT_SID, AUTH_TOKEN);

function normalizePhone(phone: string): string {
  const digits = phone.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  return `+${digits}`;
}

export async function sendSms(to: string, body: string) {
  const normalized = normalizePhone(to);
  if (isDev || !client) {
    console.log(`[SMS] Would send to ${normalized}: "${body}"`);
    return;
  }

  try {
    const msg = await client.messages.create({
      to: normalized,
      from: FROM_NUMBER,
      body,
    });
    console.log(`[SMS] Sent to ${normalized} | SID: ${msg.sid} | Status: ${msg.status}`);
  } catch (err: any) {
    console.error(`[SMS] Failed to send to ${normalized} | Code: ${err.code} | Status: ${err.status} | Message: ${err.message}`);
  }
}

export async function sendMatchSms(phone: string) {
  await sendSms(phone, 'ObitNOTE: A new potential obituary match has been found.  Sign in to review: https://obitnote.com');
}

export async function sendReplySms(phone: string) {
  await sendSms(phone, 'ObitNOTE: You have a new support reply.  Sign in to read: https://obitnote.com');
}

export async function sendErrorAlertSms(phone: string, summary: string) {
  await sendSms(phone, `ObitNOTE ERROR: ${summary}`);
}
