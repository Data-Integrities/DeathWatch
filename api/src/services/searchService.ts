import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import type { SearchQuery, SearchQueryCreate, MatchResult } from '../types';

const SEARCH_ENGINE_URL = process.env.SEARCH_ENGINE_URL || 'http://localhost:3000';

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url || ''; }
}

function rowToSearch(row: any): SearchQuery {
  return {
    id: row.id,
    loginId: row.login_id,
    nameLast: row.name_last,
    nameFirst: row.name_first,
    nameNickname: row.name_nickname,
    nameMiddle: row.name_middle,
    nameMaiden: row.name_maiden,
    ageApx: row.age_apx,
    city: row.city,
    state: row.state,
    keyWords: row.key_words,
    disabled: row.disabled,
    confirmed: row.confirmed || false,
    confirmedAt: row.confirmed_at?.toISOString() || null,
    keySearch: row.key_search,
    matchCntNew: parseInt(row.match_cnt_new || '0', 10),
    matchCntTotal: parseInt(row.match_cnt_total || '0', 10),
    matchCntDismissed: parseInt(row.match_cnt_dismissed || '0', 10),
    createdAt: row.created_at?.toISOString() || '',
    updatedAt: row.updated_at?.toISOString() || '',
  };
}

function rowToResult(row: any): MatchResult {
  return {
    id: row.id,
    userQueryId: row.user_query_id,
    sourceDomain: row.url || '',
    fingerprint: row.fingerprint,
    scoreFinal: row.score_final || 0,
    scoreMax: row.score_max || 0,
    rank: row.rank || 0,
    isRead: row.is_read || false,
    status: row.status || 'pending',
  };
}

export async function listSearches(userId: string): Promise<SearchQuery[]> {
  const { rows } = await pool.query(
    `SELECT uq.*,
       COALESCE((SELECT COUNT(DISTINCT url) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.is_read = false AND ur.status = 'pending'), 0) AS match_cnt_new,
       COALESCE((SELECT COUNT(DISTINCT url) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.rejected_at IS NULL), 0) AS match_cnt_total,
       COALESCE((SELECT COUNT(DISTINCT url) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.rejected_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_result ur2 WHERE ur2.user_query_id = uq.id AND ur2.url = ur.url AND ur2.rejected_at IS NULL)), 0) AS match_cnt_dismissed
     FROM user_query uq
     WHERE uq.login_id = $1 AND (uq.disabled = false OR uq.confirmed = true)
     ORDER BY uq.name_last, uq.name_first`,
    [userId]
  );
  return rows.map(rowToSearch);
}

