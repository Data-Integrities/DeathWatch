-- Migrate PLAN_PREMIUM users to PLAN_10 (Plus, now unlimited with per-person billing)
UPDATE dw_user SET plan_code = 'PLAN_10', updated_at = NOW() WHERE plan_code = 'PLAN_PREMIUM';
