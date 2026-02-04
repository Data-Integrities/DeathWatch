#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const { Command } = require('commander');
const { searchObits, normalizeQuery } = require('../index');
const { exclusionStore } = require('../data/ExclusionStore');
const { formatCandidate } = require('../scoring/explain');
const { logger, LogLevel } = require('../utils/logger');

const program = new Command();

program
  .name('obit-search')
  .description('DeathWatch Obituary Search Engine')
  .version('1.0.0');

// Search command
program
  .command('search')
  .description('Search for obituaries')
  .requiredOption('--first <name>', 'First name')
  .requiredOption('--last <name>', 'Last name')
  .option('--middle <name>', 'Middle name')
  .option('--city <city>', 'City')
  .option('--state <state>', 'State (2-letter code or full name)')
  .option('--age <age>', 'Approximate age', parseInt)
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    if (options.verbose) {
      logger.setLevel(LogLevel.DEBUG);
    }

    const query = {
      firstName: options.first,
      lastName: options.last,
      middleName: options.middle,
      city: options.city,
      state: options.state,
      age: options.age
    };

    console.log('\nSearching for obituaries...\n');

    try {
      const { results, searchKey } = await searchObits(query);

      console.log(`Search Key: ${searchKey}`);
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
      searchKey = normalized.searchKey;
    }

    try {
      const { exclusion, isNew } = exclusionStore.add({
        searchKey,
        excludedFingerprint: options.fingerprint,
        excludedUrl: options.url,
        excludedName: options.name,
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
      if (exclusion.searchKey) {
        console.log(`  Search Key: ${exclusion.searchKey}`);
      }
      if (exclusion.excludedFingerprint) {
        console.log(`  Fingerprint: ${exclusion.excludedFingerprint}`);
      }
      if (exclusion.excludedUrl) {
        console.log(`  URL: ${exclusion.excludedUrl}`);
      }
      if (exclusion.excludedName) {
        console.log(`  Name: ${exclusion.excludedName}`);
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
      exclusions = exclusionStore.getAll();
      title = 'All Exclusions';
    } else if (options.global) {
      exclusions = exclusionStore.getGlobalExclusions();
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
      exclusions = exclusionStore.getBySearchKey(normalized.searchKey);
      title = `Exclusions for Search Key: ${normalized.searchKey}`;
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
      if (ex.searchKey) {
        console.log(`  Search Key: ${ex.searchKey}`);
      }
      if (ex.excludedFingerprint) {
        console.log(`  Fingerprint: ${ex.excludedFingerprint}`);
      }
      if (ex.excludedName) {
        console.log(`  Name: ${ex.excludedName}`);
      }
      if (ex.excludedUrl) {
        console.log(`  URL: ${ex.excludedUrl}`);
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
    const stats = exclusionStore.getStats();

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
    const success = exclusionStore.remove(options.id);

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
  .requiredOption('--file <path>', 'Results JSON file to review')
  .option('--start <index>', 'Start from this query index (0-based)', parseInt, 0)
  .action(async (options) => {
    const readline = require('readline');

    // Read results file
    let results;
    try {
      const data = fs.readFileSync(options.file, 'utf-8');
      results = JSON.parse(data);
    } catch (err) {
      console.error(`Error reading file: ${err.message}`);
      process.exit(1);
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
      console.log(`  Search Key: ${queryResult.searchKey}`);
      console.log(`  Results: ${queryResult.resultCount}`);
      console.log(`========================================`);

      if (queryResult.results.length === 0) {
        console.log('  No results to review.');
        continue;
      }

      for (let ri = 0; ri < queryResult.results.length; ri++) {
        const result = queryResult.results[ri];

        console.log(`\n--- Result ${ri + 1} (Rank #${result.rank}) ---`);
        console.log(`  Name: ${result.fullName}`);
        console.log(`  Score: ${result.finalScore}/${result.maxPossible}`);
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

          const { exclusion, isNew } = exclusionStore.add({
            searchKey: queryResult.searchKey,
            excludedFingerprint: result.fingerprint,
            excludedUrl: result.url,
            excludedName: result.fullName,
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
  .option('--output-dir <dir>', 'Output directory for results (default: data/)')
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

    const batchResults = [];
    let processed = 0;
    let found = 0;

    for (const person of people) {
      // Validate required fields
      if (!person.firstName || !person.lastName) {
        console.error(`Skipping invalid entry (missing firstName or lastName): ${JSON.stringify(person)}`);
        continue;
      }

      const query = {
        firstName: person.firstName,
        lastName: person.lastName,
        middleName: person.middleName,
        city: person.city,
        state: person.state,
        age: person.apxAge  // Map apxAge to age
      };

      try {
        const { results, searchKey } = await searchObits(query);

        batchResults.push({
          query: person,
          searchKey,
          resultCount: results.length,
          results
        });

        processed++;
        if (results.length > 0) found++;

        console.error(`  [${processed}/${people.length}] ${person.firstName} ${person.lastName}: ${results.length} results`);
      } catch (err) {
        console.error(`  Error searching for ${person.firstName} ${person.lastName}: ${err.message}`);
        batchResults.push({
          query: person,
          error: err.message,
          resultCount: 0,
          results: []
        });
        processed++;
      }
    }

    console.error(`\nCompleted: ${processed} searched, ${found} with results`);

    // Generate output filename with datetime stamp
    const now = new Date();
    const timestamp = now.toISOString()
      .replace(/[-:]/g, '')
      .replace('T', '-')
      .replace(/\.\d{3}Z$/, '');
    const outputDir = options.outputDir || 'data';
    const outputPath = `${outputDir}/results-${timestamp}.json`;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write results
    const output = JSON.stringify(batchResults, null, 2);
    try {
      fs.writeFileSync(outputPath, output);
      console.error(`Results written to: ${outputPath}`);
    } catch (err) {
      console.error(`Error writing output file: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
