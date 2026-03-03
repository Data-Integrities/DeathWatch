import { pool } from '../db/pool';
import { logActivity } from './activityService';

export async function createMessage(loginId: string, subject: string, body: string) {
  const { rows } = await pool.query(
    `INSERT INTO support_message (login_id, subject, body)
     VALUES ($1, $2, $3)
     RETURNING id, created_at`,
    [loginId, subject, body]
  );
  logActivity(loginId, 'Message', subject || '(no subject)');
  return rows[0];
}

export interface MessageRow {
  id: string;
  loginId: string;
  firstName: string;
  lastName: string;
  email: string;
  subject: string;
  body: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
}

export async function getMessages(): Promise<MessageRow[]> {
  const { rows } = await pool.query(
    `SELECT sm.id, sm.login_id, u.first_name, u.last_name, u.email,
            sm.subject, sm.body, sm.status, sm.admin_reply, sm.replied_at, sm.created_at
     FROM support_message sm
     JOIN dw_user u ON u.login_id = sm.login_id
     ORDER BY sm.created_at DESC`
  );

  return rows.map(r => ({
    id: r.id,
    loginId: r.login_id,
    firstName: r.first_name,
    lastName: r.last_name,
    email: r.email,
    subject: r.subject,
    body: r.body,
    status: r.status,
    adminReply: r.admin_reply,
    repliedAt: r.replied_at?.toISOString?.() || r.replied_at || null,
    createdAt: r.created_at?.toISOString?.() || r.created_at || '',
  }));
}

export async function replyToMessage(messageId: string, adminLoginId: string, replyText: string) {
  const { rows } = await pool.query(
    `UPDATE support_message
     SET admin_reply = $1, replied_at = NOW(), replied_by = $2, status = 'replied'
     WHERE id = $3
     RETURNING login_id, subject, body`,
    [replyText, adminLoginId, messageId]
  );

  if (rows.length === 0) {
    const err = new Error('Message not found') as any;
    err.status = 404;
    throw err;
  }

  // Get sender info for the email
  const { rows: userRows } = await pool.query(
    `SELECT email, first_name FROM dw_user WHERE login_id = $1`,
    [rows[0].login_id]
  );

  return {
    senderEmail: userRows[0]?.email,
    senderFirstName: userRows[0]?.first_name,
    subject: rows[0].subject,
    body: rows[0].body,
  };
}

export async function markMessageRead(messageId: string) {
  await pool.query(
    `UPDATE support_message SET status = 'read' WHERE id = $1 AND status = 'unread'`,
    [messageId]
  );
}
