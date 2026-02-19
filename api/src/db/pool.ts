import { Pool, types } from 'pg';

// Return DATE columns as 'YYYY-MM-DD' strings instead of JS Date objects.
// Prevents timezone-shift bugs (e.g. '2007-03-10' becoming '2007-03-09T22:00:00Z').
types.setTypeParser(types.builtins.DATE, (val: string) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export { pool };
