CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE exclusions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scope               VARCHAR(20) NOT NULL DEFAULT 'per-query' CHECK (scope IN ('per-query','global')),
  search_key          VARCHAR(16),
  excluded_fingerprint VARCHAR(255),
  excluded_url        TEXT,
  excluded_name       VARCHAR(255),
  reason              TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_exclusions_search_key ON exclusions(search_key) WHERE search_key IS NOT NULL;
CREATE INDEX idx_exclusions_global ON exclusions(scope) WHERE scope = 'global';

CREATE TABLE batches (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  input_file      VARCHAR(512),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_queries   INTEGER NOT NULL DEFAULT 0,
  total_results   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_batches_created_at ON batches(created_at DESC);

CREATE TABLE queries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id        UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  first_name      VARCHAR(100) NOT NULL,
  middle_name     VARCHAR(100),
  last_name       VARCHAR(100) NOT NULL,
  apx_age         INTEGER,
  city            VARCHAR(100),
  state           VARCHAR(50),
  search_key      VARCHAR(16) NOT NULL,
  result_count    INTEGER NOT NULL DEFAULT 0,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_queries_batch_id ON queries(batch_id);
CREATE INDEX idx_queries_search_key ON queries(search_key);

CREATE TABLE results (
  id              UUID PRIMARY KEY,
  query_id        UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
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
CREATE INDEX idx_results_query_id ON results(query_id);
CREATE INDEX idx_results_fingerprint ON results(fingerprint);
CREATE INDEX idx_results_final_score ON results(final_score DESC);
