ALTER TABLE user_result ADD COLUMN IF NOT EXISTS source_type VARCHAR(10) DEFAULT 'initial';
