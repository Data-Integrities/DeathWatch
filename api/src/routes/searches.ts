import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import * as searchService from '../services/searchService';
import { logActivity, buildFingerprint } from '../services/activityService';
import { sendMatchNotification } from '../services/emailService';
import { sendMatchSms } from '../services/smsService';
import { pool } from '../db/pool';

const PLAN_LIMITS: Record<string, { limit: number; grace: number }> = {
  PLAN_5:      { limit: 5,  grace: 6 },
  PLAN_10:     { limit: 10, grace: 11 },
  PLAN_PREMIUM: { limit: 9999, grace: 9999 },
};

const router = Router();
router.use(authMiddleware);

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const searchCreateSchema = z.object({
  nameLast: z.string().nullable().default(null),
  nameFirst: z.string().nullable().default(null),
  nameNickname: z.string().nullable().default(null),
  nameMiddle: z.string().nullable().default(null),
  nameMaiden: z.string().nullable().default(null),
  ageApx: z.number().int().min(0, 'Approximate age is required').max(150),
  city: z.string().nullable().default(null),
  state: z.string().length(2).refine(s => US_STATES.includes(s.toUpperCase()), 'Invalid state code').nullable().default(null),
  keyWords: z.string().nullable().default(null),
}).refine(d => d.nameFirst || d.nameNickname, {
  message: 'Either first name or nickname is required',
  path: ['nameFirst'],
}).refine(d => d.nameLast || d.nameMaiden, {
  message: 'Last name or maiden name is required',
  path: ['nameLast'],
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const searches = await searchService.listSearches(req.userId!);
    res.json({ searches });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    // Subscription + plan limit gate
    const { rows: userRows } = await pool.query(
      'SELECT subscription_active, plan_code, tier_custom_cap, using_grace_slot FROM dw_user WHERE login_id = $1',
      [req.userId!]
    );
    if (userRows.length === 0) {
      res.status(403).json({ error: 'User not found.' });
      return;
    }
    const userRow = userRows[0];
    if (!userRow.subscription_active) {
      res.status(403).json({ error: 'Subscription required to create monitored searches.' });
      return;
    }

    // Count active searches (not confirmed — confirmed searches don't count against the limit)
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM user_query WHERE login_id = $1 AND confirmed = false',
      [req.userId!]
    );
    const activeCount = countRows[0].cnt;

    const planCode = userRow.plan_code;
    const plan = planCode ? PLAN_LIMITS[planCode] : null;
    const planLimit = plan ? plan.limit : (userRow.tier_custom_cap || 0);
    const graceLimit = plan ? plan.grace : (userRow.tier_custom_cap ? userRow.tier_custom_cap + 1 : 0);

    if (activeCount >= graceLimit) {
      res.status(403).json({
        error: 'You\'ve reached your plan limit.  Please upgrade to monitor more people.',
        code: 'PLAN_LIMIT_REACHED',
        activeCount,
        planLimit,
      });
      return;
    }

    // Set grace slot flag if at the plan limit
    if (activeCount >= planLimit && !userRow.using_grace_slot) {
      await pool.query(
        'UPDATE dw_user SET using_grace_slot = true, updated_at = NOW() WHERE login_id = $1',
        [req.userId!]
      );
    }

    const data = searchCreateSchema.parse(req.body);
    const result = await searchService.createSearch(req.userId!, data);
    logActivity(req.userId!, 'New Search', buildFingerprint(data));

    // Send immediate notifications if matches found
    if (result.results && result.results.length > 0) {
      const { rows: uRows } = await pool.query(
        'SELECT email, phone_number, sms_opt_in FROM dw_user WHERE login_id = $1',
        [req.userId!]
      );
      if (uRows.length > 0) {
        sendMatchNotification(uRows[0].email).catch(err => console.error('[Search] Email notification failed:', err));
        if (uRows[0].sms_opt_in && uRows[0].phone_number) {
          sendMatchSms(uRows[0].phone_number).catch(err => console.error('[Search] SMS notification failed:', err));
        }
      }
    }

    const usingGraceSlot = activeCount >= planLimit;
    res.status(201).json({ ...result, usingGraceSlot, activeCount: activeCount + 1, planLimit });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const search = await searchService.getSearch(req.userId!, req.params.id);
    logActivity(req.userId!, 'Search', buildFingerprint(search));
    res.json({ search });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const result = await searchService.updateSearch(req.userId!, req.params.id, req.body);
    logActivity(req.userId!, 'Search Edit', buildFingerprint(result.search));
    res.json(result);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const search = await searchService.confirmSearch(req.userId!, req.params.id);
    res.json({ search });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/unconfirm', async (req: Request, res: Response) => {
  try {
    const search = await searchService.unconfirmSearch(req.userId!, req.params.id);
    res.json({ search });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/reject-all', async (req: Request, res: Response) => {
  try {
    await searchService.rejectAllResults(req.userId!, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const search = await searchService.getSearch(req.userId!, req.params.id);
    await searchService.deleteSearch(req.userId!, req.params.id);
    logActivity(req.userId!, 'Search Delete', buildFingerprint(search));
    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
