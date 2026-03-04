-- Add new detection fields to user_result
ALTER TABLE user_result ADD COLUMN IF NOT EXISTS dob VARCHAR(10);
ALTER TABLE user_result ADD COLUMN IF NOT EXISTS name_middle VARCHAR(100);
ALTER TABLE user_result ADD COLUMN IF NOT EXISTS pob_city VARCHAR(100);
ALTER TABLE user_result ADD COLUMN IF NOT EXISTS pob_state VARCHAR(50);

-- Convert existing full URLs to domain-only
UPDATE user_result SET url = regexp_replace(
  regexp_replace(url, '^https?://(www\.)?', ''),
  '/.*$', ''
) WHERE url LIKE 'http%';
