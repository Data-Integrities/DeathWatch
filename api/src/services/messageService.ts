import { pool } from '../db/pool';
import { logActivity } from './activityService';

const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

async function generateTicketId(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
    }
    const { rows } = await pool.query(
      'SELECT 1 FROM support_message WHERE ticket_id = $1',
      [id]
    );
    if (rows.length === 0) return id;
  }
  throw new Error('Failed to generate unique ticket ID');
}

export async function createMessage(loginId: string, subject: string, body: string) {
  const ticketId = await generateTicketId();
  const { rows } = await pool.query(
    `INSERT INTO support_message (login_id, subject, body, ticket_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, ticket_id, created_at`,
    [loginId, subject, body, ticketId]
  );
  logActivity(loginId, 'Message', subject || '(no subject)');
  return { id: rows[0].id, ticketId: rows[0].ticket_id, createdAt: rows[0].created_at };
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
  ticketId: string;
}

export async function getMessages(): Promise<MessageRow[]> {
  const { rows } = await pool.query(
    `SELECT sm.id, sm.login_id, u.first_name, u.last_name, u.email,
            sm.subject, sm.body, sm.status, sm.admin_reply, sm.replied_at, sm.created_at, sm.ticket_id
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
    ticketId: r.ticket_id,
  }));
}

export interface UserMessageRow {
  id: string;
  ticketId: string;
  subject: string;
  body: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  replyReadAt: string | null;
  createdAt: string;
}

export async function getUserMessages(loginId: string): Promise<UserMessageRow[]> {
  const { rows } = await pool.query(
    `SELECT id, ticket_id, subject, body, status, admin_reply, replied_at, reply_read_at, created_at
     FROM support_message
     WHERE login_id = $1
     ORDER BY created_at DESC`,
    [loginId]
  );

  return rows.map(r => ({
    id: r.id,
    ticketId: r.ticket_id,
    subject: r.subject,
    body: r.body,
    status: r.status,
    adminReply: r.admin_reply,
    repliedAt: r.replied_at?.toISOString?.() || r.replied_at || null,
    replyReadAt: r.reply_read_at?.toISOString?.() || r.reply_read_at || null,
    createdAt: r.created_at?.toISOString?.() || r.created_at || '',
  }));
}

export async function markReplyRead(messageId: string, loginId: string) {
  const result = await pool.query(
    `UPDATE support_message
     SET reply_read_at = NOW()
     WHERE id = $1 AND login_id = $2 AND status = 'replied' AND reply_read_at IS NULL`,
    [messageId, loginId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function getUnreadReplyCount(loginId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM support_message
     WHERE login_id = $1 AND status = 'replied' AND reply_read_at IS NULL`,
    [loginId]
  );
  return rows[0].count;
}

export async function replyToMessage(messageId: string, adminLoginId: string, replyText: string) {
  const { rows } = await pool.query(
    `UPDATE support_message
     SET admin_reply = $1, replied_at = NOW(), replied_by = $2, status = 'replied', reply_read_at = NULL
     WHERE id = $3
     RETURNING login_id, subject, body, ticket_id`,
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
    ticketId: rows[0].ticket_id,
  };
}

export async function getUnrepliedMessageCount(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM support_message WHERE status != 'replied'`
  );
  return rows[0].count;
}

export async function markMessageRead(messageId: string) {
  await pool.query(
    `UPDATE support_message SET status = 'read' WHERE id = $1 AND status = 'unread'`,
    [messageId]
  );
}
