import { pool } from '../db/pool';
import type { MatchResult, MatchSummary, NotificationBadge } from '../types';

const SEARCH_ENGINE_URL = process.env.SEARCH_ENGINE_URL || 'http://localhost:3000';

function rowToResult(row: any): MatchResult {
  return {
    id: row.id,
    userQueryId: row.user_query_id,
    ranDt: row.ran_dt?.toISOString() || '',
    nameFull: row.name_full,
    nameFirst: row.name_first,
    nameLast: row.name_last,
    ageYears: row.age_years,
    dod: row.dod,
    dateVisitation: row.date_visitation,
    dateFuneral: row.date_funeral,
    city: row.city,
    state: row.state,
    source: row.source,
    url: row.url,
    snippet: row.snippet,
    fingerprint: row.fingerprint,
    typeProvider: row.type_provider,
    urlImage: row.url_image,
    scoreFinal: row.score_final || 0,
    scoreMax: row.score_max || 0,
    rank: row.rank || 0,
    isRead: row.is_read || false,
    status: row.status || 'pending',
  };
}

export async function getSummaries(userId: string): Promise<MatchSummary[]> {
  const { rows } = await pool.query(
    `SELECT
       uq.id AS user_query_id,
       uq.name_last,
       uq.name_first,
       uq.confirmed,
       COUNT(ur.id) FILTER (WHERE ur.status != 'rejected')::int AS match_cnt_total,
       COUNT(ur.id) FILTER (WHERE ur.is_read = false AND ur.status = 'pending')::int AS match_cnt_new,
       COUNT(ur.id) FILTER (WHERE ur.status = 'rejected')::int AS match_cnt_dismissed
     FROM user_query uq
     LEFT JOIN user_result ur ON ur.user_query_id = uq.id
     WHERE uq.login_id = $1 AND uq.disabled = false
     GROUP BY uq.id, uq.name_last, uq.name_first, uq.confirmed
     ORDER BY match_cnt_new DESC, uq.name_last`,
    [userId]
  );

  return rows.map(r => ({
    userQueryId: r.user_query_id,
    nameLast: r.name_last,
    nameFirst: r.name_first,
    matchCntTotal: r.match_cnt_total,
    matchCntNew: r.match_cnt_new,
    matchCntDismissed: r.match_cnt_dismissed,
    confirmed: r.confirmed || false,
  }));
}

export async function getResultsForSearch(userId: string, searchId: string): Promise<MatchResult[]> {
  // Verify ownership
  const { rows: ownership } = await pool.query(
    'SELECT id FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (ownership.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  const { rows } = await pool.query(
    `SELECT * FROM user_result
     WHERE user_query_id = $1
     ORDER BY
       CASE WHEN status = 'rejected' THEN 1 ELSE 0 END,
       score_final DESC NULLS LAST,
       rank ASC NULLS LAST`,
    [searchId]
  );
  return rows.map(rowToResult);
}

