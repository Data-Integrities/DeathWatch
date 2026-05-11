ALTER TABLE user_query ADD COLUMN import_batch_id TIMESTAMPTZ;
CREATE INDEX idx_user_query_import_batch ON user_query (import_batch_id) WHERE import_batch_id IS NOT NULL;
