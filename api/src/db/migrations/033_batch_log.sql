CREATE TABLE IF NOT EXISTS batch_log (
  id              SERIAL PRIMARY KEY,
  batch_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at      TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  queries_total   INT NOT NULL DEFAULT 0,
  queries_ok      INT NOT NULL DEFAULT 0,
  queries_failed  INT NOT NULL DEFAULT 0,
  results_new     INT NOT NULL DEFAULT 0,
  users_notified  INT NOT NULL DEFAULT 0,
  purged          INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'running',
  error_message   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batch_log_date ON batch_log (batch_date);
