const { Client } = require('pg');

const c = new Client({ host: 'localhost', port: 5432, user: 'postgres', password: 'dwdata', database: 'dw' });

const sql = `
CREATE TABLE user_result (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_query_id   UUID NOT NULL REFERENCES user_query(id) ON DELETE CASCADE,
  ran_dt          TIMESTAMPTZ NOT NULL,
  full_name       VARCHAR(255),
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  age_years       INTEGER,
  dod             DATE,
  visitation_date DATE,
  funeral_date    DATE,
  city            VARCHAR(100),
  state           VARCHAR(50),
  source          VARCHAR(100),
  url             TEXT,
  snippet         TEXT,
  score           INTEGER DEFAULT 0,
  reasons         JSONB DEFAULT '[]',
  fingerprint     VARCHAR(255),
  provider_type   VARCHAR(50),
  also_found_at   JSONB,
  criteria_scores JSONB,
  final_score     INTEGER,
  max_possible    INTEGER,
  criteria_count  INTEGER,
  rank            INTEGER
);
CREATE INDEX idx_user_result_query_id ON user_result(user_query_id);
CREATE INDEX idx_user_result_ran_dt ON user_result(ran_dt DESC);
CREATE INDEX idx_user_result_fingerprint ON user_result(fingerprint);
CREATE INDEX idx_user_result_final_score ON user_result(final_score DESC);
GRANT ALL PRIVILEGES ON TABLE user_result TO dwclient;
`;

c.connect()
  .then(() => c.query(sql))
  .then(() => { console.log('Table user_result created with indexes'); c.end(); })
  .catch(e => { console.error(e.message); c.end(); });
