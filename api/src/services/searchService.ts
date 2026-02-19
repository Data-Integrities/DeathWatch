import { v4 as uuidv4 } from 'uuid';
import { pool } from '../db/pool';
import type { SearchQuery, SearchQueryCreate, MatchResult } from '../types';

const SEARCH_ENGINE_URL = process.env.SEARCH_ENGINE_URL || 'http://localhost:3000';

function rowToSearch(row: any): SearchQuery {
  return {
    id: row.id,
    loginId: row.login_id,
    nameLast: row.name_last,
    nameFirst: row.name_first,
    nameNickname: row.name_nickname,
    nameMiddle: row.name_middle,
    ageApx: row.age_apx,
    city: row.city,
    state: row.state,
    keyWords: row.key_words,
    disabled: row.disabled,
    confirmed: row.confirmed || false,
    confirmedAt: row.confirmed_at?.toISOString() || null,
    keySearch: row.key_search,
    matchCntNew: parseInt(row.match_cnt_new || '0', 10),
    createdAt: row.created_at?.toISOString() || '',
    updatedAt: row.updated_at?.toISOString() || '',
  };
}

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

export async function listSearches(userId: string): Promise<SearchQuery[]> {
  const { rows } = await pool.query(
    `SELECT uq.*,
       COALESCE((SELECT COUNT(*) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.is_read = false AND ur.status = 'pending'), 0) AS match_cnt_new
     FROM user_query uq
     WHERE uq.login_id = $1 AND uq.disabled = false
     ORDER BY uq.name_last, uq.name_first`,
    [userId]
  );
  return rows.map(rowToSearch);
}

export async function getSearch(userId: string, searchId: string): Promise<SearchQuery> {
  const { rows } = await pool.query(
    `SELECT uq.*,
       COALESCE((SELECT COUNT(*) FROM user_result ur WHERE ur.user_query_id = uq.id AND ur.is_read = false AND ur.status = 'pending'), 0) AS match_cnt_new
     FROM user_query uq
     WHERE uq.id = $1 AND uq.login_id = $2`,
    [searchId, userId]
  );
  if (rows.length === 0) {
    throw Object.assign(new Error('Search not found'), { status: 404 });
  }
  return rowToSearch(rows[0]);
}

export async function createSearch(userId: string, data: SearchQueryCreate) {
  const id = uuidv4();

  // Insert the user_query
  const { rows } = await pool.query(
    `INSERT INTO user_query (id, login_id, name_last, name_first, name_nickname, name_middle, age_apx, city, state, key_words, disabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
     RETURNING *`,
    [id, userId, data.nameLast, data.nameFirst, data.nameNickname, data.nameMiddle, data.ageApx, data.city, data.state, data.keyWords]
  );

  // Immediately run search via the search engine
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
          resultId, id, ranDt,
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

      results.push({
        id: resultId,
        userQueryId: id,
        ranDt: ranDt.toISOString(),
        nameFull: r.nameFull || null,
        nameFirst: r.nameFirst || null,
        nameLast: r.nameLast || null,
        ageYears: r.ageYears || null,
        dod: r.dod || null,
        dateVisitation: r.dateVisitation || null,
        dateFuneral: r.dateFuneral || null,
        city: r.city || null,
        state: r.state || null,
        source: r.source || null,
        url: r.url || '',
        snippet: r.snippet || null,
        fingerprint: r.fingerprint || null,
        typeProvider: r.typeProvider || null,
        urlImage: r.urlImage || null,
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

  const search = rowToSearch({ ...rows[0], match_cnt_new: results.length });
  return { search, results };
}

export async function updateSearch(userId: string, searchId: string, data: Partial<SearchQueryCreate>) {
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

  return { search: rowToSearch({ ...rows[0], match_cnt_new: 0 }) };
}

export async function deleteSearch(userId: string, searchId: string) {
  await getSearch(userId, searchId); // verify ownership
  await pool.query(
    'UPDATE user_query SET disabled = true, updated_at = NOW() WHERE id = $1 AND login_id = $2',
    [searchId, userId]
  );
}
