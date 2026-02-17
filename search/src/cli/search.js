#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const { Command } = require('commander');
const { searchObits, normalizeQuery } = require('../index');
const { exclusionStore } = require('../data/ExclusionStore');
const { batchStore } = require('../db/BatchStore');
const { formatCandidate } = require('../scoring/explain');
const { logger, LogLevel } = require('../utils/logger');
const { close: closePool } = require('../db/pool');

const program = new Command();

program
  .name('obit-search')
  .description('DeathWatch Obituary Search Engine')
  .version('1.0.0');

// Search command
program
  .command('search')
  .description('Search for obituaries')
  .option('--first <name>', 'First name')
  .option('--nickname <name>', 'Nickname (used in OR clause with first name)')
  .requiredOption('--last <name>', 'Last name')
  .option('--middle <name>', 'Middle name')
  .option('--city <city>', 'City')
  .option('--state <state>', 'State (2-letter code or full name)')
  .option('--age <age>', 'Approximate age', parseInt)
  .option('--keywords <words>', 'Comma-separated keywords to match in results')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    if (options.verbose) {
      logger.setLevel(LogLevel.DEBUG);
    }

    if (!options.first && !options.nickname) {
      console.error('Error: Must provide --first or --nickname (or both)');
      process.exit(1);
    }

    const query = {
      firstName: options.first,
      lastName: options.last,
      middleName: options.middle,
      nickname: options.nickname,
      city: options.city,
      state: options.state,
      age: options.age,
      keyWords: options.keywords
    };

    console.log('\nSearching for obituaries...\n');

    try {
      const { results, keySearch } = await searchObits(query);

      console.log(`Search Key: ${keySearch}`);
      console.log(`Found ${results.length} results\n`);

      if (results.length === 0) {
        console.log('No obituaries found matching your criteria.');
        return;
      }

      for (let i = 0; i < results.length; i++) {
        console.log(formatCandidate(results[i], i));
      }

      console.log('\n---');
      console.log('To exclude a false positive, use:');
      console.log(`  obit-search exclude --first ${options.first} --last ${options.last}${options.city ? ` --city "${options.city}"` : ''}${options.state ? ` --state ${options.state}` : ''}${options.age ? ` --age ${options.age}` : ''} --fingerprint "<fingerprint>"`);
    } catch (err) {
      console.error('Search failed:', err);
      process.exit(1);
    }
  });

// Exclude command
program
  .command('exclude')
  .description('Exclude a false positive result from future searches')
  .option('--first <name>', 'First name (required for per-query)')
  .option('--last <name>', 'Last name (required for per-query)')
  .option('--middle <name>', 'Middle name')
  .option('--city <city>', 'City')
  .option('--state <state>', 'State')
  .option('--age <age>', 'Approximate age', parseInt)
  .option('--fingerprint <fp>', 'Fingerprint of the result to exclude')
  .option('--url <url>', 'URL of the excluded result')
  .option('--name <name>', 'Name shown in the excluded result')
  .option('--reason <reason>', 'Reason for exclusion')
  .option('--global', 'Make this a global exclusion (applies to all searches)')
  .action(async (options) => {
    // Validate: need fingerprint or url
    if (!options.fingerprint && !options.url) {
      console.error('Error: Must provide --fingerprint or --url');
      process.exit(1);
    }

    // For per-query exclusions, need first/last name
    if (!options.global && (!options.first || !options.last)) {
      console.error('Error: Must provide --first and --last for per-query exclusions, or use --global');
      process.exit(1);
    }

    let searchKey = null;
    if (!options.global) {
      const query = {
        firstName: options.first,
        lastName: options.last,
        middleName: options.middle,
        city: options.city,
        state: options.state,
        age: options.age
      };
      const normalized = normalizeQuery(query);
      searchKey = normalized.keySearch;
    }

    try {
      const { exclusion, isNew } = await exclusionStore.add({
        keySearch: searchKey,
        fingerprintExcluded: options.fingerprint,
        urlExcluded: options.url,
        nameExcluded: options.name,
        reason: options.reason,
        scope: options.global ? 'global' : 'per-query'
      });

      if (isNew) {
        console.log('\nExclusion added successfully:');
      } else {
        console.log('\nExclusion already exists:');
      }
      console.log(`  ID: ${exclusion.id}`);
      console.log(`  Scope: ${exclusion.scope}`);
      if (exclusion.keySearch) {
        console.log(`  Search Key: ${exclusion.keySearch}`);
      }
      if (exclusion.fingerprintExcluded) {
        console.log(`  Fingerprint: ${exclusion.fingerprintExcluded}`);
      }
      if (exclusion.urlExcluded) {
        console.log(`  URL: ${exclusion.urlExcluded}`);
      }
      if (exclusion.nameExcluded) {
        console.log(`  Name: ${exclusion.nameExcluded}`);
      }
      console.log(`  Created: ${exclusion.createdAt}`);
    } catch (err) {
      console.error('Failed to add exclusion:', err);
      process.exit(1);
    }
  });

