CREATE TABLE IF NOT EXISTS error_log (
  id SERIAL PRIMARY KEY,
  login_id UUID REFERENCES dw_user(login_id),
  error_message TEXT NOT NULL,
  page VARCHAR(200),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_log_created_at ON error_log(created_at DESC);
