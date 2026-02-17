#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('./pool');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sqlPath = path.join(__dirname, 'migrations', '003_rename_columns.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by semicolon and run each statement
  const statements = sql.split(';').filter(s => {
    const trimmed = s.trim();
    return trimmed && !trimmed.startsWith('--');
  });

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const stmt of statements) {
    const cleanStmt = stmt.trim();
    if (!cleanStmt) continue;

    // Skip the age_years rename (already correct)
    if (cleanStmt.includes('age_years TO age_years')) {
      console.log('Skipping: age_years (already correct)');
      skipped++;
      continue;
    }

    try {
      await pool.query(cleanStmt);
      // Extract what we renamed
      const match = cleanStmt.match(/RENAME (?:COLUMN |TO )(\w+)/i);
      if (match) console.log('OK:', match[1]);
      success++;
    } catch (err) {
      // Column might already be renamed
      if (err.message.includes('does not exist')) {
        console.log('Already done:', err.message.match(/column "(\w+)"/)?.[1] || 'unknown');
        skipped++;
      } else {
        console.log('Error:', err.message.substring(0, 80));
        errors++;
      }
    }
  }

  await pool.end();
  console.log(`\nMigration complete: ${success} success, ${skipped} skipped, ${errors} errors`);
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
