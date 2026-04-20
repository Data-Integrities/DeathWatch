import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool';
import type { UserProfile } from '../types';
import { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } from './emailService';
import { normalizePhone } from '../utils/phone';
import { lookupGeo } from './geoService';
import { getUnreadReplyCount, getUnreadTicketIds } from './messageService';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SALT_ROUNDS = 10;

function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

const PLAN_LIMITS: Record<string, number> = {
  PLAN_5: 5, PLAN_10: 10, PLAN_PREMIUM: 9999,
};

function getPlanLimit(planCode: string | null, tierCustomCap: number | null): number | null {
  if (!planCode) return null;
  return PLAN_LIMITS[planCode] ?? tierCustomCap ?? null;
}

function rowToUser(row: any, unreadReplies = 0, ticketIds: string[] = []): UserProfile {
  return {
    id: row.login_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    isAdmin: row.is_admin || false,
    emailVerified: row.email_verified || false,
    skipMatchesInfoCard: row.skip_matches_info_card || false,
    unreadReplyCount: unreadReplies,
    unreadTicketIds: ticketIds,
    trialSearchesUsed: row.trial_searches_used || 0,
    trialSearchesMax: 3,
    subscriptionActive: row.subscription_active || false,
    planCode: row.plan_code || null,
    planStartDate: row.plan_start_date ? row.plan_start_date.toISOString?.().slice(0, 10) ?? row.plan_start_date : null,
    planRenewalDate: row.plan_renewal_date ? row.plan_renewal_date.toISOString?.().slice(0, 10) ?? row.plan_renewal_date : null,
    usingGraceSlot: row.using_grace_slot || false,
    planLimit: getPlanLimit(row.plan_code, row.tier_custom_cap),
    phoneNumber: row.phone_number || null,
    smsOptIn: row.sms_opt_in !== false,
  };
}

function generateVerificationToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expires };
}