// List exclusions command
program
  .command('exclusions')
  .description('List exclusions for a search or all global exclusions')
  .option('--first <name>', 'First name')
  .option('--last <name>', 'Last name')
  .option('--middle <name>', 'Middle name')
  .option('--city <city>', 'City')
  .option('--state <state>', 'State')
  .option('--age <age>', 'Approximate age', parseInt)
  .option('--global', 'Show only global exclusions')
  .option('--all', 'Show all exclusions')
  .action(async (options) => {
    let exclusions = [];
    let title = '';

    if (options.all) {
      exclusions = await exclusionStore.getAll();
      title = 'All Exclusions';
    } else if (options.global) {
      exclusions = await exclusionStore.getGlobalExclusions();
      title = 'Global Exclusions';
    } else if (options.first && options.last) {
      const query = {
        firstName: options.first,
        lastName: options.last,
        middleName: options.middle,
        city: options.city,
        state: options.state,
        age: options.age
      };
      const normalized = normalizeQuery(query);
      exclusions = await exclusionStore.getByKeySearch(normalized.keySearch);
      title = `Exclusions for Search Key: ${normalized.keySearch}`;
    } else {
      console.error('Error: Provide --first and --last, or use --global or --all');
      process.exit(1);
    }

    console.log(`\n${title}`);
    console.log(`Found ${exclusions.length} exclusion(s)\n`);

    if (exclusions.length === 0) {
      console.log('No exclusions found.');
      return;
    }

    for (const ex of exclusions) {
      console.log(`--- Exclusion ---`);
      console.log(`  ID: ${ex.id}`);
      console.log(`  Scope: ${ex.scope || 'per-query'}`);
      if (ex.keySearch) {
        console.log(`  Search Key: ${ex.keySearch}`);
      }
      if (ex.fingerprintExcluded) {
        console.log(`  Fingerprint: ${ex.fingerprintExcluded}`);
      }
      if (ex.nameExcluded) {
        console.log(`  Name: ${ex.nameExcluded}`);
      }
      if (ex.urlExcluded) {
        console.log(`  URL: ${ex.urlExcluded}`);
      }
      if (ex.reason) {
        console.log(`  Reason: ${ex.reason}`);
      }
      console.log(`  Created: ${ex.createdAt}`);
      console.log('');
    }
  });

// Exclusion stats command
program
  .command('exclusion-stats')
  .description('Show exclusion statistics')
  .action(async () => {
    const stats = await exclusionStore.getStats();

    console.log('\n=== Exclusion Statistics ===\n');
    console.log(`Total exclusions: ${stats.total}`);
    console.log(`  Global: ${stats.global}`);
    console.log(`  Per-query: ${stats.perQuery}`);
    console.log('\nBy reason:');

    const reasons = Object.entries(stats.byReason).sort((a, b) => b[1] - a[1]);
    if (reasons.length === 0) {
      console.log('  (none)');
    } else {
      for (const [reason, count] of reasons) {
        console.log(`  ${reason}: ${count}`);
      }
    }
  });

// Unexclude command
program
  .command('unexclude')
  .description('Remove an exclusion by ID')
  .requiredOption('--id <id>', 'Exclusion ID to remove')
  .action(async (options) => {
    const success = await exclusionStore.remove(options.id);

    if (success) {
      console.log(`\nExclusion ${options.id} removed successfully.`);
    } else {
      console.log(`\nExclusion ${options.id} not found.`);
      process.exit(1);
    }
  });