export async function getResult(userId: string, searchId: string, resultId: string): Promise<MatchResult> {
  const { rows: ownership } = await pool.query(
    'SELECT id FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (ownership.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  const { rows } = await pool.query(
    'SELECT * FROM user_result WHERE id = $1 AND user_query_id = $2',
    [resultId, searchId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Result not found'), { status: 404 });
  }
  return rowToResult(rows[0]);
}

export async function confirmResult(userId: string, searchId: string, resultId: string) {
  // Verify ownership
  const { rows: queryRows } = await pool.query(
    'SELECT * FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (queryRows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  // Mark result as confirmed
  await pool.query(
    "UPDATE user_result SET status = 'confirmed', is_read = true WHERE id = $1 AND user_query_id = $2",
    [resultId, searchId]
  );

  // Mark the search as confirmed and disabled (stop searching)
  await pool.query(
    'UPDATE user_query SET confirmed = true, confirmed_at = NOW(), disabled = true, updated_at = NOW() WHERE id = $1',
    [searchId]
  );

  // Return updated search
  const { rows } = await pool.query('SELECT * FROM user_query WHERE id = $1', [searchId]);
  return rows[0];
}

export async function rejectResult(userId: string, searchId: string, resultId: string, reason?: string) {
  const { rows: queryRows } = await pool.query(
    'SELECT * FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (queryRows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  // Get the result details for exclusion
  const { rows: resultRows } = await pool.query(
    'SELECT * FROM user_result WHERE id = $1 AND user_query_id = $2',
    [resultId, searchId]
  );
  if (resultRows.length === 0) {
    throw Object.assign(new Error('Result not found'), { status: 404 });
  }

  const result = resultRows[0];

  // Mark result as rejected
  await pool.query(
    "UPDATE user_result SET status = 'rejected', is_read = true WHERE id = $1",
    [resultId]
  );

  // Add exclusion in search engine
  if (queryRows[0].key_search && result.fingerprint) {
    try {
      await fetch(`${SEARCH_ENGINE_URL}/exclude`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchKey: queryRows[0].key_search,
          fingerprint: result.fingerprint,
          url: result.url,
          name: result.name_full,
          reason: reason || 'wrong person',
        }),
      });
    } catch (err) {
      console.error('Failed to add exclusion to search engine:', err);
    }
  }
}

export async function restoreResult(userId: string, searchId: string, resultId: string) {
  const { rows: queryRows } = await pool.query(
    'SELECT * FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (queryRows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  const { rows: resultRows } = await pool.query(
    'SELECT * FROM user_result WHERE id = $1 AND user_query_id = $2',
    [resultId, searchId]
  );
  if (resultRows.length === 0) {
    throw Object.assign(new Error('Result not found'), { status: 404 });
  }

  const result = resultRows[0];

  // Flip status back to pending
  await pool.query(
    "UPDATE user_result SET status = 'pending' WHERE id = $1",
    [resultId]
  );

  // Remove exclusion from search engine
  if (queryRows[0].key_search && result.fingerprint) {
    try {
      const exRes = await fetch(
        `${SEARCH_ENGINE_URL}/exclusions?searchKey=${encodeURIComponent(queryRows[0].key_search)}`
      );
      if (exRes.ok) {
        const { exclusions } = await exRes.json() as { exclusions: { id: string; fingerprintExcluded: string }[] };
        const match = exclusions.find(
          (ex: { fingerprintExcluded: string }) => ex.fingerprintExcluded === result.fingerprint
        );
        if (match) {
          await fetch(`${SEARCH_ENGINE_URL}/exclude/${match.id}`, { method: 'DELETE' });
        }
      }
    } catch (err) {
      console.error('Failed to remove exclusion from search engine:', err);
    }
  }
}

export async function markRead(userId: string, searchId: string): Promise<number> {
  const { rows: ownership } = await pool.query(
    'SELECT id FROM user_query WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
  if (ownership.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }

  const result = await pool.query(
    'UPDATE user_result SET is_read = true WHERE user_query_id = $1 AND is_read = false',
    [searchId]
  );
  return result.rowCount || 0;
}

export async function getNotificationBadge(userId: string): Promise<NotificationBadge> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE(SUM(CASE WHEN ur.is_read = false AND ur.status = 'pending' THEN 1 ELSE 0 END), 0)::int AS match_cnt_new,
       COUNT(DISTINCT CASE WHEN ur.is_read = false AND ur.status = 'pending' THEN uq.id END)::int AS searches_cnt_with_new
     FROM user_query uq
     LEFT JOIN user_result ur ON ur.user_query_id = uq.id
     WHERE uq.login_id = $1 AND uq.disabled = false`,
    [userId]
  );

  return {
    matchCntNew: rows[0].match_cnt_new,
    searchesCntWithNew: rows[0].searches_cnt_with_new,
  };
}