export async function getSearch(userId: string, searchId: string): Promise<SearchQuery> {
  const { rows } = await pool.query(
    `SELECT uq.*,
       COALESCE((SELECT COUNT(DISTINCT url) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.is_read = false AND ur.status = 'pending'), 0) AS match_cnt_new,
       COALESCE((SELECT COUNT(DISTINCT url) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.rejected_at IS NULL), 0) AS match_cnt_total,
       COALESCE((SELECT COUNT(DISTINCT url) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.rejected_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_result ur2 WHERE ur2.user_query_id = uq.id AND ur2.url = ur.url AND ur2.rejected_at IS NULL)), 0) AS match_cnt_dismissed
     FROM user_query uq
     WHERE uq.id = $1 AND uq.login_id = $2`,
    [searchId, userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }
  return rowToSearch(rows[0]);
}

const SEARCH_THROTTLE_MS = 16_000;

async function throttleSearch(userId: string, timestampCol: 'created_at' | 'updated_at') {
  const { rows } = await pool.query(
    `SELECT EXTRACT(EPOCH FROM (NOW() - ${timestampCol})) * 1000 AS elapsed_ms
     FROM user_query WHERE login_id = $1
     ORDER BY ${timestampCol} DESC LIMIT 1`,
    [userId]
  );
  if (rows.length > 0 && rows[0].elapsed_ms < SEARCH_THROTTLE_MS) {
    const waitMs = Math.ceil(SEARCH_THROTTLE_MS - rows[0].elapsed_ms);
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }
}

export async function createSearch(userId: string, data: SearchQueryCreate) {
  await throttleSearch(userId, 'created_at');

  const id = uuidv4();

  // Insert the user_query
  const { rows } = await pool.query(
    `INSERT INTO user_query (id, login_id, name_last, name_first, name_nickname, name_middle, name_maiden, age_apx, city, state, key_words, disabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, false)
     RETURNING *`,
    [id, userId, data.nameLast, data.nameFirst, data.nameNickname, data.nameMiddle, data.nameMaiden, data.ageApx, data.city, data.state, data.keyWords]
  );

  // Immediately run search via the search engine
  const params = new URLSearchParams();
  if (data.nameLast) params.set('lastName', data.nameLast);
  if (data.nameFirst) params.set('firstName', data.nameFirst);
  if (data.nameNickname) params.set('nickname', data.nameNickname);
  if (data.nameMiddle) params.set('middleName', data.nameMiddle);
  if (data.nameMaiden) params.set('maidenName', data.nameMaiden);
  if (data.ageApx) params.set('age', data.ageApx.toString());
  if (data.city) params.set('city', data.city);
  if (data.state) params.set('state', data.state);
  if (data.keyWords) params.set('keyWords', data.keyWords);

  let results: MatchResult[] = [];
  try {
    const resp = await fetch(`${SEARCH_ENGINE_URL}/search?${params.toString()}`);
    const json = await resp.json() as any;

    // Update key_search on user_query
    if (json.keySearch) {
      await pool.query(
        'UPDATE user_query SET key_search = $1, updated_at = NOW() WHERE id = $2',
        [json.keySearch, id]
      );
    }

    // Insert results
    const ranDt = new Date();
    for (const r of json.results || []) {
      const resultId = uuidv4();
      const domain = r.url ? extractDomain(r.url) : null;
      await pool.query(
        `INSERT INTO user_result (
          id, user_query_id, ran_dt, name_full, name_first, name_middle, name_last, age_years,
          dob, dod, date_visitation, date_funeral, city, state,
          pob_city, pob_state, source, url, snippet,
          score, reasons, fingerprint, type_provider, also_found_at,
          scores_criteria, score_final, score_max, criteria_cnt, rank, url_image,
          is_read, status
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
        )`,
        [
          resultId, id, ranDt,
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
          false, 'pending'
        ]
      );

      results.push({
        id: resultId,
        userQueryId: id,
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
    console.error('Search engine call failed:', err);
    // Search was still saved — results just empty
  }

  const search = rowToSearch({ ...rows[0], match_cnt_new: results.length, match_cnt_total: results.length, match_cnt_dismissed: 0 });
  return { search, results };
}

export async function updateSearch(userId: string, searchId: string, data: Partial<SearchQueryCreate>) {
  await throttleSearch(userId, 'updated_at');

  // Verify ownership
  const existing = await getSearch(userId, searchId);
  if (existing.confirmed) {
    throw Object.assign(new Error('Cannot edit a confirmed search'), { status: 400 });
  }

  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.nameLast !== undefined) { fields.push(`name_last = $${idx++}`); values.push(data.nameLast); }
  if (data.nameFirst !== undefined) { fields.push(`name_first = $${idx++}`); values.push(data.nameFirst); }
  if (data.nameNickname !== undefined) { fields.push(`name_nickname = $${idx++}`); values.push(data.nameNickname); }
  if (data.nameMiddle !== undefined) { fields.push(`name_middle = $${idx++}`); values.push(data.nameMiddle); }
  if (data.nameMaiden !== undefined) { fields.push(`name_maiden = $${idx++}`); values.push(data.nameMaiden); }
  if (data.ageApx !== undefined) { fields.push(`age_apx = $${idx++}`); values.push(data.ageApx); }
  if (data.city !== undefined) { fields.push(`city = $${idx++}`); values.push(data.city); }
  if (data.state !== undefined) { fields.push(`state = $${idx++}`); values.push(data.state); }
  if (data.keyWords !== undefined) { fields.push(`key_words = $${idx++}`); values.push(data.keyWords); }

  if (fields.length === 0) {
    return { search: existing };
  }

  fields.push(`updated_at = NOW()`);
  values.push(searchId, userId);

  const { rows } = await pool.query(
    `UPDATE user_query SET ${fields.join(', ')} WHERE id = $${idx++} AND login_id = $${idx++} RETURNING *`,
    values
  );

  const updated = rows[0];

  // Clear old pending results and re-run search with updated criteria
  await pool.query(
    "DELETE FROM user_result WHERE user_query_id = $1 AND status = 'pending'",
    [searchId]
  );

  const params = new URLSearchParams();
  if (updated.name_last) params.set('lastName', updated.name_last);
  if (updated.name_first) params.set('firstName', updated.name_first);
  if (updated.name_nickname) params.set('nickname', updated.name_nickname);
  if (updated.name_middle) params.set('middleName', updated.name_middle);
  if (updated.name_maiden) params.set('maidenName', updated.name_maiden);
  if (updated.age_apx) params.set('age', updated.age_apx.toString());
  if (updated.city) params.set('city', updated.city);
  if (updated.state) params.set('state', updated.state);
  if (updated.key_words) params.set('keyWords', updated.key_words);

  try {
    const resp = await fetch(`${SEARCH_ENGINE_URL}/search?${params.toString()}`);
    const json = await resp.json() as any;

    if (json.keySearch) {
      await pool.query(
        'UPDATE user_query SET key_search = $1, updated_at = NOW() WHERE id = $2',
        [json.keySearch, searchId]
      );
    }

    // Get existing fingerprints (from confirmed/rejected results) to avoid re-inserting
    const { rows: existingRows } = await pool.query(
      'SELECT fingerprint FROM user_result WHERE user_query_id = $1 AND fingerprint IS NOT NULL',
      [searchId]
    );
    const existingFingerprints = new Set(existingRows.map((r: any) => r.fingerprint));

    const ranDt = new Date();
    for (const r of json.results || []) {
      if (r.fingerprint && existingFingerprints.has(r.fingerprint)) continue;

      const resultId = uuidv4();
      const domain = r.url ? extractDomain(r.url) : null;
      await pool.query(
        `INSERT INTO user_result (
          id, user_query_id, ran_dt, name_full, name_first, name_middle, name_last, age_years,
          dob, dod, date_visitation, date_funeral, city, state,
          pob_city, pob_state, source, url, snippet,
          score, reasons, fingerprint, type_provider, also_found_at,
          scores_criteria, score_final, score_max, criteria_cnt, rank, url_image,
          is_read, status
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
        )`,
        [
          resultId, searchId, ranDt,
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
          false, 'pending'
        ]
      );
    }
  } catch (err) {
    console.error('[Search] Re-search after edit failed:', err);
  }

  return { search: rowToSearch({ ...updated, match_cnt_new: 0, match_cnt_total: 0, match_cnt_dismissed: 0 }) };
}

export async function confirmSearch(userId: string, searchId: string): Promise<SearchQuery> {
  const { rows } = await pool.query(
    'SELECT * FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  await pool.query(
    'UPDATE user_query SET confirmed = true, confirmed_at = NOW(), disabled = true, updated_at = NOW() WHERE id = $1',
    [searchId]
  );

  // Mark all pending results as read
  await pool.query(
    "UPDATE user_result SET is_read = true WHERE user_query_id = $1 AND is_read = false",
    [searchId]
  );

  return getSearch(userId, searchId);
}

export async function unconfirmSearch(userId: string, searchId: string): Promise<SearchQuery> {
  const { rows } = await pool.query(
    'SELECT * FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  await pool.query(
    'UPDATE user_query SET confirmed = false, confirmed_at = NULL, disabled = false, updated_at = NOW() WHERE id = $1',
    [searchId]
  );

  return getSearch(userId, searchId);
}

export async function rejectAllResults(userId: string, searchId: string): Promise<void> {
  const { rows } = await pool.query(
    'SELECT * FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  const searchKey = rows[0].key_search;

  // Get all pending results for exclusion
  const { rows: pendingResults } = await pool.query(
    "SELECT * FROM user_result WHERE user_query_id = $1 AND status = 'pending'",
    [searchId]
  );

  // Reject all pending results
  await pool.query(
    "UPDATE user_result SET status = 'rejected', is_read = true, rejected_at = NOW() WHERE user_query_id = $1 AND status = 'pending'",
    [searchId]
  );

  // Add exclusions in search engine for each rejected result
  if (searchKey) {
    for (const result of pendingResults) {
      if (result.fingerprint) {
        try {
          await fetch(`${SEARCH_ENGINE_URL}/exclude`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              searchKey,
              fingerprint: result.fingerprint,
              name: result.name_full,
              reason: 'wrong person (all rejected)',
            }),
          });
        } catch (err) {
          console.error('Failed to add exclusion to search engine:', err);
        }
      }
    }
  }
}

export async function deleteSearch(userId: string, searchId: string) {
  await getSearch(userId, searchId); // verify ownership
  await pool.query(
    'UPDATE user_query SET disabled = true, updated_at = NOW() WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
}
