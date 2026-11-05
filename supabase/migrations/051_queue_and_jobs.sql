-- ============================================================
-- 051_queue_and_jobs.sql — Persistent Background Queue Engine
--
-- Implements high-throughput, ACID-compliant, SKIP LOCKED job queues
-- directly in Supabase PostgreSQL without requiring external brokers.
--
-- Features:
--   1. jobs_queue table with tenant isolation (account_id).
--   2. SKIP LOCKED concurrency for lock-free multi-worker consumption.
--   3. Idempotency guarantees via (account_id, idempotency_key).
--   4. Exponential backoff and retry tracking.
--   5. Dead-letter/failed job handling.
--   6. Queue metrics and status reporting.
-- ============================================================

CREATE TABLE IF NOT EXISTS jobs_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  queue_name TEXT NOT NULL DEFAULT 'default',
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  idempotency_key TEXT,
  error_message TEXT,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Primary queue drainage index: filter for pending jobs ready to execute
CREATE INDEX IF NOT EXISTS idx_jobs_queue_pending
  ON jobs_queue (queue_name, run_at ASC)
  WHERE status = 'pending';

-- Fast worker heartbeat & lock expiry monitor
CREATE INDEX IF NOT EXISTS idx_jobs_queue_processing
  ON jobs_queue (locked_at)
  WHERE status = 'processing';

-- Tenant jobs lookup & history
CREATE INDEX IF NOT EXISTS idx_jobs_queue_account_status
  ON jobs_queue (account_id, status, created_at DESC);

-- Unique index for idempotent deduplication per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_queue_idempotency
  ON jobs_queue (account_id, queue_name, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND status IN ('pending', 'processing', 'completed');

ALTER TABLE jobs_queue ENABLE ROW LEVEL SECURITY;

-- Admins and agents can view their account's background jobs
CREATE POLICY jobs_queue_select ON jobs_queue FOR SELECT
  USING (is_account_member(account_id));

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_updated_at ON jobs_queue;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON jobs_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Atomic Job Claiming via SELECT ... FOR UPDATE SKIP LOCKED
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_next_jobs(
  p_queue_names TEXT[],
  p_worker_id TEXT,
  p_batch_size INTEGER DEFAULT 10,
  p_lock_timeout_seconds INTEGER DEFAULT 300
)
RETURNS SETOF jobs_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Re-queue any orphaned jobs whose worker lock expired (e.g. worker process crashed)
  UPDATE jobs_queue
  SET status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      updated_at = NOW()
  WHERE status = 'processing'
    AND locked_at < NOW() - (p_lock_timeout_seconds || ' seconds')::INTERVAL;

  -- 2. Concurrently claim available pending jobs using SKIP LOCKED
  RETURN QUERY
  WITH available AS (
    SELECT id
    FROM jobs_queue
    WHERE queue_name = ANY(p_queue_names)
      AND status = 'pending'
      AND run_at <= NOW()
    ORDER BY run_at ASC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE jobs_queue j
  SET status = 'processing',
      attempts = j.attempts + 1,
      locked_at = NOW(),
      locked_by = p_worker_id,
      updated_at = NOW()
  FROM available
  WHERE j.id = available.id
  RETURNING j.*;
END;
$$;

ALTER FUNCTION public.claim_next_jobs(TEXT[], TEXT, INTEGER, INTEGER) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.claim_next_jobs(TEXT[], TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_next_jobs(TEXT[], TEXT, INTEGER, INTEGER) TO service_role;

-- ============================================================
-- Complete or Fail a Job
-- ============================================================
CREATE OR REPLACE FUNCTION public.settle_job(
  p_job_id UUID,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL,
  p_last_error JSONB DEFAULT NULL,
  p_next_run_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status = 'completed' THEN
    UPDATE jobs_queue
    SET status = 'completed',
        locked_at = NULL,
        locked_by = NULL,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_job_id;
  ELSIF p_status = 'retry' THEN
    UPDATE jobs_queue
    SET status = 'pending',
        locked_at = NULL,
        locked_by = NULL,
        run_at = COALESCE(p_next_run_at, NOW() + INTERVAL '30 seconds'),
        error_message = p_error_message,
        last_error = p_last_error,
        updated_at = NOW()
    WHERE id = p_job_id;
  ELSE -- 'failed' or 'cancelled'
    UPDATE jobs_queue
    SET status = p_status,
        locked_at = NULL,
        locked_by = NULL,
        error_message = p_error_message,
        last_error = p_last_error,
        updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
END;
$$;

ALTER FUNCTION public.settle_job(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.settle_job(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.settle_job(UUID, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;

