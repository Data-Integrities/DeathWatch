ALTER TABLE support_message ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(10) UNIQUE;
ALTER TABLE support_message ADD COLUMN IF NOT EXISTS reply_read_at TIMESTAMPTZ;

-- Backfill existing rows with random ticket IDs from safe charset
DO $$ DECLARE r RECORD; tid TEXT; chars TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; BEGIN
  FOR r IN SELECT id FROM support_message WHERE ticket_id IS NULL LOOP
    LOOP
      tid := '';
      FOR i IN 1..6 LOOP
        tid := tid || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      BEGIN
        UPDATE support_message SET ticket_id = tid WHERE id = r.id;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        -- retry with a new random ID
      END;
    END LOOP;
  END LOOP;
END $$;

ALTER TABLE support_message ALTER COLUMN ticket_id SET NOT NULL;
