import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { pool } from '../db/pool';
import { reportFatalError } from '../services/fatalErrorService';

const router = Router();

const PADDLE_WEBHOOK_SECRET = process.env.PADDLE_WEBHOOK_SECRET || '';
if (process.env.NODE_ENV === 'production' && !PADDLE_WEBHOOK_SECRET) {
  console.error('[FATAL] PADDLE_WEBHOOK_SECRET is required in production');
  process.exit(1);
}

function verifyPaddleSignature(rawBody: string, signatureHeader: string): boolean {
  const parts = signatureHeader.split(';');
  let ts = '';
  let h1 = '';
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    const value = rest.join('=');
    if (key === 'ts') ts = value;
    else if (key === 'h1') h1 = value;
  }
  if (!ts || !h1) return false;

  // Allow 5-minute tolerance for clock drift
  const tsNum = parseInt(ts, 10);
  if (Date.now() > (tsNum + 300) * 1000) return false;

  const payload = `${ts}:${rawBody}`;
  const hmac = createHmac('sha256', PADDLE_WEBHOOK_SECRET);
  hmac.update(payload);
  const computed = hmac.digest('hex');

  if (computed.length !== h1.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(h1));
}

router.post('/paddle', async (req: Request, res: Response) => {
  const signature = (req.headers['paddle-signature'] as string) || '';
  const rawBody = (req as any).rawBody as string;

  if (!rawBody || !signature) {
    console.error('[Webhook] Missing body or signature');
    res.status(400).json({ error: 'Missing body or signature' });
    return;
  }

  if (!verifyPaddleSignature(rawBody, signature)) {
    console.error('[Webhook] Invalid signature');
    reportFatalError('paddle', '401', 'Paddle webhook signature verification failed').catch(() => {});
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const event = JSON.parse(rawBody);
  const eventType = event.event_type;
  const data = event.data;

  console.log(`[Webhook] Paddle event: ${eventType}`);

  try {
    switch (eventType) {
      case 'subscription.created':
      case 'subscription.activated': {
        const userId = data.custom_data?.userId;
        const subscriptionId = data.id;
        const planCode = mapItemsToPlan(data.items);
        const startDate = data.started_at ? data.started_at.slice(0, 10) : null;
        const renewalDate = data.next_billed_at ? data.next_billed_at.slice(0, 10) : null;

        if (!userId) {
          console.error('[Webhook] No userId in custom_data');
          break;
        }

        await pool.query(
          `UPDATE dw_user
           SET subscription_active = true,
               paddle_subscription_id = $1,
               plan_code = $2,
               plan_start_date = $3,
               plan_renewal_date = $4,
               updated_at = NOW()
           WHERE login_id = $5`,
          [subscriptionId, planCode, startDate, renewalDate, userId]
        );
        console.log(`[Webhook] Activated subscription for user ${userId}, plan ${planCode}`);
        break;
      }

      case 'subscription.updated': {
        const subscriptionId = data.id;
        const status = data.status;
        const planCode = mapItemsToPlan(data.items);
        const renewalDate = data.next_billed_at ? data.next_billed_at.slice(0, 10) : null;
        const isActive = status === 'active' || status === 'trialing';

        await pool.query(
          `UPDATE dw_user
           SET subscription_active = $1,
               plan_code = $2,
               plan_renewal_date = $3,
               updated_at = NOW()
           WHERE paddle_subscription_id = $4`,
          [isActive, planCode, renewalDate, subscriptionId]
        );
        console.log(`[Webhook] Updated subscription ${subscriptionId}, active=${isActive}, plan=${planCode}`);
        break;
      }

      case 'subscription.canceled': {
        const subscriptionId = data.id;

        await pool.query(
          `UPDATE dw_user
           SET subscription_active = false,
               plan_renewal_date = NULL,
               updated_at = NOW()
           WHERE paddle_subscription_id = $1`,
          [subscriptionId]
        );
        console.log(`[Webhook] Canceled subscription ${subscriptionId}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event: ${eventType}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[Webhook] Processing error:', err.message);
    reportFatalError('paddle', '500', `Paddle webhook processing failed: ${err.message}`).catch(() => {});
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Map Paddle price IDs to plan tier codes
function mapItemsToPlan(items: any[]): string | null {
  if (!items || items.length === 0) return null;
  const priceIds = items.map((i: any) => i.price?.id);
  // Production price IDs
  if (priceIds.includes('pri_01krhmxw12mseqdjbj7napcaya')) return 'PLAN_10';
  if (priceIds.includes('pri_01krhq4c78j0c0d0gvhasxp2p0')) return 'PLAN_5';
  // Legacy sandbox price IDs
  if (priceIds.includes('pri_01kps36xd3r6dbmwcwrk9z16sk')) return 'PLAN_10';
  if (priceIds.includes('pri_01kppf909cxfhkha763dakw7vh')) return 'PLAN_10';
  if (priceIds.includes('pri_01kppcr7dpr63g3j9y1wf9hd29')) return 'PLAN_5';
  if (priceIds.includes('pri_01kppcrkwcpz1rz7m1hsht15wt')) return 'PLAN_10';
  if (priceIds.includes('pri_01kppcs2qh0hhpkqtm3yj47kkf')) return 'PLAN_10';
  return null;
}

export default router;
