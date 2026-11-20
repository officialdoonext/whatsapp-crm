-- ============================================================
-- 058_storage_integrations_and_product_enhancements.sql
--
-- 1. storage_integrations: store ImageKit and Cloudinary credentials and media preferences
-- 2. commerce_products: extend schema for food_type, short_code, tax, nutrition, variants
-- ============================================================

CREATE TABLE IF NOT EXISTS storage_integrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  imagekit_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  cloudinary_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_preferences JSONB NOT NULL DEFAULT '{
    "images": "imagekit",
    "documents": "imagekit",
    "videos": "cloudinary",
    "audio": "cloudinary"
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id)
);

CREATE INDEX IF NOT EXISTS idx_storage_integrations_account ON storage_integrations(account_id);

ALTER TABLE storage_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS storage_integrations_select ON storage_integrations;
DROP POLICY IF EXISTS storage_integrations_insert ON storage_integrations;
DROP POLICY IF EXISTS storage_integrations_update ON storage_integrations;
DROP POLICY IF EXISTS storage_integrations_delete ON storage_integrations;

CREATE POLICY storage_integrations_select ON storage_integrations FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY storage_integrations_insert ON storage_integrations FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY storage_integrations_update ON storage_integrations FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY storage_integrations_delete ON storage_integrations FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- Extend commerce_products with structured columns
ALTER TABLE commerce_products
  ALTER COLUMN catalog_id DROP NOT NULL,
  ALTER COLUMN catalog_id SET DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS short_code TEXT,
  ADD COLUMN IF NOT EXISTS list_price NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS food_type TEXT DEFAULT 'others',
  ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tax_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS variants_config JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nutrition_table JSONB DEFAULT '[]'::jsonb;
