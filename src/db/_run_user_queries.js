#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, close } = require('./pool');
const { searchObits, searchMetrics } = require('../index');
const { v4: uuidv4 } = require('uuid');

// Local metrics object (extends searchMetrics from index.js)
const metrics = {
  ranDt: null,
  totalQueries: 0,
  totalResults: 0,
  timings: {
    totalRunMs: 0,
    dbLoadQueriesMs: 0,
    dbInsertResultsMs: 0,
    dbCleanupMs: 0,
    searchTotalMs: 0
  },
  perQueryTimings: [],
  errors: []
};

/**
 * Clear image_url for all runs except the most recent one
 * This saves storage since we only need images for the current result set
 */
async function cleanupOldImageUrls() {
  const start = Date.now();
  const result = await pool.query(`
    UPDATE user_result
    SET url_image = NULL
    WHERE url_image IS NOT NULL
      AND ran_dt < (SELECT MAX(ran_dt) FROM user_result)
  `);
  metrics.timings.dbCleanupMs = Date.now() - start;
  if (result.rowCount > 0) {
    console.log(`Cleared ${result.rowCount} old image URLs`);
  }
}

/**
 * Save metrics to JSON file
 */
function saveMetrics(ranDt) {
  const timestamp = ranDt.toISOString().replace(/[:.]/g, '-');
  const filename = `query_metrics_${timestamp}.json`;
  const filepath = path.resolve(__dirname, '../../data', filename);

  // Ensure data directory exists
  const dataDir = path.dirname(filepath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Calculate summary stats
  const avgQueryTimeMs = metrics.perQueryTimings.length > 0
    ? metrics.perQueryTimings.reduce((sum, t) => sum + t.totalMs, 0) / metrics.perQueryTimings.length
    : 0;

  const avgSearchMs = metrics.perQueryTimings.length > 0
    ? metrics.perQueryTimings.reduce((sum, t) => sum + t.searchMs, 0) / metrics.perQueryTimings.length
    : 0;

  const avgDbInsertMs = metrics.perQueryTimings.length > 0
    ? metrics.perQueryTimings.reduce((sum, t) => sum + t.dbInsertMs, 0) / metrics.perQueryTimings.length
    : 0;

  const output = {
    runTimestamp: ranDt.toISOString(),
    summary: {
      totalQueries: metrics.totalQueries,
      totalResults: metrics.totalResults,
      serperApiCalls: searchMetrics.serperApiCalls,
      enrichmentPageFetches: searchMetrics.enrichmentPageFetches,
      errorCount: metrics.errors.length,
      totalRunMs: metrics.timings.totalRunMs,
      avgQueryTimeMs: Math.round(avgQueryTimeMs),
      avgSearchMs: Math.round(avgSearchMs),
      avgDbInsertMs: Math.round(avgDbInsertMs)
    },
    timings: metrics.timings,
    perQueryTimings: metrics.perQueryTimings,
    errors: metrics.errors
  };

  fs.writeFileSync(filepath, JSON.stringify(output, null, 2));
  console.log(`\nMetrics saved to: ${filepath}`);
}

async function run() {
  const runStart = Date.now();
  const ranDt = new Date();
  metrics.ranDt = ranDt.toISOString();
  console.log(`Run timestamp: ${ranDt.toISOString()}`);

  // Reset search metrics counters
  searchMetrics.reset();

  // Load all user queries
  const dbLoadStart = Date.now();
  const { rows: queries } = await pool.query(
    'SELECT id, name_first, name_middle, name_last, age_apx, city, state, key_words FROM user_query WHERE disabled = false ORDER BY name_last, name_first'
  );
  metrics.timings.dbLoadQueriesMs = Date.now() - dbLoadStart;
  metrics.totalQueries = queries.length;
  console.log(`Found ${queries.length} queries to run\n`);

  let totalResults = 0;
  let totalSearchMs = 0;
  let totalEnrichMs = 0;
  let totalDbInsertMs = 0;

  for (let i = 0; i < queries.length; i++) {
    const queryStart = Date.now();
    const q = queries[i];
    const label = `${q.name_first} ${q.name_last}`;

    const query = {
      firstName: q.name_first,
      lastName: q.name_last,
      middleName: q.name_middle || undefined,
      city: q.city || undefined,
      state: q.state || undefined,
      age: q.age_apx || undefined,
      keyWords: q.key_words || undefined
    };

    const queryMetrics = {
      index: i + 1,
      name: label,
      searchMs: 0,
      dbInsertMs: 0,
      totalMs: 0,
      resultCount: 0
    };

    try {
      // Track search time (includes provider API call + enrichment)
      const searchStart = Date.now();

      const { results } = await searchObits(query);

      queryMetrics.searchMs = Date.now() - searchStart;

      // Track DB insert time
      const dbInsertStart = Date.now();
      for (const r of results) {
        await pool.query(
          `INSERT INTO user_result (
            id, user_query_id, ran_dt, name_full, name_first, name_last, age_years,
            dod, date_visitation, date_funeral, city, state, source, url, snippet,
            score, reasons, fingerprint, type_provider, also_found_at,
            scores_criteria, score_final, score_max, criteria_cnt, rank, url_image
          ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26
          )`,
          [
            uuidv4(), q.id, ranDt,
            r.nameFull || null, r.nameFirst || null, r.nameLast || null, r.ageYears || null,
            r.dod || null, r.dateVisitation || null, r.dateFuneral || null,
            r.city || null, r.state || null, r.source || null, r.url || null, r.snippet || null,
            r.score || 0, JSON.stringify(r.reasons || []),
            r.fingerprint || null, r.typeProvider || null,
            r.alsoFoundAt ? JSON.stringify(r.alsoFoundAt) : null,
            r.scoresCriteria ? JSON.stringify(r.scoresCriteria) : null,
            r.scoreFinal || null, r.scoreMax || null, r.criteriaCnt || null, r.rank || null,
            r.urlImage || null
          ]
        );
      }
      queryMetrics.dbInsertMs = Date.now() - dbInsertStart;

      queryMetrics.resultCount = results.length;
      queryMetrics.totalMs = Date.now() - queryStart;

      totalResults += results.length;
      totalSearchMs += queryMetrics.searchMs;
      totalDbInsertMs += queryMetrics.dbInsertMs;

      const timeInfo = `${queryMetrics.totalMs}ms (search:${queryMetrics.searchMs}ms, db:${queryMetrics.dbInsertMs}ms)`;
      console.log(`  [${i + 1}/${queries.length}] ${label}: ${results.length} results - ${timeInfo}`);
    } catch (err) {
      queryMetrics.totalMs = Date.now() - queryStart;
      queryMetrics.error = err.message;
      metrics.errors.push({ index: i + 1, name: label, error: err.message });
      console.error(`  [${i + 1}/${queries.length}] ${label}: ERROR - ${err.message}`);
    }

    metrics.perQueryTimings.push(queryMetrics);
  }

  metrics.totalResults = totalResults;
  metrics.timings.searchTotalMs = totalSearchMs;
  metrics.timings.dbInsertResultsMs = totalDbInsertMs;

  console.log(`\nDone. ${totalResults} results inserted with ran_dt = ${ranDt.toISOString()}`);
  console.log(`Serper API calls: ${searchMetrics.serperApiCalls}`);
  console.log(`Page fetches (enrichment): ${searchMetrics.enrichmentPageFetches}`);

  // Clean up old image URLs to save storage
  await cleanupOldImageUrls();

  metrics.timings.totalRunMs = Date.now() - runStart;

  // Save metrics to file
  saveMetrics(ranDt);
}

run()
  .catch(err => { console.error('Failed:', err); process.exit(1); })
  .finally(() => close());
