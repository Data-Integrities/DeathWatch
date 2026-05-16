CREATE TABLE IF NOT EXISTS backup_log (
  id            SERIAL PRIMARY KEY,
  backup_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  file_path     TEXT,
  file_size_bytes BIGINT DEFAULT 0,
  pg_dump_ok    BOOLEAN NOT NULL DEFAULT FALSE,
  idrive_ok     BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backup_log_date ON backup_log (backup_date);
