-- ============================================================
-- 053_performance_indexes
--
-- Adds high-impact performance indexes identified in the audit:
--
-- 1. idx_broadcast_recipients_contact_created:
--    Supports `flagBroadcastReplyIfAny` and contact broadcast history lookups.
--    Eliminates sequential scans on broadcast_recipients on every inbound message.
--
-- 2. idx_messages_conversation_created:
--    Supports inbox thread rendering and message history pagination without
--    in-memory sorts.
--
-- 3. idx_messages_conversation_sender:
--    Supports fast first_inbound_message check and customer message counts.
--
-- 4. idx_deals_contact_id & idx_deals_conversation_id:
--    Accelerates deal lookups and cascades.
--
-- 5. idx_broadcast_recipients_wamid:
--    Guarantees sub-millisecond lookup by whatsapp_message_id for incoming
--    Meta delivery and read receipts.
-- ============================================================

-- 1) Broadcast recipients by contact for reply tracking
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_contact_created
  ON broadcast_recipients (contact_id, created_at DESC);

-- 2) Messages ordered by thread
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at ASC);

-- 3) Messages by sender type within conversation
CREATE INDEX IF NOT EXISTS idx_messages_conversation_sender
  ON messages (conversation_id, sender_type);

-- 4) Deals foreign key indexes
CREATE INDEX IF NOT EXISTS idx_deals_contact_id
  ON deals (contact_id);

CREATE INDEX IF NOT EXISTS idx_deals_conversation_id
  ON deals (conversation_id);

-- 5) Fast lookup for webhook status receipts
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_wamid
  ON broadcast_recipients (whatsapp_message_id)
  WHERE whatsapp_message_id IS NOT NULL;

