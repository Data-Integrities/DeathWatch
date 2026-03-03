CREATE TABLE IF NOT EXISTS support_message (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  login_id UUID NOT NULL REFERENCES dw_user(login_id),
  subject VARCHAR(200) NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'unread',
  admin_reply TEXT,
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES dw_user(login_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_message_login_id ON support_message(login_id);
CREATE INDEX IF NOT EXISTS idx_support_message_created_at ON support_message(created_at DESC);
