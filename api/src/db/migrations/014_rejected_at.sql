ALTER TABLE user_result ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ;

-- Backfill: set rejected_at to ran_dt for existing rejected results
UPDATE user_result SET rejected_at = ran_dt WHERE status = 'rejected' AND rejected_at IS NULL;
