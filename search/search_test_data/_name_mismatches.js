#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { pool, close } = require('../src/db/pool');

async function main() {
  const batchId = 'ec0cfddc-2889-4661-ac6a-2be375d3715c';
  const { rows } = await pool.query(`
    SELECT
      q.name_first AS q_first, q.name_last AS q_last, q.city AS q_city, q.state AS q_state, q.age_apx AS q_age,
      r.name_first AS r_first, r.name_last AS r_last, r.name_full AS r_full,
      r.fingerprint, r.url, r.source, r.snippet,
      r.score_final, r.score_max, r.criteria_cnt, r.scores_criteria,
      r.dod, r.rank
    FROM queries q
    LEFT JOIN results r ON r.query_id = q.id AND r.rank = 1
    WHERE q.batch_id = $1
      AND (
        r.name_last IS NULL
        OR LOWER(r.name_last) != LOWER(q.name_last)
        OR r.score_final IS NULL
      )
    ORDER BY q.name_last, q.name_first
  `, [batchId]);

  for (const r of rows) {
    console.log('========================================');
    console.log('INPUT:    ' + r.q_first + ' ' + r.q_last + ' | ' + (r.q_city || '') + ', ' + (r.q_state || '') + ' | age: ' + (r.q_age || 'n/a'));
    if (!r.r_last) {
      console.log('RESULT:   NO RANK-1 RESULT');
    } else {
      console.log('RESULT:   ' + (r.r_full || r.r_first + ' ' + r.r_last));
      console.log('EXTRACT:  first="' + r.r_first + '" last="' + r.r_last + '"');
      console.log('FINGER:   ' + r.fingerprint);
      console.log('DOD:      ' + (r.dod || 'unknown'));
      console.log('SCORE:    ' + r.score_final + '/' + r.score_max + ' (criteria: ' + JSON.stringify(r.scores_criteria) + ')');
      console.log('SOURCE:   ' + r.source);
      console.log('URL:      ' + r.url);
      console.log('SNIPPET:  ' + (r.snippet || '').substring(0, 300));
    }
  }
  console.log('========================================');
  console.log('Total mismatches: ' + rows.length);
  await close();
}
main().catch(e => { console.error(e); process.exit(1); });
