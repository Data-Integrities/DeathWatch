#!/usr/bin/env node
require('dotenv').config();
const { pool } = require('./pool');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const sqlPath = path.join(__dirname, 'migrations', '005_add_nickname.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const statements = sql.split(';').filter(s => {
    const trimmed = s.trim();
    return trimmed && !trimmed.startsWith('--');
  });

  let success = 0;
  let skipped = 0;

  for (const stmt of statements) {
    const cleanStmt = stmt.trim();
    if (!cleanStmt) continue;

    try {
      await pool.query(cleanStmt);
      console.log('OK:', cleanStmt.substring(0, 60));
      success++;
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log('Already done:', cleanStmt.substring(0, 60));
        skipped++;
      } else {
        console.error('Error:', err.message);
      }
    }
  }

  await pool.end();
  console.log(`\nMigration complete: ${success} success, ${skipped} skipped`);
}

migrate().catch(err => {
  console.error('Fatal error:', err);
  pool.end();
  process.exit(1);
});
