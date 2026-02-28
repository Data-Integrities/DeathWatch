CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  login_id UUID NOT NULL REFERENCES dw_user(login_id),
  login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geo_city VARCHAR(100),
  geo_region VARCHAR(100),
  geo_country VARCHAR(10),
  geo_lat NUMERIC(8,4),
  geo_lon NUMERIC(9,4)
);

CREATE INDEX IF NOT EXISTS idx_login_history_login_id ON login_history(login_id);
CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON login_history(login_at DESC);
