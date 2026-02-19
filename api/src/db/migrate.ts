import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './pool';

async function migrate() {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`Found ${files.length} migration files`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, 'utf-8');
    console.log(`Running migration: ${file}`);
    try {
      await pool.query(sql);
      console.log(`  OK: ${file}`);
    } catch (err: any) {
      console.error(`  FAILED: ${file} — ${err.message}`);
      throw err;
    }
  }

  console.log('All migrations complete');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
