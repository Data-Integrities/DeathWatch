import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { sendErrorAlert } from '../services/emailService';
import { sendErrorAlertSms } from '../services/smsService';
import { pool } from '../db/pool';

const ADMIN_PHONE = process.env.ADMIN_PHONE || '+19044770311';

const router = Router();

const errorSchema = z.object({
  error: z.string().min(1),
  page: z.string().optional(),
  userAgent: z.string().optional(),
});

router.post('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const data = errorSchema.parse(req.body);

    // Look up user info
    let userEmail = 'Unknown';
    let userName = 'Unknown';
    if (req.userId) {
      const { rows } = await pool.query(
        'SELECT email, first_name, last_name FROM dw_user WHERE login_id = $1',
        [req.userId]
      );
      if (rows.length > 0) {
        userEmail = rows[0].email;
        userName = `${rows[0].first_name} ${rows[0].last_name}`;
      }
    }

    const details = {
      error: data.error,
      page: data.page,
      userAgent: data.userAgent,
      userEmail,
      userName,
      timestamp: new Date().toISOString(),
    };

    // Send email and SMS notifications (non-blocking)
    sendErrorAlert(details).catch(err => console.error('[ErrorReport] Email failed:', err));
    sendErrorAlertSms(ADMIN_PHONE, `${data.error} | User: ${userEmail} | Page: ${data.page || 'Unknown'}`).catch(err => console.error('[ErrorReport] SMS failed:', err));

    console.error(`[ErrorReport] ${data.error} | User: ${userEmail} | Page: ${data.page}`);
    res.json({ received: true });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(500).json({ error: 'Failed to process error report' });
  }
});

export default router;
