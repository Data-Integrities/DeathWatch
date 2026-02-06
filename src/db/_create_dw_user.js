const { Client } = require('pg');

const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'dwdata', database: 'dw' });

const sql = `ALTER TABLE dw_user ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT false;`;

c.connect()
  .then(() => c.query(sql))
  .then(() => { console.log('Added is_admin column'); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
