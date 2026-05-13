CREATE TABLE IF NOT EXISTS redirect_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address VARCHAR(45) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redirect_log_created_at ON redirect_log(created_at DESC);
