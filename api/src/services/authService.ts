import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool';
import type { UserProfile } from '../types';

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
  };
}

export async function register(email: string, password: string, firstName: string, lastName: string) {
  const existing = await pool.query(
    'SELECT login_id FROM dw_user WHERE email = $1',
    [email.toLowerCase()]
  );
  if (existing.rows.length > 0) {
    throw Object.assign(new Error('Email already registered'), { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const { rows } = await pool.query(
    `INSERT INTO dw_user (email, password_hash, first_name, last_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [email.toLowerCase(), passwordHash, firstName, lastName]
  );

  const user = rowToUser(rows[0]);
  const token = makeToken(user.id);
  return { token, user };
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

  console.log(`[DEV] Reset token for ${email}: ${resetToken}`);
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
