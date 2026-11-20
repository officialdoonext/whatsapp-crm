-- ============================================================
-- 060_coupons_store_orders_and_payment_gateways.sql
--
-- WhatsApp Storefront, Coupons, Orders & Payment Gateways:
--   1. Add payment_gateway_config, notification_templates, expiry_date to stores
--   2. store_coupons: Order & Product discount coupons
--   3. store_orders: Full customer orders with 6-stage delivery pipeline
--   4. RLS policies allowing public customer storefront access
-- ============================================================

-- 1. Extend stores table
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS payment_gateway_config JSONB NOT NULL DEFAULT '{
    "razorpay": {"enabled": false, "key_id": "", "key_secret": ""},
    "cashfree": {"enabled": false, "app_id": "", "secret_key": "", "env": "sandbox"},
    "phonepe": {"enabled": false, "merchant_id": "", "salt_key": "", "salt_index": "1", "env": "uat"},
    "cod": {"enabled": true, "min_order_value": 0}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_templates JSONB NOT NULL DEFAULT '{
    "created": "",
    "preparing": "",
    "packing": "",
    "packaged": "",
    "on_the_way": "",
    "delivered": "",
    "cancelled": ""
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ;

-- 2. Coupons Table
CREATE TABLE IF NOT EXISTS store_coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  coupon_type TEXT NOT NULL DEFAULT 'order' CHECK (coupon_type IN ('order', 'product')),
  discount_type TEXT NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('percentage', 'flat')),
  discount_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  min_order_value NUMERIC(10, 2) NOT NULL DEFAULT 0,
  max_discount NUMERIC(10, 2),
  applicable_product_ids JSONB DEFAULT '[]'::jsonb,
  applicable_category_ids JSONB DEFAULT '[]'::jsonb,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  usage_limit INT,
  used_count INT DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, code)
);

CREATE INDEX IF NOT EXISTS idx_store_coupons_account ON store_coupons(account_id);
CREATE INDEX IF NOT EXISTS idx_store_coupons_code ON store_coupons(account_id, code);

-- 3. Store Orders Table with 6-stage lifecycle
CREATE TABLE IF NOT EXISTS store_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT NOT NULL,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_mobile TEXT NOT NULL,
  delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  coupon_code TEXT,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  payment_details JSONB DEFAULT '{}'::jsonb,
  order_status TEXT NOT NULL DEFAULT 'created' CHECK (order_status IN (
    'created', 'preparing', 'packing', 'packaged', 'on_the_way', 'delivered', 'cancelled'
  )),
  status_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_store_orders_account ON store_orders(account_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_store ON store_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_store_orders_status ON store_orders(order_status);
CREATE INDEX IF NOT EXISTS idx_store_orders_number ON store_orders(order_number);

-- 4. Row Level Security Policies
ALTER TABLE store_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_orders ENABLE ROW LEVEL SECURITY;

-- Coupons policies
DROP POLICY IF EXISTS store_coupons_auth_select ON store_coupons;
DROP POLICY IF EXISTS store_coupons_auth_insert ON store_coupons;
DROP POLICY IF EXISTS store_coupons_auth_update ON store_coupons;
DROP POLICY IF EXISTS store_coupons_auth_delete ON store_coupons;
DROP POLICY IF EXISTS store_coupons_public_select ON store_coupons;

CREATE POLICY store_coupons_auth_select ON store_coupons FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY store_coupons_auth_insert ON store_coupons FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

CREATE POLICY store_coupons_auth_update ON store_coupons FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY store_coupons_auth_delete ON store_coupons FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY store_coupons_public_select ON store_coupons FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- Orders policies
DROP POLICY IF EXISTS store_orders_auth_select ON store_orders;
DROP POLICY IF EXISTS store_orders_auth_update ON store_orders;
DROP POLICY IF EXISTS store_orders_auth_delete ON store_orders;
DROP POLICY IF EXISTS store_orders_public_insert ON store_orders;
DROP POLICY IF EXISTS store_orders_public_select ON store_orders;

CREATE POLICY store_orders_auth_select ON store_orders FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY store_orders_auth_update ON store_orders FOR UPDATE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY store_orders_auth_delete ON store_orders FOR DELETE
  USING (is_account_member(account_id, 'agent'));

CREATE POLICY store_orders_public_insert ON store_orders FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY store_orders_public_select ON store_orders FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow public read of store profile & active products for public storefront
DROP POLICY IF EXISTS stores_public_select ON stores;
CREATE POLICY stores_public_select ON stores FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS store_products_public_select ON store_products;
CREATE POLICY store_products_public_select ON store_products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS commerce_categories_public_select ON commerce_categories;
CREATE POLICY commerce_categories_public_select ON commerce_categories FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
