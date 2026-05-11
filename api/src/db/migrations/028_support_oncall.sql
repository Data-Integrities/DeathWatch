-- Support staff roster and fatal error alerting

CREATE TABLE IF NOT EXISTS support_staff (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  is_on_call BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fatal_error (
  id SERIAL PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  error_code VARCHAR(50),
  message TEXT NOT NULL,
  staff_id INT REFERENCES support_staff(id),
  staff_name VARCHAR(100),
  sms_sent BOOLEAN NOT NULL DEFAULT false,
  rate_limited BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fatal_error_created_at ON fatal_error(created_at DESC);

-- Seed: Jim Jones as first support staff and on-call chief
INSERT INTO support_staff (name, phone_number, is_on_call)
SELECT 'Jim Jones', '+19044770311', true
WHERE NOT EXISTS (SELECT 1 FROM support_staff);
