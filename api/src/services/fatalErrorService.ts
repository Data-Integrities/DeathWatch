import { pool } from '../db/pool';
import { sendSms } from './smsService';

const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MINUTES = 3;

export async function reportFatalError(
  source: string,
  errorCode: string | null,
  message: string,
): Promise<{ id: number; smsSent: boolean; rateLimited: boolean }> {
  const { rows: staffRows } = await pool.query(
    'SELECT id, name, phone_number FROM support_staff WHERE is_on_call = true LIMIT 1',
  );
  const chief = staffRows[0] || null;

  const { rows: rateRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM fatal_error
     WHERE sms_sent = true AND created_at > NOW() - INTERVAL '${RATE_LIMIT_WINDOW_MINUTES} minutes'`,
  );
  const recentSmsCount = rateRows[0].cnt;
  const rateLimited = recentSmsCount >= RATE_LIMIT_COUNT;

  const now = new Date();
  const ts = now.toISOString().slice(0, 16).replace('T', ' ').replace(/-/g, '').replace(/:/g, ':');
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timePart = now.toISOString().slice(11, 16);
  const codeDisplay = errorCode ? ` error ${errorCode}` : '';
  const smsBody = `ObitNote FATAL ERROR: ${source} produced${codeDisplay} timestamp ${datePart} ${timePart} UTC.`;

  let smsSent = false;
  if (chief && !rateLimited) {
    try {
      await sendSms(chief.phone_number, smsBody);
      smsSent = true;
    } catch (err: any) {
      console.error('[FatalError] SMS failed:', err.message);
    }
  }

  if (rateLimited) {
    console.warn(`[FatalError] Rate limited (${recentSmsCount}/${RATE_LIMIT_COUNT} in ${RATE_LIMIT_WINDOW_MINUTES}min) — ${source}${codeDisplay}: ${message}`);
  }

  const { rows } = await pool.query(
    `INSERT INTO fatal_error (source, error_code, message, staff_id, staff_name, sms_sent, rate_limited)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [source, errorCode, message, chief?.id || null, chief?.name || null, smsSent, rateLimited],
  );

  return { id: rows[0].id, smsSent, rateLimited };
}
