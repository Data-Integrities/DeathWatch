#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, close } = require('./pool');

async function importExclusions() {
  const filePath = path.resolve(__dirname, '../../data/exclusions.json');

  if (!fs.existsSync(filePath)) {
    console.log('No exclusions.json found, nothing to import.');
    return;
  }

  const data = fs.readFileSync(filePath, 'utf-8');
  const exclusions = JSON.parse(data);

  console.log(`Found ${exclusions.length} exclusions to import`);

  let imported = 0;
  let skipped = 0;

  for (const e of exclusions) {
    try {
      // Check if already exists by ID
      const { rows } = await pool.query('SELECT id FROM exclusions WHERE id = $1', [e.id]);
      if (rows.length > 0) {
        skipped++;
        continue;
      }

      await pool.query(
        `INSERT INTO exclusions (id, scope, search_key, excluded_fingerprint, excluded_url, excluded_name, reason, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          e.id,
          e.scope || 'per-query',
          e.searchKey || null,
          e.excludedFingerprint || null,
          e.excludedUrl || null,
          e.excludedName || null,
          e.reason || null,
          e.createdAt || new Date().toISOString()
        ]
      );
      imported++;
    } catch (err) {
      console.error(`Error importing exclusion ${e.id}: ${err.message}`);
    }
  }

  console.log(`Imported: ${imported}, Skipped (already exist): ${skipped}`);
}

importExclusions()
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  })
  .finally(() => close());
