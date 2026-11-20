-- ============================================================
-- 061_optimize_indexes_and_reduce_logs.sql
--
-- Optimization to reduce Supabase Database Query Log Ingestion
-- and minimize Egress:
--   1. Create composite indexes for high-frequency queries
--      to avoid sequential table scans (Seq Scan)
--   2. Ensure index-only scans for active store products,
--      categories, and order date-range filtering
-- ============================================================

-- 1. store_products composite indexes
CREATE INDEX IF NOT EXISTS idx_store_products_active_created 
  ON store_products(account_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_products_category 
  ON store_products(account_id, category) 
  WHERE is_active = true;

-- 2. store_orders composite indexes for status & date-range filtering
CREATE INDEX IF NOT EXISTS idx_store_orders_account_created 
  ON store_orders(account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_store_orders_account_status_created 
  ON store_orders(account_id, order_status, created_at DESC);

-- 3. commerce_categories active lookup index
CREATE INDEX IF NOT EXISTS idx_commerce_categories_active 
  ON commerce_categories(account_id, is_active, name);
