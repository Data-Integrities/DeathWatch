CREATE TABLE IF NOT EXISTS page_hit (
  id            SERIAL PRIMARY KEY,
  page          TEXT NOT NULL,
  ip_address    TEXT,
  geo_city      TEXT,
  geo_region    TEXT,
  geo_country   TEXT,
  geo_lat       DOUBLE PRECISION,
  geo_lon       DOUBLE PRECISION,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_page_hit_page ON page_hit (page);
CREATE INDEX idx_page_hit_created_at ON page_hit (created_at DESC);
