#!/usr/bin/env node
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { normalizeQuery } = require('../src/index');
const { serperProvider } = require('../src/providers/serper/SerperProvider');
const { scoreAndRankCandidates, scoreCandidateWithCriteria } = require('../src/scoring/criteriaScore');
const { deduplicateCandidates } = require('../src/dedupe/dedupe');

async function main() {
  const query = {
    firstName: 'Ann',
    lastName: 'Lander',
    middleName: 'Marie',
    city: 'Houghton',
    state: 'NY',
    age: 78
  };

  const normalized = normalizeQuery(query);

  // Get raw results from Serper
  const rawResults = await serperProvider.search(normalized);

  console.log(`\n=== RAW FROM SERPER: ${rawResults.length} results ===\n`);
  for (let i = 0; i < rawResults.length; i++) {
    const r = rawResults[i];
    console.log(`[${i+1}] ${r.nameFull}`);
    console.log(`    nameFirst="${r.nameFirst}" nameLast="${r.nameLast}"`);
    console.log(`    URL: ${r.url}`);
    console.log(`    Snippet: ${(r.snippet || '').substring(0, 120)}`);
    console.log('');
  }

  // Dedup
  const deduped = deduplicateCandidates(rawResults);
  console.log(`=== AFTER DEDUP: ${deduped.length} results ===\n`);

  // Score each one individually (before the nameFirst filter)
  console.log('=== SCORING EACH CANDIDATE ===\n');
  for (let i = 0; i < deduped.length; i++) {
    const scored = scoreCandidateWithCriteria(deduped[i], normalized);
    const sc = scored.scoresCriteria;
    const pass = sc.nameFirst === null || sc.nameFirst > 0;
    console.log(`[${i+1}] ${scored.nameFull} => ${scored.scoreFinal}/${scored.scoreMax} ${pass ? 'PASS' : '** FILTERED **'}`);
    console.log(`    nameFirst=${sc.nameFirst} nameLast=${sc.nameLast} city=${sc.city} state=${sc.state} age=${sc.age}`);
    console.log(`    URL: ${scored.url}`);
    console.log('');
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
