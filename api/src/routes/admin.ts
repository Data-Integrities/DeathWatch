import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { getRecentActivity, getUsersSummary } from '../services/activityService';
import { getMessages, replyToMessage, markMessageRead, getUnrepliedMessageCount } from '../services/messageService';
import { sendReplyNotification } from '../services/emailService';
import { sendReplySms } from '../services/smsService';
import { pool } from '../db/pool';
import { impersonate } from '../services/authService';
import { normalizePhone } from '../utils/phone';
import { v4 as uuidv4 } from 'uuid';
import { syncSubscriptionQuantity } from '../services/paddleService';
import { getPageHitSummary, getTrackedPages } from '../services/pageHitService';

const VALID_PLAN_CODES = ['PLAN_5', 'PLAN_10', 'PLAN_CUSTOM'] as const;

const router = Router();
router.use(authMiddleware);
router.use(adminAuth);

router.get('/activity', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = (req.query.startDate as string) || yesterday.toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || today.toISOString().slice(0, 10);
    const activity = await getRecentActivity(startDate, endDate);
    res.json({ activity });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/users', async (_req: Request, res: Response) => {
  try {
    const users = await getUsersSummary();
    res.json({ users });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/messages/unreplied-count', async (_req: Request, res: Response) => {
  try {
    const count = await getUnrepliedMessageCount();
    res.json({ count });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/messages', async (_req: Request, res: Response) => {
  try {
    const messages = await getMessages();
    res.json({ messages });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/messages/:id/reply', async (req: Request, res: Response) => {
  try {
    const { replyText } = req.body;
    if (!replyText || !replyText.trim()) {
      res.status(400).json({ error: 'Reply text is required' });
      return;
    }
    const result = await replyToMessage(req.params.id, req.userId!, replyText.trim());
    await sendReplyNotification(result.senderEmail, result.senderFirstName, result.ticketId);
    if (result.senderSmsOptIn && result.senderPhone) {
      await sendReplySms(result.senderPhone);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/messages/:id/read', async (req: Request, res: Response) => {
  try {
    await markMessageRead(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/users/:id/impersonate', async (req: Request, res: Response) => {
  try {
    const result = await impersonate(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/users/:id/subscription', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { planCode, subscriptionActive, tierCustomCap, proGrid } = req.body;

    // Validate user exists
    const { rows } = await pool.query('SELECT login_id FROM dw_user WHERE login_id = $1', [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Validate plan code if provided
    if (planCode !== undefined && planCode !== null && !VALID_PLAN_CODES.includes(planCode)) {
      res.status(400).json({ error: 'Invalid plan code' });
      return;
    }

    // Build update — activating sets plan_start_date if not already set
    const isActivating = subscriptionActive === true;
    const isDeactivating = subscriptionActive === false;

    await pool.query(
      `UPDATE dw_user SET
        plan_code = COALESCE($1, plan_code),
        subscription_active = COALESCE($2, subscription_active),
        tier_custom_cap = $4,
        pro_grid = COALESCE($5, pro_grid),
        plan_start_date = CASE
          WHEN $2 = true AND plan_start_date IS NULL THEN CURRENT_DATE
          WHEN $2 = false THEN NULL
          ELSE plan_start_date
        END,
        plan_renewal_date = CASE
          WHEN $2 = true AND plan_renewal_date IS NULL THEN (CURRENT_DATE + INTERVAL '1 year')::date
          WHEN $2 = false THEN NULL
          ELSE plan_renewal_date
        END,
        using_grace_slot = CASE WHEN $2 = false THEN false ELSE using_grace_slot END,
        updated_at = NOW()
      WHERE login_id = $3`,
      [planCode ?? null, subscriptionActive ?? null, id, tierCustomCap !== undefined ? (tierCustomCap ?? null) : null, proGrid ?? null]
    );

    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/users/:id/reset-trials', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT login_id FROM dw_user WHERE login_id = $1', [id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    await pool.query('UPDATE dw_user SET trial_searches_used = 0, updated_at = NOW() WHERE login_id = $1', [id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/errors', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = (req.query.startDate as string) || weekAgo.toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || today.toISOString().slice(0, 10);

    const { rows } = await pool.query(
      `SELECT e.id, e.login_id, e.error_message, e.page, e.user_agent, e.created_at,
              u.first_name, u.last_name, u.email
       FROM error_log e
       LEFT JOIN dw_user u ON u.login_id = e.login_id
       WHERE e.created_at >= $1::date AND e.created_at < ($2::date + interval '1 day')
       ORDER BY e.created_at DESC
       LIMIT 500`,
      [startDate, endDate]
    );

    const errors = rows.map(row => ({
      id: row.id,
      loginId: row.login_id || null,
      userName: row.first_name ? `${row.first_name} ${row.last_name}` : 'Unknown',
      email: row.email || '',
      errorMessage: row.error_message,
      page: row.page || '',
      userAgent: row.user_agent || '',
      createdAt: row.created_at?.toISOString?.() || row.created_at || '',
    }));

    res.json({ errors });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/errors/count', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count, MAX(created_at) AS latest
       FROM error_log WHERE created_at >= CURRENT_DATE`
    );
    res.json({ count: rows[0].count, latest: rows[0].latest });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Support Staff (On-Call) ---

router.get('/support-staff', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, phone_number, is_on_call, created_at FROM support_staff ORDER BY name',
    );
    res.json({ staff: rows.map(r => ({ id: r.id, name: r.name, phoneNumber: r.phone_number, isOnCall: r.is_on_call, createdAt: r.created_at })) });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/support-staff', async (req: Request, res: Response) => {
  try {
    const { name, phoneNumber } = req.body;
    if (!name?.trim() || !phoneNumber?.trim()) {
      res.status(400).json({ error: 'Name and phone number are required.' });
      return;
    }
    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      res.status(400).json({ error: 'Invalid phone number.' });
      return;
    }
    const { rows } = await pool.query(
      'INSERT INTO support_staff (name, phone_number) VALUES ($1, $2) RETURNING id',
      [name.trim(), normalized],
    );
    res.status(201).json({ id: rows[0].id });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/support-staff/:id', async (req: Request, res: Response) => {
  try {
    const { name, phoneNumber } = req.body;
    if (!name?.trim() || !phoneNumber?.trim()) {
      res.status(400).json({ error: 'Name and phone number are required.' });
      return;
    }
    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      res.status(400).json({ error: 'Invalid phone number.' });
      return;
    }
    await pool.query(
      'UPDATE support_staff SET name = $1, phone_number = $2 WHERE id = $3',
      [name.trim(), normalized, req.params.id],
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/support-staff/:id', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query('SELECT is_on_call FROM support_staff WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      res.status(404).json({ error: 'Staff member not found.' });
      return;
    }
    if (rows[0].is_on_call) {
      res.status(400).json({ error: 'Can\'t delete the Support Chief on Call.  Assign someone else first.' });
      return;
    }
    await pool.query('DELETE FROM support_staff WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/support-staff/:id/on-call', async (req: Request, res: Response) => {
  try {
    await pool.query('UPDATE support_staff SET is_on_call = false');
    await pool.query('UPDATE support_staff SET is_on_call = true WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Fatal Errors ---

router.get('/fatal-errors', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = (req.query.startDate as string) || weekAgo.toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || today.toISOString().slice(0, 10);

    const { rows } = await pool.query(
      `SELECT id, source, error_code, message, staff_name, sms_sent, rate_limited, created_at
       FROM fatal_error
       WHERE created_at >= $1::date AND created_at < ($2::date + interval '1 day')
       ORDER BY created_at DESC
       LIMIT 500`,
      [startDate, endDate],
    );
    res.json({
      errors: rows.map(r => ({
        id: r.id,
        source: r.source,
        errorCode: r.error_code,
        message: r.message,
        staffName: r.staff_name,
        smsSent: r.sms_sent,
        rateLimited: r.rate_limited,
        createdAt: r.created_at?.toISOString?.() || r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/fatal-errors/count', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS count FROM fatal_error WHERE created_at >= CURRENT_DATE`,
    );
    res.json({ count: rows[0].count });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ── Import routes ──────────────────────────────────────────────────────

interface ImportRow {
  nameFirst: string | null;
  nameLast: string | null;
  nameMiddle: string | null;
  nameMaiden: string | null;
  nameNickname: string | null;
  ageApx: number | null;
  city: string | null;
  state: string | null;
  keyWords: string | null;
}

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { userId, rows } = req.body as { userId: string; rows: ImportRow[] };
    if (!userId || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'userId and non-empty rows array required.' });
    }

    const userCheck = await pool.query('SELECT login_id FROM dw_user WHERE login_id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const batchId = new Date().toISOString();

    const existingResult = await pool.query(
      'SELECT name_first, name_last, city FROM user_query WHERE login_id = $1',
      [userId]
    );
    const existingSet = new Set(
      existingResult.rows.map((r: any) =>
        `${(r.name_first || '').toLowerCase()}|${(r.name_last || '').toLowerCase()}|${(r.city || '').toLowerCase()}`
      )
    );

    let inserted = 0;
    let skippedDupes = 0;
    let skippedInvalid = 0;
    const dupeNames: string[] = [];

    for (const row of rows) {
      const hasName = row.nameFirst && (row.nameLast || row.nameMaiden);
      if (!hasName || !row.city || !row.state || row.ageApx == null) {
        skippedInvalid++;
        continue;
      }

      const key = `${(row.nameFirst || '').toLowerCase()}|${(row.nameLast || '').toLowerCase()}|${(row.city || '').toLowerCase()}`;
      if (existingSet.has(key)) {
        skippedDupes++;
        dupeNames.push([row.nameFirst, row.nameLast].filter(Boolean).join(' '));
        continue;
      }

      const id = uuidv4();
      await pool.query(
        `INSERT INTO user_query (id, login_id, name_first, name_last, name_middle, name_maiden, name_nickname, age_apx, city, state, key_words, disabled, import_batch_id, committed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false, $12, NOW())`,
        [id, userId, row.nameFirst, row.nameLast, row.nameMiddle, row.nameMaiden, row.nameNickname, row.ageApx, row.city, row.state, row.keyWords, batchId]
      );
      existingSet.add(key);
      inserted++;
    }

    if (inserted > 0) {
      syncSubscriptionQuantity(userId).catch(err => console.error('[Admin] Sync quantity after import failed:', err.message));
    }
    res.json({ success: true, inserted, skippedDupes, skippedInvalid, dupeNames: dupeNames.slice(0, 20), batchId });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/import/batches', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const where = userId ? 'AND login_id = $1' : '';
    const params = userId ? [userId] : [];
    const { rows } = await pool.query(
      `SELECT import_batch_id, login_id, COUNT(*)::int AS row_count,
              MIN(name_first || ' ' || name_last) AS sample_name
       FROM user_query
       WHERE import_batch_id IS NOT NULL ${where}
       GROUP BY import_batch_id, login_id
       ORDER BY import_batch_id DESC`,
      params
    );
    res.json({ batches: rows.map((r: any) => ({
      batchId: r.import_batch_id,
      loginId: r.login_id,
      rowCount: r.row_count,
      sampleName: r.sample_name,
    }))});
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/import/batches/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { rows: batchRows } = await pool.query(
      'SELECT DISTINCT login_id FROM user_query WHERE import_batch_id = $1',
      [batchId]
    );
    const result = await pool.query(
      'DELETE FROM user_query WHERE import_batch_id = $1',
      [batchId]
    );
    for (const row of batchRows) {
      syncSubscriptionQuantity(row.login_id).catch(err => console.error('[Admin] Sync quantity after batch delete failed:', err.message));
    }
    res.json({ success: true, deleted: result.rowCount });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/import/users', async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT login_id, email, first_name, last_name
       FROM dw_user
       WHERE pro_grid = true
       ORDER BY email`
    );
    res.json({ users: rows.map((r: any) => ({
      id: r.login_id,
      email: r.email,
      nameFirst: r.first_name,
      nameLast: r.last_name,
    }))});
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/import/searches', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId required.' });
    const { rows } = await pool.query(
      'SELECT name_first, name_last, city FROM user_query WHERE login_id = $1',
      [userId]
    );
    res.json({ searches: rows.map((r: any) => ({
      nameFirst: r.name_first,
      nameLast: r.name_last,
      city: r.city,
    }))});
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// --- Page Hits ---

router.get('/page-hits', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startDate = (req.query.startDate as string) || weekAgo.toISOString().slice(0, 10);
    const endDate = (req.query.endDate as string) || today.toISOString().slice(0, 10);
    const page = (req.query.page as string) || undefined;
    const summary = await getPageHitSummary(startDate, endDate, page);
    res.json({ summary });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/page-hits/pages', async (_req: Request, res: Response) => {
  try {
    const pages = await getTrackedPages();
    res.json({ pages });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
