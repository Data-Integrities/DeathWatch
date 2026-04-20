import { SinchClient } from '@sinch/sdk-core';
import { normalizePhone } from '../utils/phone';

const PROJECT_ID = process.env.SINCH_PROJECT_ID || '';
const KEY_ID = process.env.SINCH_KEY_ID || '';
const KEY_SECRET = process.env.SINCH_KEY_SECRET || '';
const FROM_NUMBER = process.env.SINCH_FROM_NUMBER || '';

const isDev = !PROJECT_ID || !KEY_ID || !KEY_SECRET || !FROM_NUMBER;

const sinch = isDev ? null : new SinchClient({
  projectId: PROJECT_ID,
  keyId: KEY_ID,
  keySecret: KEY_SECRET,
});

export async function sendSms(to: string, body: string) {
  const normalized = normalizePhone(to);
  if (!normalized) {
    console.error(`[SMS] Invalid phone number: "${to}"`);
    return;
  }
  if (isDev || !sinch) {
    console.log(`[SMS] Would send to ${normalized}: "${body}"`);
    return;
  }

  try {
    const response = await sinch.sms.batches.send({
      sendSMSRequestBody: {
        to: [normalized],
        from: FROM_NUMBER,
        body,
      },
    });
    console.log(`[SMS] Sent to ${normalized} | Batch ID: ${response.id} | Type: ${response.type}`);
  } catch (err: any) {
    console.error(`[SMS] Failed to send to ${normalized} | Code: ${err.code} | Status: ${err.status} | Message: ${err.message}`);
  }
}

export async function sendMatchSms(phone: string) {
  await sendSms(phone, 'ObitNote: New potential obituary match found.  Sign in to see: https://ObitNote.com');
}

export async function sendReplySms(phone: string) {
  await sendSms(phone, 'ObitNote: You have a new support reply.  Sign in to read: https://ObitNote.com');
}

export async function sendErrorAlertSms(phone: string, summary: string) {
  await sendSms(phone, `ObitNote ERROR: ${summary}`);
}
