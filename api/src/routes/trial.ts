import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { pool } from '../db/pool';
import { logActivity, buildFingerprint } from '../services/activityService';
import type { MatchResult, SearchQueryCreate } from '../types';

const SEARCH_ENGINE_URL = process.env.SEARCH_ENGINE_URL || 'http://localhost:3000';

const TRIAL_MAX = 3;

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; }
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const searchCreateSchema = z.object({
  nameLast: z.string().min(1, 'Last name is required'),
  nameFirst: z.string().nullable().default(null),
  nameNickname: z.string().nullable().default(null),
  nameMiddle: z.string().nullable().default(null),
  ageApx: z.number().int().min(0, 'Approximate age is required').max(150),
  city: z.string().nullable().default(null),
  state: z.string().length(2).refine(s => US_STATES.includes(s.toUpperCase()), 'Invalid state code').nullable().default(null),
  keyWords: z.string().nullable().default(null),
}).refine(d => d.nameFirst || d.nameNickname, {
  message: 'Either first name or nickname is required',
  path: ['nameFirst'],
});

const router = Router();
router.use(authMiddleware);

router.post('/search', async (req: Request, res: Response) => {
  try {
    // Check trial eligibility
    const { rows: userRows } = await pool.query(
      'SELECT trial_searches_used, subscription_active FROM dw_user WHERE login_id = $1',
      [req.userId!]
    );
    if (userRows.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const user = userRows[0];
    if (user.subscription_active) {
      res.status(400).json({ error: 'Subscribers do not need trial searches.' });
      return;
    }
    if (user.trial_searches_used >= TRIAL_MAX) {
      res.status(403).json({ error: 'All free trial searches have been used.' });
      return;
    }

    // Validate input
    const data = searchCreateSchema.parse(req.body);

    // Increment trial counter
    await pool.query(
      'UPDATE dw_user SET trial_searches_used = trial_searches_used + 1, updated_at = NOW() WHERE login_id = $1',
      [req.userId!]
    );

    // Call search engine
    const params = new URLSearchParams();
    params.set('lastName', data.nameLast);
    if (data.nameFirst) params.set('firstName', data.nameFirst);
    if (data.nameNickname) params.set('nickname', data.nameNickname);
    if (data.nameMiddle) params.set('middleName', data.nameMiddle);
    if (data.ageApx) params.set('age', data.ageApx.toString());
    if (data.city) params.set('city', data.city);
    if (data.state) params.set('state', data.state);
    if (data.keyWords) params.set('keyWords', data.keyWords);

    let results: MatchResult[] = [];
    const fingerprints: string[] = [];
    try {
      const resp = await fetch(`${SEARCH_ENGINE_URL}/search?${params.toString()}`);
      const json = await resp.json() as any;

      for (const r of json.results || []) {
        const domain = r.url ? extractDomain(r.url) : null;
        if (r.fingerprint) fingerprints.push(r.fingerprint);
        results.push({
          id: r.fingerprint || crypto.randomUUID(),
          userQueryId: '',
          sourceDomain: domain || '',
          fingerprint: r.fingerprint || null,
          scoreFinal: r.scoreFinal || 0,
          scoreMax: r.scoreMax || 0,
          rank: r.rank || 0,
          isRead: false,
          status: 'pending',
        });
      }
    } catch (err) {
      console.error('[Trial] Search engine call failed:', err);
    }

    // Store trial search for analysis
    const { rows: trialRows } = await pool.query(
      `INSERT INTO trial_search (login_id, name_last, name_first, name_nickname, name_middle, age_apx, city, state, key_words, result_count, result_fingerprints)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [req.userId!, data.nameLast, data.nameFirst, data.nameNickname, data.nameMiddle, data.ageApx, data.city, data.state, data.keyWords, results.length, JSON.stringify(fingerprints)]
    );

    logActivity(req.userId!, 'Trial Search', buildFingerprint(data));

    res.json({
      trialSearchId: trialRows[0].id,
      results,
      trialSearchesUsed: user.trial_searches_used + 1,
      trialSearchesMax: TRIAL_MAX,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: err.errors[0].message });
      return;
    }
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/:id/verdict', async (req: Request, res: Response) => {
  try {
    const { verdict } = req.body;
    if (!['right_person', 'wrong_person'].includes(verdict)) {
      res.status(400).json({ error: 'Invalid verdict. Must be right_person or wrong_person.' });
      return;
    }

    const { rowCount } = await pool.query(
      'UPDATE trial_search SET verdict = $1, verdict_at = NOW() WHERE id = $2 AND login_id = $3',
      [verdict, req.params.id, req.userId!]
    );

    if (rowCount === 0) {
      res.status(404).json({ error: 'Trial search not found' });
      return;
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

export default router;
