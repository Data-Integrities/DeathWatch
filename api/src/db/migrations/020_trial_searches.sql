CREATE TABLE IF NOT EXISTS trial_search (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login_id UUID NOT NULL REFERENCES dw_user(login_id),
  name_last TEXT NOT NULL,
  name_first TEXT,
  name_nickname TEXT,
  name_middle TEXT,
  age_apx INT,
  city TEXT,
  state TEXT,
  key_words TEXT,
  result_count INT NOT NULL DEFAULT 0,
  result_fingerprints JSONB,
  verdict TEXT CHECK (verdict IN ('right_person', 'wrong_person')),
  verdict_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trial_search_login ON trial_search(login_id);
