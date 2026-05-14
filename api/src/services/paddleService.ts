import { pool } from '../db/pool';
import { reportFatalError } from './fatalErrorService';

const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
const PADDLE_API_URL = PADDLE_API_KEY.startsWith('pdl_sdbx_')
  ? 'https://sandbox-api.paddle.com'
  : 'https://api.paddle.com';

const BASIC_PRICE_ID = 'pri_01krhq4c78j0c0d0gvhasxp2p0';
const PLUS_PRICE_ID = 'pri_01krhmxw12mseqdjbj7napcaya';
const BASIC_LIMIT = 5;

export async function paddleApi(method: string, path: string, body?: any) {
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
    reportFatalError('paddle', String(res.status), `Paddle API ${method} ${path} failed: ${msg}`).catch(() => {});
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

/**
 * Commit all uncommitted searches and update Paddle subscription.
 * Basic = $20/yr flat (1-5 people), Plus = $4/yr per person (6+ people).
 * Handles Basic→Plus auto-upgrade in a single Paddle API call.
 */
export async function commitBilling(userId: string): Promise<void> {
  const { rows: userRows } = await pool.query(
    'SELECT plan_code, paddle_subscription_id FROM dw_user WHERE login_id = $1',
    [userId]
  );
  if (userRows.length === 0) throw Object.assign(new Error('User not found'), { status: 404 });

  const { paddle_subscription_id } = userRows[0];
  if (!paddle_subscription_id) throw Object.assign(new Error('No active subscription'), { status: 400 });

  const { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM user_query WHERE login_id = $1 AND disabled = false AND confirmed = false`,
    [userId]
  );
  const activeCount = countRows[0].cnt;

  const sub = await paddleApi('GET', `/subscriptions/${paddle_subscription_id}`);
  const items = sub.data.items || [];
  const currentItem = items[0];
  if (!currentItem) throw Object.assign(new Error('No subscription items found'), { status: 500 });

  let needsUpdate = false;
  let updatedItems: any[];
  let newPlanCode: string;

  if (activeCount > BASIC_LIMIT) {
    // Plus: $4/person, quantity = total active people
    newPlanCode = 'PLAN_10';
    updatedItems = [{ id: currentItem.id, price_id: PLUS_PRICE_ID, quantity: activeCount }];
    needsUpdate = currentItem.price?.id !== PLUS_PRICE_ID || currentItem.quantity !== activeCount;
  } else {
    // Basic: $20 flat
    newPlanCode = 'PLAN_5';
    updatedItems = [{ id: currentItem.id, price_id: BASIC_PRICE_ID, quantity: 1 }];
    needsUpdate = currentItem.price?.id !== BASIC_PRICE_ID;
  }

  if (needsUpdate) {
    await paddleApi('PATCH', `/subscriptions/${paddle_subscription_id}`, {
      items: updatedItems,
      proration_billing_mode: 'prorated_immediately',
    });
    console.log(`[Paddle] Updated subscription for user ${userId}: ${activeCount} people, plan ${newPlanCode}`);
  }

  await pool.query(
    `UPDATE dw_user SET plan_code = $1, updated_at = NOW() WHERE login_id = $2`,
    [newPlanCode, userId]
  );

  await pool.query(
    `UPDATE user_query SET committed_at = NOW() WHERE login_id = $1 AND committed_at IS NULL`,
    [userId]
  );

  console.log(`[Paddle] All searches committed for user ${userId}, plan ${newPlanCode}`);
}
