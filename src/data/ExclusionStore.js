const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { logger } = require('../utils/logger');

/**
 * Exclusion types:
 * - 'per-query': Only applies to specific searchKey
 * - 'global': Applies to all searches (e.g., generic funeral home pages)
 */
class ExclusionStore {
  constructor(dataPath) {
    this.exclusions = [];
    this.loaded = false;
    this.dataPath = dataPath || path.join(config.dataDir, 'exclusions.json');
  }

  _load() {
    if (this.loaded) return this.exclusions;

    try {
      if (fs.existsSync(this.dataPath)) {
        const data = fs.readFileSync(this.dataPath, 'utf-8');
        this.exclusions = JSON.parse(data);
        logger.debug(`Loaded ${this.exclusions.length} exclusions`);
      } else {
        this.exclusions = [];
      }
    } catch (err) {
      logger.error('Error loading exclusions:', err);
      this.exclusions = [];
    }

    this.loaded = true;
    return this.exclusions;
  }

  _save() {
    try {
      const dir = path.dirname(this.dataPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.dataPath, JSON.stringify(this.exclusions, null, 2));
    } catch (err) {
      logger.error('Error saving exclusions:', err);
    }
  }

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

  getAll() {
    return this._load();
  }

  getBySearchKey(searchKey) {
    return this._load().filter(e => e.searchKey === searchKey && e.scope !== 'global');
  }

  getGlobalExclusions() {
    return this._load().filter(e => e.scope === 'global');
  }

  /**
   * Get all excluded fingerprints for a search (per-query + global)
   */
  getExcludedFingerprints(searchKey) {
    const perQuery = this.getBySearchKey(searchKey);
    const global = this.getGlobalExclusions();
    const all = [...perQuery, ...global];
    return new Set(all.map(e => e.excludedFingerprint).filter(Boolean));
  }

  /**
   * Get all excluded URLs for a search (per-query + global)
   */
  getExcludedUrls(searchKey) {
    const perQuery = this.getBySearchKey(searchKey);
    const global = this.getGlobalExclusions();
    const all = [...perQuery, ...global];
    return new Set(all.map(e => this._normalizeUrl(e.excludedUrl)).filter(Boolean));
  }

  /**
   * Check if a candidate should be excluded (by fingerprint OR URL)
   */
  isExcluded(candidate, searchKey) {
    const fingerprints = this.getExcludedFingerprints(searchKey);
    const urls = this.getExcludedUrls(searchKey);

    if (candidate.fingerprint && fingerprints.has(candidate.fingerprint)) {
      return { excluded: true, reason: 'fingerprint' };
    }

    if (candidate.url) {
      const normalizedUrl = this._normalizeUrl(candidate.url);
      if (urls.has(normalizedUrl)) {
        return { excluded: true, reason: 'url' };
      }
    }

    return { excluded: false };
  }

  getById(id) {
    return this._load().find(e => e.id === id);
  }

  /**
   * Add an exclusion
   * @param {Object} params
   * @param {string} params.searchKey - The search key (required for per-query)
   * @param {string} params.excludedFingerprint - Fingerprint to exclude
   * @param {string} params.excludedUrl - URL to exclude (backup matching)
   * @param {string} params.excludedName - Name for reference
   * @param {string} params.reason - Why excluded (wrong person, different location, etc.)
   * @param {string} params.scope - 'per-query' (default) or 'global'
   */
  add(params) {
    this._load();

    const scope = params.scope || 'per-query';

    // Check if already excluded (by fingerprint or URL)
    const existing = this.exclusions.find(e => {
      if (scope === 'global' && e.scope === 'global') {
        // Global: match by fingerprint or URL
        if (params.excludedFingerprint && e.excludedFingerprint === params.excludedFingerprint) return true;
        if (params.excludedUrl && this._normalizeUrl(e.excludedUrl) === this._normalizeUrl(params.excludedUrl)) return true;
      } else if (scope === 'per-query' && e.scope !== 'global') {
        // Per-query: must match searchKey + (fingerprint or URL)
        if (e.searchKey !== params.searchKey) return false;
        if (params.excludedFingerprint && e.excludedFingerprint === params.excludedFingerprint) return true;
        if (params.excludedUrl && this._normalizeUrl(e.excludedUrl) === this._normalizeUrl(params.excludedUrl)) return true;
      }
      return false;
    });

    if (existing) {
      return { exclusion: existing, isNew: false };
    }

    const exclusion = {
      id: uuidv4(),
      scope,
      searchKey: scope === 'global' ? null : params.searchKey,
      excludedFingerprint: params.excludedFingerprint || null,
      excludedUrl: params.excludedUrl ? this._normalizeUrl(params.excludedUrl) : null,
      excludedName: params.excludedName || null,
      reason: params.reason || null,
      createdAt: new Date().toISOString()
    };

    this.exclusions.push(exclusion);
    this._save();
    logger.info(`Added ${scope} exclusion: ${exclusion.id}`);

    return { exclusion, isNew: true };
  }

  /**
   * Add a global exclusion (applies to all searches)
   */
  addGlobal(params) {
    return this.add({ ...params, scope: 'global' });
  }

  remove(id) {
    this._load();

    const index = this.exclusions.findIndex(e => e.id === id);
    if (index === -1) {
      return false;
    }

    this.exclusions.splice(index, 1);
    this._save();
    logger.info(`Removed exclusion: ${id}`);

    return true;
  }

  /**
   * Get exclusion statistics by reason
   */
  getStats() {
    this._load();

    const stats = {
      total: this.exclusions.length,
      global: 0,
      perQuery: 0,
      byReason: {}
    };

    for (const e of this.exclusions) {
      if (e.scope === 'global') {
        stats.global++;
      } else {
        stats.perQuery++;
      }

      const reason = e.reason || 'unspecified';
      stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
    }

    return stats;
  }

  reload() {
    this.loaded = false;
    return this._load();
  }
}

const exclusionStore = new ExclusionStore();

module.exports = { ExclusionStore, exclusionStore };
