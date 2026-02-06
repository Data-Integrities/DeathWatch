#!/usr/bin/env node
/**
 * Load name variants from CSV into database
 * Run: node src/db/load-name-variants.js
 */
require('dotenv').config();
const { pool } = require('./pool');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    // Run migration
    console.log('Creating table...');
    const sqlPath = path.join(__dirname, 'migrations', '002_name_variants.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('Table name_first_variant created');

    // Load CSV data
    console.log('Loading CSV data...');
    const csvPath = path.join(__dirname, '..', '..', 'data', 'nicknames-dataset.csv');
    const csv = fs.readFileSync(csvPath, 'utf8');
    const lines = csv.trim().split('\n').slice(1); // skip header

    let count = 0;
    for (const line of lines) {
      const [formal, rel, variant] = line.split(',');
      if (formal && variant) {
        await pool.query(
          'INSERT INTO name_first_variant (formal_name, variant_name) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [formal.toLowerCase().trim(), variant.toLowerCase().trim()]
        );
        count++;
      }
    }

    console.log(`Loaded ${count} entries`);

    // Show stats
    const { rows: stats } = await pool.query('SELECT COUNT(*) as total, COUNT(DISTINCT formal_name) as formal_count FROM name_first_variant');
    console.log(`Total rows: ${stats[0].total}, Unique formal names: ${stats[0].formal_count}`);

    // Show sample
    const { rows } = await pool.query(`
      SELECT * FROM name_first_variant
      WHERE formal_name = 'james' OR variant_name = 'jim'
      ORDER BY formal_name, variant_name
    `);
    console.log('\nSample (james/jim):');
    rows.forEach(r => console.log(`  ${r.formal_name} -> ${r.variant_name}`));

  } catch (err) {
    console.error('Error:', err.message);
    if (err.code === '42P07') {
      console.log('Table already exists - skipping creation');
    }
  } finally {
    await pool.end();
  }
}

run();
