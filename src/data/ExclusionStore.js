const { v4: uuidv4 } = require('uuid');
const { pool } = require('../db/pool');
const { logger } = require('../utils/logger');

/**
 * Exclusion types:
 * - 'per-query': Only applies to specific keySearch
 * - 'global': Applies to all searches (e.g., generic funeral home pages)
 */
class ExclusionStore {
  _normalizeUrl(url) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      // Remove tracking params, normalize to lowercase hostname
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  async getAll() {
    const { rows } = await pool.query(
      'SELECT * FROM exclusions ORDER BY created_at DESC'
    );
    return rows.map(r => this._rowToExclusion(r));
  }

  async getByKeySearch(keySearch) {
    const { rows } = await pool.query(
      "SELECT * FROM exclusions WHERE search_key = $1 AND scope != 'global' ORDER BY created_at DESC",
      [keySearch]
    );
    return rows.map(r => this._rowToExclusion(r));
  }

  async getGlobalExclusions() {
    const { rows } = await pool.query(
      "SELECT * FROM exclusions WHERE scope = 'global' ORDER BY created_at DESC"
    );
    return rows.map(r => this._rowToExclusion(r));
  }

  /**
   * Get all excluded fingerprints for a search (per-query + global)
   */
  async getFingerprintsExcluded(keySearch) {
    const { rows } = await pool.query(
      `SELECT fingerprint_excluded FROM exclusions
       WHERE (search_key = $1 OR scope = 'global')
         AND fingerprint_excluded IS NOT NULL`,
      [keySearch]
    );
    return new Set(rows.map(r => r.fingerprint_excluded));
  }

  /**
   * Get all excluded URLs for a search (per-query + global)
   */
  async getUrlsExcluded(keySearch) {
    const { rows } = await pool.query(
      `SELECT url_excluded FROM exclusions
       WHERE (search_key = $1 OR scope = 'global')
         AND url_excluded IS NOT NULL`,
      [keySearch]
    );
    return new Set(rows.map(r => r.url_excluded));
  }

  async getById(id) {
    const { rows } = await pool.query(
      'SELECT * FROM exclusions WHERE id = $1',
      [id]
    );
    return rows.length > 0 ? this._rowToExclusion(rows[0]) : null;
  }

  /**
   * Add an exclusion
   * @param {Object} params
   * @param {string} params.keySearch - The search key (required for per-query)
   * @param {string} params.fingerprintExcluded - Fingerprint to exclude
   * @param {string} params.urlExcluded - URL to exclude (backup matching)
   * @param {string} params.nameExcluded - Name for reference
   * @param {string} params.reason - Why excluded (wrong person, different location, etc.)
   * @param {string} params.scope - 'per-query' (default) or 'global'
   */
  async add(params) {
    const scope = params.scope || 'per-query';
    const urlNorm = params.urlExcluded ? this._normalizeUrl(params.urlExcluded) : null;

    // Check if already excluded (by fingerprint or URL)
    const existing = await this._findExisting(scope, params.keySearch, params.fingerprintExcluded, urlNorm);
    if (existing) {
      return { exclusion: existing, isNew: false };
    }

    const id = uuidv4();
    const keySearch = scope === 'global' ? null : params.keySearch;

    const { rows } = await pool.query(
      `INSERT INTO exclusions (id, scope, search_key, fingerprint_excluded, url_excluded, name_excluded, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, scope, keySearch, params.fingerprintExcluded || null, urlNorm, params.nameExcluded || null, params.reason || null]
    );

    const exclusion = this._rowToExclusion(rows[0]);
    logger.info(`Added ${scope} exclusion: ${exclusion.id}`);
    return { exclusion, isNew: true };
  }

  /**
   * Add a global exclusion (applies to all searches)
   */
  async addGlobal(params) {
    return this.add({ ...params, scope: 'global' });
  }

  async remove(id) {
    const { rowCount } = await pool.query(
      'DELETE FROM exclusions WHERE id = $1',
      [id]
    );

    if (rowCount > 0) {
      logger.info(`Removed exclusion: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Get exclusion statistics by reason
   */
  async getStats() {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE scope = 'global')::int AS global,
         COUNT(*) FILTER (WHERE scope != 'global')::int AS "perQuery"
       FROM exclusions`
    );

    const { rows: reasonRows } = await pool.query(
      `SELECT COALESCE(reason, 'unspecified') AS reason, COUNT(*)::int AS count
       FROM exclusions
       GROUP BY COALESCE(reason, 'unspecified')
       ORDER BY count DESC`
    );

    const byReason = {};
    for (const r of reasonRows) {
      byReason[r.reason] = r.count;
    }

    return {
      total: rows[0].total,
      global: rows[0].global,
      perQuery: rows[0].perQuery,
      byReason
    };
  }

  /**
   * Check for existing duplicate exclusion
   */
  async _findExisting(scope, keySearch, fingerprint, urlNorm) {
    if (scope === 'global') {
      // Global: match by fingerprint or URL
      if (fingerprint) {
        const { rows } = await pool.query(
          "SELECT * FROM exclusions WHERE scope = 'global' AND fingerprint_excluded = $1",
          [fingerprint]
        );
        if (rows.length > 0) return this._rowToExclusion(rows[0]);
      }
      if (urlNorm) {
        const { rows } = await pool.query(
          "SELECT * FROM exclusions WHERE scope = 'global' AND url_excluded = $1",
          [urlNorm]
        );
        if (rows.length > 0) return this._rowToExclusion(rows[0]);
      }
    } else {
      // Per-query: must match keySearch + (fingerprint or URL)
      if (fingerprint) {
        const { rows } = await pool.query(
          "SELECT * FROM exclusions WHERE scope != 'global' AND search_key = $1 AND fingerprint_excluded = $2",
          [keySearch, fingerprint]
        );
        if (rows.length > 0) return this._rowToExclusion(rows[0]);
      }
      if (urlNorm) {
        const { rows } = await pool.query(
          "SELECT * FROM exclusions WHERE scope != 'global' AND search_key = $1 AND url_excluded = $2",
          [keySearch, urlNorm]
        );
        if (rows.length > 0) return this._rowToExclusion(rows[0]);
      }
    }
    return null;
  }

  /**
   * Map a DB row (snake_case) to the JS object (camelCase)
   */
  _rowToExclusion(row) {
    return {
      id: row.id,
      scope: row.scope,
      keySearch: row.search_key,
      fingerprintExcluded: row.fingerprint_excluded,
      urlExcluded: row.url_excluded,
      nameExcluded: row.name_excluded,
      reason: row.reason,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at
    };
  }
}

const exclusionStore = new ExclusionStore();

module.exports = { ExclusionStore, exclusionStore };
