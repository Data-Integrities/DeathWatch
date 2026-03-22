import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { adminAuth } from '../middleware/adminAuth';
import { getRecentActivity, getUsersSummary } from '../services/activityService';
import { getMessages, replyToMessage, markMessageRead, getUnrepliedMessageCount } from '../services/messageService';
import { sendReplyNotification } from '../services/emailService';
import { sendReplySms } from '../services/smsService';
import { pool } from '../db/pool';
import { impersonate } from '../services/authService';

const VALID_PLAN_CODES = ['PLAN_10', 'PLAN_25', 'PLAN_50', 'PLAN_100', 'PLAN_CUSTOM'] as const;

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
    const { planCode, subscriptionActive, tierCustomCap } = req.body;

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
      [planCode ?? null, subscriptionActive ?? null, id, tierCustomCap !== undefined ? (tierCustomCap ?? null) : null]
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
    const today = new Date();
    const startOfDay = today.toISOString().slice(0, 10);
    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM error_log WHERE created_at >= $1::date`,
      [startOfDay]
    );
    res.json({ count: Number(rows[0].count) });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
