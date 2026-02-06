#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, close } = require('./pool');

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration(s)`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');

    console.log(`Running: ${file}...`);
    try {
      await pool.query(sql);
      console.log(`  OK`);
    } catch (err) {
      if (err.code === '42P07') {
        // relation already exists - skip
        console.log(`  Already exists (skipped)`);
      } else {
        console.error(`  FAILED: ${err.message}`);
        throw err;
      }
    }
  }

  console.log('Migration complete.');
}

migrate()
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  })
  .finally(() => close());
