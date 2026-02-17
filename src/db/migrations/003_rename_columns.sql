-- Rename columns to follow naming convention: category_variant
-- Pattern: name_first (not first_name), age_apx (not apx_age), etc.

-- =====================
-- exclusions table
-- =====================
ALTER TABLE exclusions RENAME COLUMN excluded_fingerprint TO fingerprint_excluded;
ALTER TABLE exclusions RENAME COLUMN excluded_url TO url_excluded;
ALTER TABLE exclusions RENAME COLUMN excluded_name TO name_excluded;

-- =====================
-- queries table
-- =====================
ALTER TABLE queries RENAME COLUMN first_name TO name_first;
ALTER TABLE queries RENAME COLUMN middle_name TO name_middle;
ALTER TABLE queries RENAME COLUMN last_name TO name_last;
ALTER TABLE queries RENAME COLUMN apx_age TO age_apx;
ALTER TABLE queries RENAME COLUMN result_count TO result_cnt;

-- =====================
-- results table
-- =====================
ALTER TABLE results RENAME COLUMN full_name TO name_full;
ALTER TABLE results RENAME COLUMN first_name TO name_first;
ALTER TABLE results RENAME COLUMN last_name TO name_last;
ALTER TABLE results RENAME COLUMN age_years TO age_years;  -- already correct, skip
ALTER TABLE results RENAME COLUMN visitation_date TO date_visitation;
ALTER TABLE results RENAME COLUMN funeral_date TO date_funeral;
ALTER TABLE results RENAME COLUMN final_score TO score_final;
ALTER TABLE results RENAME COLUMN max_possible TO score_max;
ALTER TABLE results RENAME COLUMN criteria_count TO criteria_cnt;

-- =====================
-- user_query table
-- =====================
ALTER TABLE user_query RENAME COLUMN first_name TO name_first;
ALTER TABLE user_query RENAME COLUMN middle_name TO name_middle;
ALTER TABLE user_query RENAME COLUMN last_name TO name_last;
ALTER TABLE user_query RENAME COLUMN apx_age TO age_apx;
ALTER TABLE user_query RENAME COLUMN actual_age TO age_actual;

-- =====================
-- user_result table
-- =====================
ALTER TABLE user_result RENAME COLUMN full_name TO name_full;
ALTER TABLE user_result RENAME COLUMN first_name TO name_first;
ALTER TABLE user_result RENAME COLUMN last_name TO name_last;
ALTER TABLE user_result RENAME COLUMN age_years TO age_years;  -- already correct, skip
ALTER TABLE user_result RENAME COLUMN visitation_date TO date_visitation;
ALTER TABLE user_result RENAME COLUMN funeral_date TO date_funeral;
ALTER TABLE user_result RENAME COLUMN final_score TO score_final;
ALTER TABLE user_result RENAME COLUMN max_possible TO score_max;
ALTER TABLE user_result RENAME COLUMN criteria_count TO criteria_cnt;
ALTER TABLE user_result RENAME COLUMN image_url TO url_image;

-- =====================
-- name_first_variant table
-- =====================
ALTER TABLE name_first_variant RENAME COLUMN formal_name TO name_formal;
ALTER TABLE name_first_variant RENAME COLUMN variant_name TO name_variant;

-- =====================
-- Update indexes
-- =====================
ALTER INDEX IF EXISTS idx_name_first_variant_formal RENAME TO idx_name_first_variant_name_formal;
ALTER INDEX IF EXISTS idx_name_first_variant_variant RENAME TO idx_name_first_variant_name_variant;
