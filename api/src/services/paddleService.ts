import { pool } from '../db/pool';
import { reportFatalError } from './fatalErrorService';

const PADDLE_API_KEY = process.env.PADDLE_API_KEY || '';
const PADDLE_API_URL = PADDLE_API_KEY.startsWith('pdl_sdbx_')
  ? 'https://sandbox-api.paddle.com'
  : 'https://api.paddle.com';

const BASIC_PRICE_ID = 'pri_01kppcr7dpr63g3j9y1wf9hd29';
const PLUS_BASE_PRICE_ID = 'pri_01kps36xd3r6dbmwcwrk9z16sk';
const PLUS_PER_PERSON_PRICE_ID = 'pri_01kppf909cxfhkha763dakw7vh';
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
 * Handles Basic→Plus swap and per-person quantity in a single API call.
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
  const extraPeople = Math.max(0, activeCount - BASIC_LIMIT);

  const sub = await paddleApi('GET', `/subscriptions/${paddle_subscription_id}`);
  const items = sub.data.items || [];

  const basicItem = items.find((i: any) => i.price?.id === BASIC_PRICE_ID);
  const plusBaseItem = items.find((i: any) => i.price?.id === PLUS_BASE_PRICE_ID);
  const perPersonItem = items.find((i: any) => i.price?.id === PLUS_PER_PERSON_PRICE_ID);

  const updatedItems: any[] = [];

  if (extraPeople > 0) {
    // Need Plus base + per-person
    if (plusBaseItem) {
      updatedItems.push({ id: plusBaseItem.id, price_id: PLUS_BASE_PRICE_ID, quantity: 1 });
    } else if (basicItem) {
      updatedItems.push({ id: basicItem.id, price_id: PLUS_BASE_PRICE_ID, quantity: 1 });
    } else {
      updatedItems.push({ price_id: PLUS_BASE_PRICE_ID, quantity: 1 });
    }

    if (perPersonItem) {
      updatedItems.push({ id: perPersonItem.id, price_id: PLUS_PER_PERSON_PRICE_ID, quantity: extraPeople });
    } else {
      updatedItems.push({ price_id: PLUS_PER_PERSON_PRICE_ID, quantity: extraPeople });
    }
  } else {
    // 5 or fewer — need Basic only
    if (basicItem) {
      updatedItems.push({ id: basicItem.id, price_id: BASIC_PRICE_ID, quantity: 1 });
    } else if (plusBaseItem) {
      updatedItems.push({ id: plusBaseItem.id, price_id: BASIC_PRICE_ID, quantity: 1 });
    } else {
      updatedItems.push({ price_id: BASIC_PRICE_ID, quantity: 1 });
    }
    // Omit per-person item to remove it
  }

  // Check if anything actually changed
  const currentBasePriceId = (basicItem || plusBaseItem)?.price?.id;
  const targetBasePriceId = extraPeople > 0 ? PLUS_BASE_PRICE_ID : BASIC_PRICE_ID;
  const currentPerPersonQty = perPersonItem?.quantity || 0;
  const needsUpdate = currentBasePriceId !== targetBasePriceId || currentPerPersonQty !== extraPeople;

  if (needsUpdate) {
    await paddleApi('PATCH', `/subscriptions/${paddle_subscription_id}`, {
      items: updatedItems,
      proration_billing_mode: 'prorated_immediately',
    });
    console.log(`[Paddle] Committed billing for user ${userId}: ${extraPeople} extra people`);
  }

  // Update plan_code in DB
  const newPlanCode = extraPeople > 0 ? 'PLAN_10' : 'PLAN_5';
  await pool.query(
    `UPDATE dw_user SET plan_code = $1, updated_at = NOW() WHERE login_id = $2`,
    [newPlanCode, userId]
  );

  // Mark all uncommitted searches as committed
  await pool.query(
    `UPDATE user_query SET committed_at = NOW() WHERE login_id = $1 AND committed_at IS NULL`,
    [userId]
  );

  console.log(`[Paddle] All searches committed for user ${userId}, plan ${newPlanCode}`);
}
