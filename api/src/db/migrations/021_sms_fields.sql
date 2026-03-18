-- Add phone number and SMS opt-in to user table
ALTER TABLE dw_user ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
ALTER TABLE dw_user ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN NOT NULL DEFAULT true;
