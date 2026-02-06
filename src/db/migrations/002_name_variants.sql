-- First name variants/nicknames lookup table
-- Source: https://github.com/carltonnorthern/nicknames

CREATE TABLE name_first_variant (
  id              SERIAL PRIMARY KEY,
  formal_name     VARCHAR(50) NOT NULL,
  variant_name    VARCHAR(50) NOT NULL,
  UNIQUE(formal_name, variant_name)
);

-- Index both columns for bidirectional lookups
CREATE INDEX idx_name_first_variant_formal ON name_first_variant(formal_name);
CREATE INDEX idx_name_first_variant_variant ON name_first_variant(variant_name);
