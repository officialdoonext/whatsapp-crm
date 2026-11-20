-- ============================================================
-- 057_commerce_categories_and_variants.sql
--
-- Store categories and variants for WhatsApp Commerce & Catalog:
--   1. commerce_categories: product categories per account
--   2. commerce_variants: product variant labels & options per account
-- ============================================================

-- 1. Categories table
CREATE TABLE IF NOT EXISTS commerce_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, name)
);

CREATE INDEX IF NOT EXISTS idx_commerce_categories_account_created
  ON commerce_categories(account_id, created_at DESC);

ALTER TABLE commerce_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commerce_categories_select ON commerce_categories;
DROP POLICY IF EXISTS commerce_categories_insert ON commerce_categories;
DROP POLICY IF EXISTS commerce_categories_update ON commerce_categories;
DROP POLICY IF EXISTS commerce_categories_delete ON commerce_categories;

CREATE POLICY commerce_categories_select ON commerce_categories FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY commerce_categories_insert ON commerce_categories FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_categories_update ON commerce_categories FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_categories_delete ON commerce_categories FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- 2. Variants table
CREATE TABLE IF NOT EXISTS commerce_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, label)
);

CREATE INDEX IF NOT EXISTS idx_commerce_variants_account_created
  ON commerce_variants(account_id, created_at DESC);

ALTER TABLE commerce_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commerce_variants_select ON commerce_variants;
DROP POLICY IF EXISTS commerce_variants_insert ON commerce_variants;
DROP POLICY IF EXISTS commerce_variants_update ON commerce_variants;
DROP POLICY IF EXISTS commerce_variants_delete ON commerce_variants;

CREATE POLICY commerce_variants_select ON commerce_variants FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY commerce_variants_insert ON commerce_variants FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_variants_update ON commerce_variants FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_variants_delete ON commerce_variants FOR DELETE
  USING (is_account_member(account_id, 'agent'));
