#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const path = require('path');
const { pool } = require('../db/pool');

const PORT = 3001;
const app = express();
app.use(express.json());

// Serve static files from client-user
app.use(express.static(path.resolve(__dirname, '../../../client-user/public')));

// Get results in the format the viewer expects
app.get('/api/results', async (req, res) => {
  try {
    // Get the latest ran_dt
    const latestRun = await pool.query('SELECT MAX(ran_dt) as ran_dt FROM user_result');
    const ranDt = latestRun.rows[0].ran_dt;

    if (!ranDt) {
      return res.json([]);
    }

    // Get all queries that have results for this run
    const queries = await pool.query(`
      SELECT DISTINCT ON (uq.id) uq.id, uq.name_first, uq.name_middle, uq.name_last, uq.age_apx, uq.city, uq.state
      FROM user_query uq
      JOIN user_result ur ON ur.user_query_id = uq.id
      WHERE ur.ran_dt = $1
      ORDER BY uq.id, uq.name_last, uq.name_first
    `, [ranDt]);

    const results = [];

    for (const q of queries.rows) {
      const resultRows = await pool.query(`
        SELECT * FROM user_result
        WHERE user_query_id = $1 AND ran_dt = $2
        ORDER BY rank ASC NULLS LAST
      `, [q.id, ranDt]);

      results.push({
        query: {
          firstName: q.name_first,
          middleName: q.name_middle,
          lastName: q.name_last,
          apxAge: q.age_apx,
          city: q.city,
          state: q.state
        },
        keySearch: q.id,
        resultCnt: resultRows.rows.length,
        results: resultRows.rows.map(r => ({
          id: r.id,
          nameFull: r.name_full,
          nameFirst: r.name_first,
          nameLast: r.name_last,
          ageYears: r.age_years,
          dod: r.dod ? r.dod.toISOString().split('T')[0] : null,
          dateVisitation: r.date_visitation ? r.date_visitation.toISOString().split('T')[0] : null,
          dateFuneral: r.date_funeral ? r.date_funeral.toISOString().split('T')[0] : null,
          city: r.city,
          state: r.state,
          source: r.source,
          url: r.url,
          snippet: r.snippet,
          fingerprint: r.fingerprint,
          typeProvider: r.type_provider,
          scoresCriteria: r.scores_criteria,
          scoreFinal: r.score_final,
          scoreMax: r.score_max,
          criteriaCnt: r.criteria_cnt,
          rank: r.rank,
          urlImage: r.url_image
        }))
      });
    }

    res.json(results);
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`User Results Viewer running at http://localhost:${PORT}`);
});
