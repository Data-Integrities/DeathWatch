import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';

const SEARCH_ENGINE_URL = process.env.SEARCH_ENGINE_URL || 'http://localhost:3000';

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; }
}

export async function runBatch() {
  const ranDt = new Date();
  console.log(`[Batch] Starting batch run at ${ranDt.toISOString()}`);

  // Load active queries that have no pending (unreviewed) results
  const { rows: queries } = await pool.query(
    `SELECT id, login_id, name_first, name_middle, name_last, name_nickname, age_apx, city, state, key_words, key_search
     FROM user_query uq
     WHERE uq.disabled = false
       AND uq.confirmed = false
       AND NOT EXISTS (
         SELECT 1 FROM user_result ur
         WHERE ur.user_query_id = uq.id AND ur.status = 'pending'
       )
     ORDER BY uq.name_last, uq.name_first`
  );

  console.log(`[Batch] Found ${queries.length} active queries`);
  let totalNewResults = 0;

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const label = `${q.name_first || q.name_nickname || ''} ${q.name_last || q.name_maiden || ''}`.trim();

    try {
      // Build search engine request
      const params = new URLSearchParams();
      if (q.name_last) params.set('lastName', q.name_last);
      if (q.name_first) params.set('firstName', q.name_first);
      if (q.name_nickname) params.set('nickname', q.name_nickname);
      if (q.name_middle) params.set('middleName', q.name_middle);
      if (q.name_maiden) params.set('maidenName', q.name_maiden);
      if (q.age_apx) params.set('age', q.age_apx.toString());
      if (q.city) params.set('city', q.city);
      if (q.state) params.set('state', q.state);
      if (q.key_words) params.set('keyWords', q.key_words);

      const resp = await fetch(`${SEARCH_ENGINE_URL}/search?${params.toString()}`);
      const json = await resp.json() as any;
      const results = json.results || [];

      // Update key_search if returned
      if (json.keySearch && json.keySearch !== q.key_search) {
        await pool.query(
          'UPDATE user_query SET key_search = $1, updated_at = NOW() WHERE id = $2',
          [json.keySearch, q.id]
        );
      }

      // Get existing fingerprints for this query (to detect truly new results)
      const { rows: existingRows } = await pool.query(
        'SELECT fingerprint FROM user_result WHERE user_query_id = $1 AND fingerprint IS NOT NULL',
        [q.id]
      );
      const existingFingerprints = new Set(existingRows.map(r => r.fingerprint));

      let newCount = 0;
      for (const r of results) {
        // Skip if this fingerprint already exists for this query
        if (r.fingerprint && existingFingerprints.has(r.fingerprint)) {
          continue;
        }

        const resultId = uuidv4();
        const domain = r.url ? extractDomain(r.url) : null;
        await pool.query(
          `INSERT INTO user_result (
            id, user_query_id, ran_dt, name_full, name_first, name_middle, name_last, age_years,
            dob, dod, date_visitation, date_funeral, city, state,
            pob_city, pob_state, source, url, snippet,
            score, reasons, fingerprint, type_provider, also_found_at,
            scores_criteria, score_final, score_max, criteria_cnt, rank, url_image,
            is_read, status, source_type
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33
          )`,
          [
            resultId, q.id, ranDt,
            r.nameFull || null, r.nameFirst || null, r.nameMiddle || null, r.nameLast || null, r.ageYears || null,
            r.dob || null, r.dod || null, r.dateVisitation || null, r.dateFuneral || null,
            r.city || null, r.state || null,
            r.pobCity || null, r.pobState || null,
            r.source || null, domain, r.snippet || null,
            r.score || 0, JSON.stringify(r.reasons || []),
            r.fingerprint || null, r.typeProvider || null,
            r.alsoFoundAt ? JSON.stringify(r.alsoFoundAt) : null,
            r.scoresCriteria ? JSON.stringify(r.scoresCriteria) : null,
            r.scoreFinal || null, r.scoreMax || null, r.criteriaCnt || null, r.rank || null,
            r.urlImage || null,
            false, 'pending', 'batch'
          ]
        );
        newCount++;
      }

      totalNewResults += newCount;
      console.log(`  [${i + 1}/${queries.length}] ${label}: ${results.length} results, ${newCount} new`);
    } catch (err) {
      console.error(`  [${i + 1}/${queries.length}] ${label}: ERROR -`, err);
    }
  }

  console.log(`[Batch] Complete. ${totalNewResults} new results across ${queries.length} queries.`);
  return { queriesRun: queries.length, newResults: totalNewResults };
}

/**
 * Get emails of users who have new unread batch results (for notification emails).
 * Only batch-discovered results trigger notifications — initial search results do not.
 */
export interface NotifyUser {
  email: string;
  phoneNumber: string | null;
  smsOptIn: boolean;
}

export async function getUsersWithNewResults(): Promise<NotifyUser[]> {
  const { rows } = await pool.query(
    `SELECT DISTINCT du.email, du.phone_number, du.sms_opt_in
     FROM dw_user du
     JOIN user_query uq ON uq.login_id = du.id AND uq.disabled = false
     JOIN user_result ur ON ur.user_query_id = uq.id
       AND ur.is_read = false
       AND ur.status = 'pending'
       AND ur.source_type = 'batch'
     WHERE du.email IS NOT NULL`
  );
  return rows.map((r: any) => ({
    email: r.email,
    phoneNumber: r.phone_number || null,
    smsOptIn: r.sms_opt_in !== false,
  }));
}

/**
 * Get monthly summary stats for all active subscribers.
 * Called on the 1st of the month; reports on the previous month.
 */
export interface MonthlySummaryUser {
  email: string;
  firstName: string;
  activeSearches: number;
  searchesPerformed: number;
  matchesFound: number;
}

export async function getMonthlySummaryUsers(): Promise<MonthlySummaryUser[]> {
  // Previous month boundaries
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  // Days in previous month (for calculating total searches performed)
  const daysInMonth = Math.round((monthEnd.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24));

  const { rows } = await pool.query(
    `SELECT
       du.email,
       du.first_name,
       COUNT(DISTINCT uq.id) AS active_searches,
       (SELECT COUNT(*) FROM user_result ur
        JOIN user_query uq2 ON ur.user_query_id = uq2.id
        WHERE uq2.login_id = du.id
          AND ur.source_type = 'batch'
          AND ur.created_at >= $1
          AND ur.created_at < $2
       ) AS matches_found
     FROM dw_user du
     JOIN user_query uq ON uq.login_id = du.id
       AND uq.disabled = false
       AND uq.confirmed = false
     WHERE du.subscription_active = true
       AND du.email IS NOT NULL
     GROUP BY du.id, du.email, du.first_name`,
    [monthStart.toISOString(), monthEnd.toISOString()]
  );

  return rows.map((r: any) => ({
    email: r.email,
    firstName: r.first_name,
    activeSearches: parseInt(r.active_searches, 10),
    searchesPerformed: parseInt(r.active_searches, 10) * daysInMonth,
    matchesFound: parseInt(r.matches_found, 10),
  }));
}
