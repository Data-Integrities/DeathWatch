const { v4: uuidv4 } = require('uuid');
const { pool } = require('./pool');
const { logger } = require('../utils/logger');

class BatchStore {
  /**
   * Create a new batch record
   */
  async createBatch(inputFile) {
    const { rows } = await pool.query(
      `INSERT INTO batches (input_file) VALUES ($1) RETURNING *`,
      [inputFile || null]
    );
    logger.info(`Created batch: ${rows[0].id}`);
    return this._rowToBatch(rows[0]);
  }

  /**
   * Add a query and its results to a batch
   */
  async addQuery(batchId, person, keySearch, results, error) {
    const { rows: queryRows } = await pool.query(
      `INSERT INTO queries (batch_id, name_first, name_middle, name_last, age_apx, city, state, search_key, result_cnt, error, key_words, name_nickname)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        batchId,
        person.firstName,
        person.middleName || null,
        person.lastName,
        person.apxAge || null,
        person.city || null,
        person.state || null,
        keySearch,
        results ? results.length : 0,
        error || null,
        person.keyWords || null,
        person.nickname || null
      ]
    );

    const queryId = queryRows[0].id;

    if (results && results.length > 0) {
      await this._insertResults(queryId, results);
    }

    return queryId;
  }

  /**
   * Insert result rows for a query
   */
  async _insertResults(queryId, results) {
    for (const r of results) {
      const id = r.id || uuidv4();
      await pool.query(
        `INSERT INTO results (
           id, query_id, name_full, name_first, name_last, age_years,
           dod, date_visitation, date_funeral, city, state, source, url,
           snippet, score, reasons, fingerprint, type_provider, also_found_at,
           scores_criteria, score_final, score_max, criteria_cnt, rank
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19,
           $20, $21, $22, $23, $24
         )`,
        [
          id, queryId,
          r.nameFull || null, r.nameFirst || null, r.nameLast || null, r.ageYears || null,
          r.dod || null, r.dateVisitation || null, r.dateFuneral || null,
          r.city || null, r.state || null, r.source || null, r.url || null,
          r.snippet || null, r.score || 0,
          JSON.stringify(r.reasons || []),
          r.fingerprint || null, r.typeProvider || null,
          r.alsoFoundAt ? JSON.stringify(r.alsoFoundAt) : null,
          r.scoresCriteria ? JSON.stringify(r.scoresCriteria) : null,
          r.scoreFinal || null, r.scoreMax || null, r.criteriaCnt || null,
          r.rank || null
        ]
      );
    }
  }

  /**
   * Finalize batch with total counts
   */
  async finalizeBatch(batchId) {
    await pool.query(
      `UPDATE batches SET
         total_queries = (SELECT COUNT(*) FROM queries WHERE batch_id = $1),
         total_results = (SELECT COALESCE(SUM(result_cnt), 0) FROM queries WHERE batch_id = $1)
       WHERE id = $1`,
      [batchId]
    );
  }

  /**
   * Get a batch with its queries and results
   */
  async getBatch(batchId) {
    const { rows: batchRows } = await pool.query(
      'SELECT * FROM batches WHERE id = $1',
      [batchId]
    );

    if (batchRows.length === 0) return null;

    const batch = this._rowToBatch(batchRows[0]);

    const { rows: queryRows } = await pool.query(
      'SELECT * FROM queries WHERE batch_id = $1 ORDER BY created_at',
      [batchId]
    );

    batch.queries = [];
    for (const qr of queryRows) {
      const { rows: resultRows } = await pool.query(
        'SELECT * FROM results WHERE query_id = $1 ORDER BY rank ASC NULLS LAST',
        [qr.id]
      );

      batch.queries.push({
        query: {
          firstName: qr.name_first,
          middleName: qr.name_middle,
          lastName: qr.name_last,
          apxAge: qr.age_apx,
          city: qr.city,
          state: qr.state,
          keyWords: qr.key_words,
          nickname: qr.name_nickname
        },
        keySearch: qr.search_key,
        resultCnt: qr.result_cnt,
        error: qr.error,
        results: resultRows.map(r => this._rowToResult(r))
      });
    }

    return batch;
  }

  /**
   * Get the most recent batch
   */
  async getLatestBatch() {
    const { rows } = await pool.query(
      'SELECT id FROM batches ORDER BY created_at DESC LIMIT 1'
    );
    if (rows.length === 0) return null;
    return this.getBatch(rows[0].id);
  }

  /**
   * List all batches (summary, no results)
   */
  async listBatches() {
    const { rows } = await pool.query(
      'SELECT * FROM batches ORDER BY created_at DESC'
    );
    return rows.map(r => this._rowToBatch(r));
  }

  _rowToBatch(row) {
    return {
      id: row.id,
      inputFile: row.input_file,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      totalQueries: row.total_queries,
      totalResults: row.total_results
    };
  }

  _rowToResult(row) {
    return {
      id: row.id,
      nameFull: row.name_full,
      nameFirst: row.name_first,
      nameLast: row.name_last,
      ageYears: row.age_years,
      dod: row.dod ? row.dod.toISOString().split('T')[0] : null,
      dateVisitation: row.date_visitation ? row.date_visitation.toISOString().split('T')[0] : null,
      dateFuneral: row.date_funeral ? row.date_funeral.toISOString().split('T')[0] : null,
      city: row.city,
      state: row.state,
      source: row.source,
      url: row.url,
      snippet: row.snippet,
      score: row.score,
      reasons: row.reasons || [],
      fingerprint: row.fingerprint,
      typeProvider: row.type_provider,
      alsoFoundAt: row.also_found_at,
      scoresCriteria: row.scores_criteria,
      scoreFinal: row.score_final,
      scoreMax: row.score_max,
      criteriaCnt: row.criteria_cnt,
      rank: row.rank
    };
  }
}

const batchStore = new BatchStore();

module.exports = { BatchStore, batchStore };
