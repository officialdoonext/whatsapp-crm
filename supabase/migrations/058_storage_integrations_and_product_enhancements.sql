-- ============================================================
-- 058_storage_integrations_and_product_enhancements.sql
--
-- 1. storage_integrations: store ImageKit and Cloudinary credentials and media preferences
-- 2. store_products: dedicated store products table (separate from Meta Commerce Catalog products)
-- ============================================================

-- 1. Storage Integrations table
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

-- 2. Dedicated store_products table (independent from Meta Commerce Catalog mirror)
CREATE TABLE IF NOT EXISTS store_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  short_code TEXT,
  description TEXT,
  list_price NUMERIC(12, 2) DEFAULT 0.00,
  sale_price NUMERIC(12, 2) DEFAULT 0.00,
  food_type TEXT DEFAULT 'others',
  images JSONB DEFAULT '[]'::jsonb,
  image_url TEXT,
  tax_config JSONB DEFAULT '{"inclusive": true}'::jsonb,
  variants_config JSONB DEFAULT '[]'::jsonb,
  nutrition_table JSONB DEFAULT '[]'::jsonb,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_products_account ON store_products(account_id);
CREATE INDEX IF NOT EXISTS idx_store_products_created ON store_products(account_id, created_at DESC);

ALTER TABLE store_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS store_products_select ON store_products;
DROP POLICY IF EXISTS store_products_insert ON store_products;
DROP POLICY IF EXISTS store_products_update ON store_products;
DROP POLICY IF EXISTS store_products_delete ON store_products;

CREATE POLICY store_products_select ON store_products FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY store_products_insert ON store_products FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY store_products_update ON store_products FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY store_products_delete ON store_products FOR DELETE
  USING (is_account_member(account_id, 'agent'));
