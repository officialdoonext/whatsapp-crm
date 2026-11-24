-- ============================================================
-- 062_commerce_product_types.sql
--
-- Dedicated product types table for custom store categorization:
--   1. commerce_product_types: store product types per account
--   2. Add product_type column to store_products table
-- ============================================================

-- 1. Product Types table
CREATE TABLE IF NOT EXISTS commerce_product_types (
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

CREATE INDEX IF NOT EXISTS idx_commerce_product_types_account_created
  ON commerce_product_types(account_id, created_at DESC);

ALTER TABLE commerce_product_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commerce_product_types_select ON commerce_product_types;
DROP POLICY IF EXISTS commerce_product_types_insert ON commerce_product_types;
DROP POLICY IF EXISTS commerce_product_types_update ON commerce_product_types;
DROP POLICY IF EXISTS commerce_product_types_delete ON commerce_product_types;

CREATE POLICY commerce_product_types_select ON commerce_product_types FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY commerce_product_types_insert ON commerce_product_types FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_product_types_update ON commerce_product_types FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_product_types_delete ON commerce_product_types FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- 2. Add product_type to store_products table and backfill from food_type
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'store_products') THEN
    ALTER TABLE store_products ADD COLUMN IF NOT EXISTS product_type TEXT;
    UPDATE store_products SET product_type = food_type WHERE product_type IS NULL AND food_type IS NOT NULL;
  END IF;
END $$;
