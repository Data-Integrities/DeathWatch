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
  async addQuery(batchId, person, searchKey, results, error) {
    const { rows: queryRows } = await pool.query(
      `INSERT INTO queries (batch_id, first_name, middle_name, last_name, apx_age, city, state, search_key, result_count, error)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        batchId,
        person.firstName,
        person.middleName || null,
        person.lastName,
        person.apxAge || null,
        person.city || null,
        person.state || null,
        searchKey,
        results ? results.length : 0,
        error || null
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
           id, query_id, full_name, first_name, last_name, age_years,
           dod, visitation_date, funeral_date, city, state, source, url,
           snippet, score, reasons, fingerprint, provider_type, also_found_at,
           criteria_scores, final_score, max_possible, criteria_count, rank
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           $7, $8, $9, $10, $11, $12, $13,
           $14, $15, $16, $17, $18, $19,
           $20, $21, $22, $23, $24
         )`,
        [
          id, queryId,
          r.fullName || null, r.firstName || null, r.lastName || null, r.ageYears || null,
          r.dod || null, r.visitationDate || null, r.funeralDate || null,
          r.city || null, r.state || null, r.source || null, r.url || null,
          r.snippet || null, r.score || 0,
          JSON.stringify(r.reasons || []),
          r.fingerprint || null, r.providerType || null,
          r.alsoFoundAt ? JSON.stringify(r.alsoFoundAt) : null,
          r.criteriaScores ? JSON.stringify(r.criteriaScores) : null,
          r.finalScore || null, r.maxPossible || null, r.criteriaCount || null,
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
         total_results = (SELECT COALESCE(SUM(result_count), 0) FROM queries WHERE batch_id = $1)
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
          firstName: qr.first_name,
          middleName: qr.middle_name,
          lastName: qr.last_name,
          apxAge: qr.apx_age,
          city: qr.city,
          state: qr.state
        },
        searchKey: qr.search_key,
        resultCount: qr.result_count,
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
      fullName: row.full_name,
      firstName: row.first_name,
      lastName: row.last_name,
      ageYears: row.age_years,
      dod: row.dod ? row.dod.toISOString().split('T')[0] : null,
      visitationDate: row.visitation_date ? row.visitation_date.toISOString().split('T')[0] : null,
      funeralDate: row.funeral_date ? row.funeral_date.toISOString().split('T')[0] : null,
      city: row.city,
      state: row.state,
      source: row.source,
      url: row.url,
      snippet: row.snippet,
      score: row.score,
      reasons: row.reasons || [],
      fingerprint: row.fingerprint,
      providerType: row.provider_type,
      alsoFoundAt: row.also_found_at,
      criteriaScores: row.criteria_scores,
      finalScore: row.final_score,
      maxPossible: row.max_possible,
      criteriaCount: row.criteria_count,
      rank: row.rank
    };
  }
}

const batchStore = new BatchStore();

module.exports = { BatchStore, batchStore };
