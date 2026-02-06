const fs = require('fs');
const { Client } = require('pg');

const people = JSON.parse(fs.readFileSync('data/search-input.json', 'utf-8'));
const c = new Client({ host: 'localhost', port: 5432, user: 'dwclient', password: 'dwdata', database: 'dw' });

async function run() {
  await c.connect();
  for (const p of people) {
    await c.query(
      'INSERT INTO user_query (first_name, middle_name, last_name, apx_age, city, state) VALUES ($1, $2, $3, $4, $5, $6)',
      [p.firstName, p.middleName || null, p.lastName, p.apxAge || null, p.city || null, p.state || null]
    );
  }
  const { rows } = await c.query('SELECT count(*) FROM user_query');
  console.log('Inserted ' + rows[0].count + ' rows into user_query');
  await c.end();
}

run().catch(e => { console.error(e.message); c.end(); });
