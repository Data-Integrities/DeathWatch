#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('./pool');

async function analyze(firstName, lastName) {
  const { rows: runs } = await pool.query('SELECT ran_dt FROM user_result ORDER BY ran_dt DESC LIMIT 1');
  if (runs.length === 0) {
    console.log('No results found');
    return;
  }
  const ranDt = runs[0].ran_dt;

  const { rows } = await pool.query(`
    SELECT ur.rank, ur.full_name, ur.first_name, ur.last_name, ur.dod,
           ur.city, ur.state, ur.final_score, ur.max_possible, ur.criteria_scores,
           ur.url, ur.snippet,
           uq.first_name as q_first, uq.last_name as q_last, uq.city as q_city,
           uq.state as q_state, uq.apx_age as q_age
    FROM user_result ur
    JOIN user_query uq ON ur.user_query_id = uq.id
    WHERE ur.ran_dt = $1
      AND uq.first_name = $2 AND uq.last_name = $3
    ORDER BY ur.rank
    LIMIT 10
  `, [ranDt, firstName, lastName]);

  if (rows.length === 0) {
    console.log(`No results for ${firstName} ${lastName}`);
    return;
  }

  const q = rows[0];
  console.log(`Query: ${q.q_first} ${q.q_last} (${q.q_city}, ${q.q_state}, age ${q.q_age})\n`);

  for (const r of rows) {
    console.log(`Rank ${r.rank}: ${r.full_name}`);
    console.log(`  Score: ${r.final_score}/${r.max_possible}`);
    console.log(`  DOD: ${r.dod ? r.dod.toISOString().split('T')[0] : 'null'}`);
    console.log(`  Location: ${r.city}, ${r.state}`);
    console.log(`  Criteria: ${JSON.stringify(r.criteria_scores)}`);
    console.log(`  URL: ${r.url}`);
    console.log(`  Snippet: ${(r.snippet || '').substring(0, 120)}...`);
    console.log();
  }

  await pool.end();
}

const firstName = process.argv[2] || 'Michael';
const lastName = process.argv[3] || 'Abramek';
analyze(firstName, lastName).catch(err => {
  console.error(err);
  pool.end();
});
