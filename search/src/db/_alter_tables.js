const { Client } = require('pg');

const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'dwdata', database: 'dw' });

async function run() {
  await c.connect();

  // 1. Rename dw_user.id to login_id
  await c.query('ALTER TABLE dw_user RENAME COLUMN id TO login_id');
  console.log('Renamed dw_user.id -> login_id');

  // 2. Add disabled column to user_query
  await c.query('ALTER TABLE user_query ADD COLUMN disabled BOOLEAN NOT NULL DEFAULT false');
  console.log('Added user_query.disabled');

  // 3. Add login_id column to user_query (FK to dw_user)
  await c.query('ALTER TABLE user_query ADD COLUMN login_id UUID REFERENCES dw_user(login_id)');
  console.log('Added user_query.login_id');

  // 4. Index on login_id
  await c.query('CREATE INDEX idx_user_query_login_id ON user_query(login_id)');
  console.log('Created index on user_query.login_id');

  // 5. Grant to dwclient
  await c.query('GRANT ALL PRIVILEGES ON TABLE user_query TO dwclient');
  await c.query('GRANT ALL PRIVILEGES ON TABLE dw_user TO dwclient');

  await c.end();
  console.log('Done.');
}

run().catch(e => { console.error(e.message); c.end(); });
