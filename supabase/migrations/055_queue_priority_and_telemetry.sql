-- ============================================================
-- 055_queue_priority_and_telemetry.sql — Priority Queuing & Metrics
--
-- Enhances jobs_queue with:
--   1. Priority column (1 = highest/instant, 5 = lowest/background)
--   2. Strict priority-based index & SKIP LOCKED ordering
--   3. Granular stage telemetry timestamps (webhook -> queue -> claim -> execution -> meta)
--   4. Updated settle_job and claim_next_jobs RPCs
-- ============================================================

-- 1. Add priority and latency instrumentation columns
ALTER TABLE jobs_queue
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS webhook_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enqueued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS execution_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS meta_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Priority-aware drainage index
-- Enables instant message / auto-reply jobs (priority 1) to be claimed immediately
-- ahead of bulk broadcast campaign jobs (priority 4) or media mirroring (priority 5)
DROP INDEX IF EXISTS idx_jobs_queue_pending;

CREATE INDEX IF NOT EXISTS idx_jobs_queue_priority_pending
  ON jobs_queue (queue_name, priority ASC, run_at ASC, created_at ASC)
  WHERE status = 'pending';

-- Index for account priority monitoring
CREATE INDEX IF NOT EXISTS idx_jobs_queue_account_priority
  ON jobs_queue (account_id, priority ASC, created_at DESC);

-- 3. Update claim_next_jobs with priority ordering and claimed_at stamping
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
  -- 1. Re-queue any orphaned jobs whose worker lock expired (worker crash recovery)
  UPDATE jobs_queue
  SET status = 'pending',
      locked_at = NULL,
      locked_by = NULL,
      updated_at = NOW()
  WHERE status = 'processing'
    AND locked_at < NOW() - (p_lock_timeout_seconds || ' seconds')::INTERVAL;

  -- 2. Concurrently claim available pending jobs using SKIP LOCKED ordered by priority
  RETURN QUERY
  WITH available AS (
    SELECT id
    FROM jobs_queue
    WHERE queue_name = ANY(p_queue_names)
      AND status = 'pending'
      AND run_at <= NOW()
    ORDER BY priority ASC, run_at ASC, created_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE jobs_queue j
  SET status = 'processing',
      attempts = j.attempts + 1,
      locked_at = NOW(),
      claimed_at = COALESCE(j.claimed_at, NOW()),
      locked_by = p_worker_id,
      updated_at = NOW()
  FROM available
  WHERE j.id = available.id
  RETURNING j.*;
END;
$$;

-- 4. Update settle_job to record completion timestamp
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
        execution_completed_at = NOW(),
        timings = CASE WHEN p_last_error IS NOT NULL THEN COALESCE(timings, '{}'::jsonb) || p_last_error ELSE timings END,
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
        execution_completed_at = NOW(),
        error_message = p_error_message,
        last_error = p_last_error,
        updated_at = NOW()
    WHERE id = p_job_id;
  END IF;
END;
$$;
