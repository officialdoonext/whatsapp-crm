-- ============================================================
-- 049_increase_ai_reply_limit.sql — increase max auto-replies to 50
-- ============================================================

ALTER TABLE ai_configs
  DROP CONSTRAINT IF EXISTS ai_configs_auto_reply_max_per_conversation_check;

ALTER TABLE ai_configs
  ADD CONSTRAINT ai_configs_auto_reply_max_per_conversation_check
  CHECK (auto_reply_max_per_conversation BETWEEN 1 AND 50);
