#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { pool } = require('./pool');

async function show() {
  const r = await pool.query(`
    SELECT uq.name_first, uq.name_last, uq.city AS q_city, uq.state AS q_state,
           ur.name_full, ur.score_final, ur.score_max, ur.rank, ur.dod, ur.url,
           ur.city, ur.state, ur.age_years
    FROM user_result ur
    JOIN user_query uq ON ur.user_query_id = uq.id
    WHERE ur.ran_dt = (SELECT MAX(ran_dt) FROM user_result)
    ORDER BY uq.name_last, ur.rank
  `);

  console.log('Latest results (' + r.rows.length + ' total):\n');

  let currentQuery = '';
  for (const row of r.rows) {
    const queryName = row.name_first + ' ' + row.name_last;
    if (queryName !== currentQuery) {
      console.log('=== ' + queryName + ' (' + row.q_city + ', ' + row.q_state + ') ===');
      currentQuery = queryName;
    }

    const dod = row.dod ? row.dod.toISOString().split('T')[0] : '-';
    console.log('  #' + row.rank + ' ' + row.name_full + ' | ' + row.score_final + '/' + row.score_max + ' | Age: ' + (row.age_years || '?') + ' | DOD: ' + dod);
    console.log('      ' + (row.city || '?') + ', ' + (row.state || '?') + ' | ' + row.url);
  }

  await pool.end();
}

show().catch(e => { console.error(e); pool.end(); });
