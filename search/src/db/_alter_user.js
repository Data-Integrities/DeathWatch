const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'dwdata', database: 'dw' });

async function run() {
  await c.connect();
  await c.query('ALTER TABLE dw_user RENAME COLUMN is_enabled TO disabled');
  await c.query('ALTER TABLE dw_user ALTER COLUMN disabled SET DEFAULT false');
  console.log('Renamed dw_user.is_enabled -> disabled');
  await c.end();
}

run().catch(e => { console.error(e.message); c.end(); });
