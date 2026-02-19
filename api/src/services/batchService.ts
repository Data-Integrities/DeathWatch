import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';

const SEARCH_ENGINE_URL = process.env.SEARCH_ENGINE_URL || 'http://localhost:3000';

export async function runBatch() {
  const ranDt = new Date();
  console.log(`[Batch] Starting batch run at ${ranDt.toISOString()}`);

  // Load all active (non-disabled, non-confirmed) user queries
  const { rows: queries } = await pool.query(
    `SELECT id, login_id, name_first, name_middle, name_last, name_nickname, age_apx, city, state, key_words, key_search
     FROM user_query
     WHERE disabled = false AND confirmed = false
     ORDER BY name_last, name_first`
  );

  console.log(`[Batch] Found ${queries.length} active queries`);
  let totalNewResults = 0;

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const label = `${q.name_first || q.name_nickname || ''} ${q.name_last}`.trim();

    try {
      // Build search engine request
      const params = new URLSearchParams();
      params.set('lastName', q.name_last);
      if (q.name_first) params.set('firstName', q.name_first);
      if (q.name_nickname) params.set('nickname', q.name_nickname);
      if (q.name_middle) params.set('middleName', q.name_middle);
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
        await pool.query(
          `INSERT INTO user_result (
            id, user_query_id, ran_dt, name_full, name_first, name_last, age_years,
            dod, date_visitation, date_funeral, city, state, source, url, snippet,
            score, reasons, fingerprint, type_provider, also_found_at,
            scores_criteria, score_final, score_max, criteria_cnt, rank, url_image,
            is_read, status
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28
          )`,
          [
            resultId, q.id, ranDt,
            r.nameFull || null, r.nameFirst || null, r.nameLast || null, r.ageYears || null,
            r.dod || null, r.dateVisitation || null, r.dateFuneral || null,
            r.city || null, r.state || null, r.source || null, r.url || null, r.snippet || null,
            r.score || 0, JSON.stringify(r.reasons || []),
            r.fingerprint || null, r.typeProvider || null,
            r.alsoFoundAt ? JSON.stringify(r.alsoFoundAt) : null,
            r.scoresCriteria ? JSON.stringify(r.scoresCriteria) : null,
            r.scoreFinal || null, r.scoreMax || null, r.criteriaCnt || null, r.rank || null,
            r.urlImage || null,
            false, 'pending'
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
 * Get users who have new (unread) results for sending notification emails.
 */
export async function getUsersWithNewResults() {
  const { rows } = await pool.query(
    `SELECT
       du.id AS user_id,
       du.email,
       COUNT(ur.id)::int AS new_count,
       json_agg(json_build_object(
         'searchId', uq.id,
         'name', CONCAT(COALESCE(uq.name_first, uq.name_nickname, ''), ' ', uq.name_last),
         'newCount', sub.cnt
       )) AS searches
     FROM dw_user du
     JOIN user_query uq ON uq.login_id = du.id AND uq.disabled = false
     JOIN (
       SELECT user_query_id, COUNT(*)::int AS cnt
       FROM user_result
       WHERE is_read = false AND status = 'pending'
       GROUP BY user_query_id
     ) sub ON sub.user_query_id = uq.id
     JOIN user_result ur ON ur.user_query_id = uq.id AND ur.is_read = false AND ur.status = 'pending'
     WHERE du.email IS NOT NULL
     GROUP BY du.id, du.email`
  );
  return rows;
}
