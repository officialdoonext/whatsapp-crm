-- ============================================================
-- 052_broadcast_lifecycle.sql — Broadcast pause, resume, cancel & status support
-- ============================================================

ALTER TABLE broadcasts
  DROP CONSTRAINT IF EXISTS broadcasts_status_check;

ALTER TABLE broadcasts
  ADD CONSTRAINT broadcasts_status_check
  CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'failed', 'paused', 'cancelled'));

-- Index for querying campaign lifecycle status
CREATE INDEX IF NOT EXISTS idx_broadcasts_account_status
  ON broadcasts (account_id, status);