// Interactive review command
program
  .command('review')
  .description('Interactively review results and mark false positives')
  .option('--file <path>', 'Results JSON file to review')
  .option('--batch <id>', 'Batch ID to review (from database)')
  .option('--start <index>', 'Start from this query index (0-based)', parseInt, 0)
  .action(async (options) => {
    const readline = require('readline');

    if (!options.file && !options.batch) {
      console.error('Error: Must provide --file or --batch');
      process.exit(1);
    }

    // Load results from file or database
    let results;
    if (options.batch) {
      const batch = await batchStore.getBatch(options.batch);
      if (!batch) {
        console.error(`Batch not found: ${options.batch}`);
        process.exit(1);
      }
      results = batch.queries;
      console.log(`Loaded batch ${batch.id} (${batch.totalQueries} queries)`);
    } else {
      try {
        const data = fs.readFileSync(options.file, 'utf-8');
        results = JSON.parse(data);
      } catch (err) {
        console.error(`Error reading file: ${err.message}`);
        process.exit(1);
      }
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    console.log('\n=== Interactive Review Mode ===');
    console.log('Commands: [y]es/correct, [n]o/exclude, [s]kip, [g]lobal exclude, [q]uit\n');

    for (let qi = options.start; qi < results.length; qi++) {
      const queryResult = results[qi];
      const query = queryResult.query;

      console.log(`\n========================================`);
      console.log(`Query ${qi + 1}/${results.length}: ${query.firstName} ${query.lastName}`);
      if (query.city || query.state) console.log(`  Location: ${query.city || '?'}, ${query.state || '?'}`);
      if (query.apxAge) console.log(`  Age: ${query.apxAge}`);
      console.log(`  Search Key: ${queryResult.keySearch}`);
      console.log(`  Results: ${queryResult.resultCount}`);
      console.log(`========================================`);

      if (queryResult.results.length === 0) {
        console.log('  No results to review.');
        continue;
      }

      for (let ri = 0; ri < queryResult.results.length; ri++) {
        const result = queryResult.results[ri];

        console.log(`\n--- Result ${ri + 1} (Rank #${result.rank}) ---`);
        console.log(`  Name: ${result.nameFull}`);
        console.log(`  Score: ${result.scoreFinal}/${result.scoreMax}`);
        if (result.ageYears) console.log(`  Age: ${result.ageYears}`);
        if (result.city || result.state) console.log(`  Location: ${result.city || '?'}, ${result.state || '?'}`);
        console.log(`  URL: ${result.url}`);
        if (result.snippet) {
          const snip = result.snippet.length > 100 ? result.snippet.slice(0, 97) + '...' : result.snippet;
          console.log(`  Snippet: ${snip}`);
        }
        console.log(`  Fingerprint: ${result.fingerprint}`);

        const answer = await ask('\n  Is this correct? [y/n/s/g/q]: ');
        const cmd = answer.trim().toLowerCase();

        if (cmd === 'q' || cmd === 'quit') {
          console.log('\nExiting review.');
          rl.close();
          return;
        }

        if (cmd === 's' || cmd === 'skip') {
          continue;
        }

        if (cmd === 'y' || cmd === 'yes') {
          console.log('  Marked as correct.');
          break; // Move to next query
        }

        if (cmd === 'n' || cmd === 'no' || cmd === 'g' || cmd === 'global') {
          const isGlobal = cmd === 'g' || cmd === 'global';
          const reason = await ask('  Reason (optional): ');

          const { exclusion, isNew } = await exclusionStore.add({
            keySearch: queryResult.keySearch,
            fingerprintExcluded: result.fingerprint,
            urlExcluded: result.url,
            nameExcluded: result.nameFull,
            reason: reason.trim() || 'false positive',
            scope: isGlobal ? 'global' : 'per-query'
          });

          if (isNew) {
            console.log(`  Excluded (${isGlobal ? 'global' : 'per-query'}): ${exclusion.id}`);
          } else {
            console.log(`  Already excluded: ${exclusion.id}`);
          }
        }
      }
    }

    console.log('\nReview complete.');
    rl.close();
  });

// Batch command
program
  .command('batch')
  .description('Search for multiple people from a JSON file')
  .requiredOption('--file <path>', 'Input JSON file with array of people to search')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    if (options.verbose) {
      logger.setLevel(LogLevel.DEBUG);
    }

    // Read input file
    let people;
    try {
      const data = fs.readFileSync(options.file, 'utf-8');
      people = JSON.parse(data);
      if (!Array.isArray(people)) {
        console.error('Error: Input file must contain a JSON array');
        process.exit(1);
      }
    } catch (err) {
      console.error(`Error reading input file: ${err.message}`);
      process.exit(1);
    }

    console.error(`Processing ${people.length} people...`);

    // Create batch in DB
    const batch = await batchStore.createBatch(options.file);
    let processed = 0;
    let found = 0;

    for (const person of people) {
      // Validate required fields
      if ((!person.firstName && !person.nickname) || !person.lastName) {
        console.error(`Skipping invalid entry (missing firstName/nickname or lastName): ${JSON.stringify(person)}`);
        continue;
      }

      const query = {
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
        nickname: person.nickname,
        city: person.city,
        state: person.state,
        age: person.apxAge,  // Map apxAge to age
        keyWords: person.keyWords
      };

      try {
        const { results, keySearch } = await searchObits(query);

        await batchStore.addQuery(batch.id, person, keySearch, results, null);

        processed++;
        if (results.length > 0) found++;

        const displayFirst = person.firstName || person.nickname;
        console.error(`  [${processed}/${people.length}] ${displayFirst} ${person.lastName}: ${results.length} results`);
      } catch (err) {
        const displayFirst = person.firstName || person.nickname;
        console.error(`  Error searching for ${displayFirst} ${person.lastName}: ${err.message}`);
        await batchStore.addQuery(batch.id, person, '', [], err.message);
        processed++;
      }
    }

    await batchStore.finalizeBatch(batch.id);

    console.error(`\nCompleted: ${processed} searched, ${found} with results`);
    console.error(`Batch ID: ${batch.id}`);

    await closePool();
  });

program.parse();
