-- ============================================================
-- 056_inbox_and_nav_performance
--
-- Performance indexes to accelerate page-to-page navigation,
-- shared inbox message history, conversation listings, and contact queries:
--
-- 1. idx_conversations_account_last_message:
--    Index on (account_id, last_message_at DESC NULLS LAST).
--    Accelerates conversation list loading and sorting by most recent activity.
--
-- 2. idx_conversations_account_status:
--    Index on (account_id, status).
--    Accelerates conversation filtering by open/pending/closed in the inbox.
--
-- 3. idx_messages_conversation_created_desc:
--    Index on (conversation_id, created_at DESC).
--    Optimizes message thread rendering (latest 24 messages) and pagination.
--
-- 4. idx_contacts_account_created:
--    Index on (account_id, created_at DESC).
--    Optimizes contact directory table pagination and sorting.
--
-- 5. idx_contact_tags_lookup:
--    Indexes on contact_tags (contact_id) and contact_tags (tag_id).
--    Accelerates contact tag enrichment in inbox and contacts views.
-- ============================================================

-- 1) Conversations ordered by last message time
CREATE INDEX IF NOT EXISTS idx_conversations_account_last_message
  ON conversations (account_id, last_message_at DESC NULLS LAST);

-- 2) Conversations filtered by status
CREATE INDEX IF NOT EXISTS idx_conversations_account_status
  ON conversations (account_id, status);

-- 3) Messages reverse-ordered by created_at for fast thread slices
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc
  ON messages (conversation_id, created_at DESC);

-- 4) Contacts ordered by created_at
CREATE INDEX IF NOT EXISTS idx_contacts_account_created
  ON contacts (account_id, created_at DESC);

-- 5) Contact tags foreign key acceleration
CREATE INDEX IF NOT EXISTS idx_contact_tags_contact_id
  ON contact_tags (contact_id);

CREATE INDEX IF NOT EXISTS idx_contact_tags_tag_id
  ON contact_tags (tag_id);

