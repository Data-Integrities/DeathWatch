-- Track billing commitment for per-person charges beyond 5
ALTER TABLE user_query ADD COLUMN IF NOT EXISTS committed_at TIMESTAMPTZ;

-- All existing searches are already committed
UPDATE user_query SET committed_at = created_at WHERE committed_at IS NULL;
