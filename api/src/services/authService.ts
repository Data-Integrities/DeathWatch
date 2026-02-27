import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool';
import type { UserProfile } from '../types';
import { sendWelcomeEmail, sendVerificationEmail, sendPasswordResetEmail } from './emailService';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SALT_ROUNDS = 10;

function makeToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function rowToUser(row: any): UserProfile {
  return {
    id: row.login_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    isAdmin: row.is_admin || false,
    emailVerified: row.email_verified || false,
  };
}

function generateVerificationToken(): { token: string; expires: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  return { token, expires };
}

export async function register(email: string, password: string, firstName: string, lastName: string) {
  const existing = await pool.query(
    'SELECT login_id FROM dw_user WHERE email = $1',
    [email.toLowerCase()]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('This email already has an account in ObitNOTE.'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { token: verificationToken, expires: verificationExpires } = generateVerificationToken();

  const { rows } = await pool.query(
    `INSERT INTO dw_user (email, password_hash, first_name, last_name, verification_token, verification_token_expires)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [email.toLowerCase(), passwordHash, firstName, lastName, verificationToken, verificationExpires]
  );

  const user = rowToUser(rows[0]);
  const jwtToken = makeToken(user.id);

  // Send single welcome+verification email (don't block registration on email failure)
  sendWelcomeEmail(email, firstName, verificationToken).catch(err => console.error('[Auth] Welcome email failed:', err));

  return { token: jwtToken, user };
}

export async function login(email: string, password: string) {
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

  const user = rowToUser(row);
  const token = makeToken(user.id);
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
  return rowToUser(rows[0]);
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
