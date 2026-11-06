// ============================================================
// Queue Client for Enqueuing & Managing Background Jobs
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import type { EnqueueJobOptions, JobRow, JobType } from './types';

/**
 * Enqueue a single background job.
 * Idempotent when options.idempotencyKey is supplied.
 */
export async function enqueueJob<K extends JobType = JobType>(
  options: EnqueueJobOptions<K>,
  client?: SupabaseClient
): Promise<{ id: string | null; duplicated?: boolean; error?: string }> {
  const db = client ?? supabaseAdmin();
  const runAtIso = options.runAt
    ? options.runAt instanceof Date
      ? options.runAt.toISOString()
      : options.runAt
    : new Date().toISOString();

  const webhookReceivedAtIso = options.webhookReceivedAt
    ? options.webhookReceivedAt instanceof Date
      ? options.webhookReceivedAt.toISOString()
      : options.webhookReceivedAt
    : null;

  const insertData = {
    account_id: options.accountId ?? null,
    queue_name: options.queueName,
    job_type: options.jobType,
    priority: options.priority ?? 3,
    payload: options.payload,
    status: 'pending',
    attempts: 0,
    max_attempts: options.maxAttempts ?? 5,
    run_at: runAtIso,
    idempotency_key: options.idempotencyKey ?? null,
    webhook_received_at: webhookReceivedAtIso,
    enqueued_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from('jobs_queue')
    .insert(insertData)
    .select('id')
    .maybeSingle();

  if (error) {
    // 23505 is PostgreSQL unique constraint violation on idempotency_key
    if (error.code === '23505') {
      return { id: null, duplicated: true };
    }
    console.error('[queue-client] Failed to enqueue job:', error.message);
    return { id: null, error: error.message };
  }

  return { id: data?.id ?? null };
}

/**
 * Enqueue a batch of jobs in a single atomic database statement.
 * Optimized for large operations like broadcasts.
 */
export async function enqueueJobsBatch<K extends JobType = JobType>(
  jobs: EnqueueJobOptions<K>[],
  client?: SupabaseClient
): Promise<{ count: number; error?: string }> {
  if (!jobs || jobs.length === 0) return { count: 0 };
  const db = client ?? supabaseAdmin();

  const rows = jobs.map((j) => ({
    account_id: j.accountId ?? null,
    queue_name: j.queueName,
    job_type: j.jobType,
    priority: j.priority ?? 3,
    payload: j.payload,
    status: 'pending',
    attempts: 0,
    max_attempts: j.maxAttempts ?? 5,
    run_at: j.runAt
      ? j.runAt instanceof Date
        ? j.runAt.toISOString()
        : j.runAt
      : new Date().toISOString(),
    idempotency_key: j.idempotencyKey ?? null,
    webhook_received_at: j.webhookReceivedAt
      ? j.webhookReceivedAt instanceof Date
        ? j.webhookReceivedAt.toISOString()
        : j.webhookReceivedAt
      : null,
    enqueued_at: new Date().toISOString(),
  }));

  const { data, error } = await db
    .from('jobs_queue')
    .insert(rows)
    .select('id');

  if (error) {
    console.error('[queue-client] Failed to enqueue batch of jobs:', error.message);
    return { count: 0, error: error.message };
  }

  return { count: data?.length ?? 0 };
}

/**
 * Check status of a queued job.
 */
export async function getJobStatus(
  jobId: string,
  client?: SupabaseClient
): Promise<JobRow | null> {
  const db = client ?? supabaseAdmin();
  const { data, error } = await db
    .from('jobs_queue')
    .select('*')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !data) return null;
  return data as JobRow;
}

/**
 * Cancel a pending job.
 */
export async function cancelJob(
  jobId: string,
  accountId?: string,
  client?: SupabaseClient
): Promise<boolean> {
  const db = client ?? supabaseAdmin();
  let query = db
    .from('jobs_queue')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .in('status', ['pending', 'processing']);

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { error } = await query;
  return !error;
}

