-- ============================================================
-- 059_stores_and_operating_hours.sql
--
-- Single-store profile per account with operating hours & live status:
--   - UNIQUE(account_id): only 1 store per account
--   - Operating hours (opening_time, closing_time, working_days)
--   - Online/Offline status with automatic schedule or manual override
-- ============================================================

CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mobile_number TEXT NOT NULL,
  address TEXT,
  logo_url TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  manual_override TEXT NOT NULL DEFAULT 'auto' CHECK (manual_override IN ('auto', 'online', 'offline')),
  opening_time TEXT NOT NULL DEFAULT '09:00',
  closing_time TEXT NOT NULL DEFAULT '22:00',
  working_days JSONB NOT NULL DEFAULT '["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_stores_account ON stores(account_id);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS stores_select ON stores;
DROP POLICY IF EXISTS stores_insert ON stores;
DROP POLICY IF EXISTS stores_update ON stores;
DROP POLICY IF EXISTS stores_delete ON stores;

CREATE POLICY stores_select ON stores FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY stores_insert ON stores FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY stores_update ON stores FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY stores_delete ON stores FOR DELETE
  USING (is_account_member(account_id, 'agent'));
