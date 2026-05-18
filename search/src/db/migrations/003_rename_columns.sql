-- Rename columns to follow naming convention: category_variant
-- Pattern: name_first (not first_name), age_apx (not apx_age), etc.
-- Each rename is guarded: only runs if the old column still exists.

DO $$ BEGIN
  -- exclusions table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exclusions' AND column_name='excluded_fingerprint') THEN
    ALTER TABLE exclusions RENAME COLUMN excluded_fingerprint TO fingerprint_excluded;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exclusions' AND column_name='excluded_url') THEN
    ALTER TABLE exclusions RENAME COLUMN excluded_url TO url_excluded;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='exclusions' AND column_name='excluded_name') THEN
    ALTER TABLE exclusions RENAME COLUMN excluded_name TO name_excluded;
  END IF;

  -- queries table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='queries' AND column_name='first_name') THEN
    ALTER TABLE queries RENAME COLUMN first_name TO name_first;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='queries' AND column_name='middle_name') THEN
    ALTER TABLE queries RENAME COLUMN middle_name TO name_middle;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='queries' AND column_name='last_name') THEN
    ALTER TABLE queries RENAME COLUMN last_name TO name_last;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='queries' AND column_name='apx_age') THEN
    ALTER TABLE queries RENAME COLUMN apx_age TO age_apx;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='queries' AND column_name='result_count') THEN
    ALTER TABLE queries RENAME COLUMN result_count TO result_cnt;
  END IF;

  -- results table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='full_name') THEN
    ALTER TABLE results RENAME COLUMN full_name TO name_full;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='first_name') THEN
    ALTER TABLE results RENAME COLUMN first_name TO name_first;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='last_name') THEN
    ALTER TABLE results RENAME COLUMN last_name TO name_last;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='visitation_date') THEN
    ALTER TABLE results RENAME COLUMN visitation_date TO date_visitation;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='funeral_date') THEN
    ALTER TABLE results RENAME COLUMN funeral_date TO date_funeral;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='final_score') THEN
    ALTER TABLE results RENAME COLUMN final_score TO score_final;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='max_possible') THEN
    ALTER TABLE results RENAME COLUMN max_possible TO score_max;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='criteria_count') THEN
    ALTER TABLE results RENAME COLUMN criteria_count TO criteria_cnt;
  END IF;

  -- user_query table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_query' AND column_name='first_name') THEN
    ALTER TABLE user_query RENAME COLUMN first_name TO name_first;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_query' AND column_name='middle_name') THEN
    ALTER TABLE user_query RENAME COLUMN middle_name TO name_middle;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_query' AND column_name='last_name') THEN
    ALTER TABLE user_query RENAME COLUMN last_name TO name_last;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_query' AND column_name='apx_age') THEN
    ALTER TABLE user_query RENAME COLUMN apx_age TO age_apx;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_query' AND column_name='actual_age') THEN
    ALTER TABLE user_query RENAME COLUMN actual_age TO age_actual;
  END IF;

  -- user_result table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='full_name') THEN
    ALTER TABLE user_result RENAME COLUMN full_name TO name_full;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='first_name') THEN
    ALTER TABLE user_result RENAME COLUMN first_name TO name_first;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='last_name') THEN
    ALTER TABLE user_result RENAME COLUMN last_name TO name_last;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='visitation_date') THEN
    ALTER TABLE user_result RENAME COLUMN visitation_date TO date_visitation;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='funeral_date') THEN
    ALTER TABLE user_result RENAME COLUMN funeral_date TO date_funeral;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='final_score') THEN
    ALTER TABLE user_result RENAME COLUMN final_score TO score_final;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='max_possible') THEN
    ALTER TABLE user_result RENAME COLUMN max_possible TO score_max;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='criteria_count') THEN
    ALTER TABLE user_result RENAME COLUMN criteria_count TO criteria_cnt;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_result' AND column_name='image_url') THEN
    ALTER TABLE user_result RENAME COLUMN image_url TO url_image;
  END IF;

  -- name_first_variant table
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='name_first_variant' AND column_name='formal_name') THEN
    ALTER TABLE name_first_variant RENAME COLUMN formal_name TO name_formal;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='name_first_variant' AND column_name='variant_name') THEN
    ALTER TABLE name_first_variant RENAME COLUMN variant_name TO name_variant;
  END IF;
END $$;

-- Update indexes
ALTER INDEX IF EXISTS idx_name_first_variant_formal RENAME TO idx_name_first_variant_name_formal;
ALTER INDEX IF EXISTS idx_name_first_variant_variant RENAME TO idx_name_first_variant_name_variant;
