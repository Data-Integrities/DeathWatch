const { Pool } = require('pg');
const config = require('../config');
const { logger } = require('../utils/logger');

const poolConfig = config.db.connectionString
  ? { connectionString: config.db.connectionString }
  : {
      host: config.db.host,
      port: config.db.port,
      database: config.db.database,
      user: config.db.user,
      password: config.db.password,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error:', err);
});

async function close() {
  await pool.end();
}

// Graceful shutdown
process.on('SIGTERM', close);
process.on('SIGINT', close);

module.exports = { pool, close };