export async function impersonate(targetUserId: string) {
  const { rows } = await pool.query(
    'SELECT * FROM dw_user WHERE login_id = $1',
    [targetUserId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  const [unreadReplies, unreadTickets] = await Promise.all([
    getUnreadReplyCount(targetUserId),
    getUnreadTicketIds(targetUserId),
  ]);
  const user = rowToUser(rows[0], unreadReplies, unreadTickets);
  const token = makeToken(user.id);
  return { token, user };
}

export async function register(email: string, password: string, firstName: string, lastName: string, phoneNumber?: string) {
  const existing = await pool.query(
    'SELECT login_id FROM dw_user WHERE email = $1',
    [email.toLowerCase()]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('This email already has an account in ObitNote.'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

  const { rows } = await pool.query(
    `INSERT INTO dw_user (email, password_hash, first_name, last_name, verification_token, verification_token_expires, phone_number)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [email.toLowerCase(), passwordHash, firstName, lastName, verificationToken, verificationExpires, normalizePhone(phoneNumber)]
  );

  const user = rowToUser(rows[0]);
  const jwtToken = makeToken(user.id);

  // Send single welcome+verification email (don't block registration on email failure)
  sendWelcomeEmail(email, firstName, verificationToken).catch(err => console.error('[Auth] Welcome email failed:', err));

  return { token: jwtToken, user };
}

export async function login(email: string, password: string, clientIp?: string) {
  const { rows } = await pool.query(
    'SELECT * FROM dw_user WHERE email = $1',
    [email.toLowerCase()]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const row = rows[0];
  const valid = await bcrypt.compare(password, row.password_hash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), { status: 401 });
  }

  const [unreadReplies, unreadTickets] = await Promise.all([
    getUnreadReplyCount(row.login_id),
    getUnreadTicketIds(row.login_id),
  ]);
  const user = rowToUser(row, unreadReplies, unreadTickets);
  const token = makeToken(user.id);

  // Record login history with geo data (non-blocking)
  try {
    const geo = lookupGeo(clientIp);
    pool.query(
      `INSERT INTO login_history (login_id, geo_city, geo_region, geo_country, geo_lat, geo_lon, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, geo?.city || null, geo?.region || null, geo?.country || null, geo?.lat || null, geo?.lon || null, clientIp || null]
    ).catch(err => console.error('[Auth] login_history insert failed:', err.message));
  } catch (err: any) {
    console.error('[Auth] Geo lookup failed:', err.message);
  }

  return { token, user };
}

export async function getMe(userId: string) {
  const { rows } = await pool.query(
    'SELECT * FROM dw_user WHERE login_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  const [unreadReplies, unreadTickets] = await Promise.all([
    getUnreadReplyCount(userId),
    getUnreadTicketIds(userId),
  ]);
  return rowToUser(rows[0], unreadReplies, unreadTickets);
}

export async function forgotPassword(email: string) {
  const { rows } = await pool.query(
    'SELECT login_id FROM dw_user WHERE email = $1',
    [email.toLowerCase()]
  );
  if (rows.length === 0) {
    return;
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 60 * 60 * 1000);

  await pool.query(
    `UPDATE dw_user SET reset_token = $1, reset_token_expires = $2, updated_at = NOW()
     WHERE email = $3`,
    [resetToken, expires, email.toLowerCase()]
  );

  await sendPasswordResetEmail(email, resetToken);
}

export async function resetPassword(token: string, password: string) {
  const { rows } = await pool.query(
    `SELECT login_id FROM dw_user
     WHERE reset_token = $1 AND reset_token_expires > NOW()`,
    [token]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Invalid or expired reset token'), { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await pool.query(
    `UPDATE dw_user
     SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL, updated_at = NOW()
     WHERE login_id = $2`,
    [passwordHash, rows[0].login_id]
  );
}

export async function verifyEmail(token: string) {
  const { rows } = await pool.query(
    `SELECT login_id FROM dw_user
     WHERE verification_token = $1 AND verification_token_expires > NOW()`,
    [token]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Invalid or expired verification link'), { status: 400 });
  }

  await pool.query(
    `UPDATE dw_user
     SET email_verified = true, verification_token = NULL, verification_token_expires = NULL, updated_at = NOW()
     WHERE login_id = $1`,
    [rows[0].login_id]
  );
}

export async function resendVerification(userId: string) {
  const { rows } = await pool.query(
    'SELECT email, first_name, email_verified FROM dw_user WHERE login_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }
  if (rows[0].email_verified) {
    throw Object.assign(new Error('Email is already verified'), { status: 400 });
  }

  const { token, expires } = generateVerificationToken();
  await pool.query(
    `UPDATE dw_user SET verification_token = $1, verification_token_expires = $2, updated_at = NOW()
     WHERE login_id = $3`,
    [token, expires, userId]
  );

  await sendVerificationEmail(rows[0].email, rows[0].first_name, token);
}

export async function changeEmail(userId: string, newEmail: string, currentPassword: string) {
  const { rows } = await pool.query(
    'SELECT password_hash, first_name FROM dw_user WHERE login_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    throw Object.assign(new Error('Current password is incorrect'), { status: 401 });
  }

  const existing = await pool.query(
    'SELECT login_id FROM dw_user WHERE email = $1 AND login_id != $2',
    [newEmail.toLowerCase(), userId]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Email already in use'), { status: 409 });
  }

  const { token, expires } = generateVerificationToken();

  await pool.query(
    `UPDATE dw_user SET email = $1, email_verified = false, verification_token = $2, verification_token_expires = $3, updated_at = NOW()
     WHERE login_id = $4`,
    [newEmail.toLowerCase(), token, expires, userId]
  );

  // Send verification email to the new address
  sendVerificationEmail(newEmail, rows[0].first_name, token).catch(err => console.error('[Auth] Verification email failed:', err));
}

const ALLOWED_PREFERENCES = ['skip_matches_info_card', 'sms_opt_in'] as const;

export async function updatePreference(userId: string, key: string, value: boolean) {
  if (!ALLOWED_PREFERENCES.includes(key as any)) {
    throw Object.assign(new Error('Invalid preference key'), { status: 400 });
  }
  await pool.query(
    `UPDATE dw_user SET ${key} = $1, updated_at = NOW() WHERE login_id = $2`,
    [value, userId]
  );
}

export async function updatePhone(userId: string, phoneNumber: string | null) {
  const normalized = normalizePhone(phoneNumber);
  await pool.query(
    'UPDATE dw_user SET phone_number = $1, updated_at = NOW() WHERE login_id = $2',
    [normalized, userId]
  );
}

export async function updateName(userId: string, firstName: string, lastName: string) {
  await pool.query(
    'UPDATE dw_user SET first_name = $1, last_name = $2, updated_at = NOW() WHERE login_id = $3',
    [firstName, lastName, userId]
  );
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const { rows } = await pool.query(
    'SELECT password_hash FROM dw_user WHERE login_id = $1',
    [userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('User not found'), { status: 404 });
  }

  const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!valid) {
    throw Object.assign(new Error('Current password is incorrect'), { status: 401 });
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query(
    'UPDATE dw_user SET password_hash = $1, updated_at = NOW() WHERE login_id = $2',
    [passwordHash, userId]
  );
}
