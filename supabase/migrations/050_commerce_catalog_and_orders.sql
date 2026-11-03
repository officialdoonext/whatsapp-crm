-- ============================================================
-- 050_commerce_catalog_and_orders.sql
--
-- WhatsApp Catalog API & In-chat Commerce + Payments integration:
--   1. Expands whatsapp_config with catalog_id and payment settings.
--   2. Widen messages.content_type CHECK to allow 'order'.
--   3. commerce_products: local cached mirror of Meta Commerce Catalog.
--   4. commerce_orders: orders placed by customers via WhatsApp cart.
-- ============================================================

-- 1. Extend whatsapp_config with Catalog and Payment settings
ALTER TABLE whatsapp_config
  ADD COLUMN IF NOT EXISTS catalog_id TEXT,
  ADD COLUMN IF NOT EXISTS catalog_name TEXT,
  ADD COLUMN IF NOT EXISTS catalog_connected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS payment_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS auto_create_payment_link BOOLEAN NOT NULL DEFAULT false;

-- 2. Allow 'order' in messages.content_type
ALTER TABLE messages
  DROP CONSTRAINT IF EXISTS messages_content_type_check;

ALTER TABLE messages
  ADD CONSTRAINT messages_content_type_check
  CHECK (content_type IN (
    'text', 'image', 'document', 'audio', 'video',
    'location', 'template', 'interactive', 'order'
  ));

-- 3. commerce_products: local cached mirror of Meta Commerce Catalog
CREATE TABLE IF NOT EXISTS commerce_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  catalog_id TEXT NOT NULL,
  retailer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  image_url TEXT,
  url TEXT,
  availability TEXT NOT NULL DEFAULT 'in stock' CHECK (availability IN ('in stock', 'out of stock')),
  category TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, retailer_id)
);

CREATE INDEX IF NOT EXISTS idx_commerce_products_account ON commerce_products(account_id);
CREATE INDEX IF NOT EXISTS idx_commerce_products_catalog ON commerce_products(account_id, catalog_id);
CREATE INDEX IF NOT EXISTS idx_commerce_products_retailer ON commerce_products(account_id, retailer_id);

ALTER TABLE commerce_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commerce_products_select ON commerce_products;
DROP POLICY IF EXISTS commerce_products_insert ON commerce_products;
DROP POLICY IF EXISTS commerce_products_update ON commerce_products;
DROP POLICY IF EXISTS commerce_products_delete ON commerce_products;

CREATE POLICY commerce_products_select ON commerce_products FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY commerce_products_insert ON commerce_products FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_products_update ON commerce_products FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_products_delete ON commerce_products FOR DELETE
  USING (is_account_member(account_id, 'agent'));

-- 4. commerce_orders: orders received from WhatsApp customers
CREATE TABLE IF NOT EXISTS commerce_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  whatsapp_message_id TEXT,
  catalog_id TEXT,
  order_reference TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'completed', 'cancelled')),
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  shipping NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_note TEXT,
  payment_provider TEXT,
  payment_link_url TEXT,
  payment_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commerce_orders_account ON commerce_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_conversation ON commerce_orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_contact ON commerce_orders(contact_id);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_reference ON commerce_orders(account_id, order_reference);

ALTER TABLE commerce_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commerce_orders_select ON commerce_orders;
DROP POLICY IF EXISTS commerce_orders_insert ON commerce_orders;
DROP POLICY IF EXISTS commerce_orders_update ON commerce_orders;
DROP POLICY IF EXISTS commerce_orders_delete ON commerce_orders;

CREATE POLICY commerce_orders_select ON commerce_orders FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY commerce_orders_insert ON commerce_orders FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_orders_update ON commerce_orders FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY commerce_orders_delete ON commerce_orders FOR DELETE
  USING (is_account_member(account_id, 'agent'));

