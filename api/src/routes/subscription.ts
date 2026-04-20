import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../db/pool';

const router = Router();
router.use(authMiddleware);

const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
const PADDLE_API_URL = PADDLE_API_KEY.startsWith('pdl_sdbx_')
  ? 'https://sandbox-api.paddle.com'
  : 'https://api.paddle.com';

const PLAN_PRICE_IDS: Record<string, string> = {
  PLAN_5:      'pri_01kppcr7dpr63g3j9y1wf9hd29',
  PLAN_10:     'pri_01kppcrkwcpz1rz7m1hsht15wt',
  PLAN_PREMIUM: 'pri_01kppcs2qh0hhpkqtm3yj47kkf',
};

const PREMIUM_PER_PERSON_PRICE_ID = 'pri_01kppf909cxfhkha763dakw7vh';

const PLAN_ORDER = ['PLAN_5', 'PLAN_10', 'PLAN_PREMIUM'];

async function paddleApi(method: string, path: string, body?: any) {
  const res = await fetch(`${PADDLE_API_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${PADDLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json();
  if (!res.ok) {
    const msg = json?.error?.detail || json?.error?.type || 'Paddle API error';
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

// Cancel subscription
router.post('/cancel', async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT paddle_subscription_id FROM dw_user WHERE login_id = $1',
      [req.userId!]
    );
    const subscriptionId = rows[0]?.paddle_subscription_id;
    if (!subscriptionId) {
      res.status(400).json({ error: 'No active subscription found.' });
      return;
    }

    await paddleApi('POST', `/subscriptions/${subscriptionId}/cancel`, {
      effective_from: 'immediately',
    });

    await pool.query(
      `UPDATE dw_user
       SET subscription_active = false, plan_renewal_date = NULL, updated_at = NOW()
       WHERE login_id = $1`,
      [req.userId!]
    );

    console.log(`[Subscription] Cancelled for user ${req.userId}`);
    res.json({ message: 'Subscription cancelled.' });
  } catch (err: any) {
    console.error('[Subscription] Cancel error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

// Change plan (upgrade or downgrade)
router.post('/change-plan', async (req: Request, res: Response) => {
  try {
    const { planCode } = req.body;
    if (!planCode || !PLAN_PRICE_IDS[planCode]) {
      res.status(400).json({ error: 'Invalid plan code.' });
      return;
    }

    const { rows } = await pool.query(
      'SELECT paddle_subscription_id, plan_code FROM dw_user WHERE login_id = $1',
      [req.userId!]
    );
    const subscriptionId = rows[0]?.paddle_subscription_id;
    const currentPlan = rows[0]?.plan_code;
    if (!subscriptionId) {
      res.status(400).json({ error: 'No active subscription found.' });
      return;
    }
    if (currentPlan === planCode) {
      res.status(400).json({ error: 'You\'re already on this plan.' });
      return;
    }

    const isUpgrade = PLAN_ORDER.indexOf(planCode) > PLAN_ORDER.indexOf(currentPlan);
    const newPriceId = PLAN_PRICE_IDS[planCode];

    // Get current subscription to find the existing item ID
    const sub = await paddleApi('GET', `/subscriptions/${subscriptionId}`);
    const currentItemId = sub.data.items?.[0]?.id;
    if (!currentItemId) {
      res.status(500).json({ error: 'Could not determine current subscription item.' });
      return;
    }

    const updateBody: any = {
      items: [{
        id: currentItemId,
        price_id: newPriceId,
        quantity: 1,
      }],
      proration_billing_mode: isUpgrade
        ? 'prorated_immediately'
        : 'prorated_next_billing_period',
    };

    await paddleApi('PATCH', `/subscriptions/${subscriptionId}`, updateBody);

    // For upgrades, update plan_code immediately (Paddle charges right away)
    // For downgrades, Paddle schedules the change at renewal -- webhook will update plan_code
    if (isUpgrade) {
      await pool.query(
        `UPDATE dw_user
         SET plan_code = $1, using_grace_slot = false, updated_at = NOW()
         WHERE login_id = $2`,
        [planCode, req.userId!]
      );
    }

    console.log(`[Subscription] ${isUpgrade ? 'Upgrade' : 'Downgrade'} to ${planCode} for user ${req.userId}`);
    res.json({
      message: isUpgrade
        ? 'Plan upgraded successfully.'
        : 'Plan change scheduled for your next renewal date.',
      planCode,
      isUpgrade,
    });
  } catch (err: any) {
    console.error('[Subscription] Change plan error:', err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
