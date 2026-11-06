// ============================================================
// Queue Worker Engine — SKIP LOCKED PostgreSQL Consumption
// ============================================================

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/automations/admin-client';
import { recordMetric } from '@/lib/monitoring/metrics';
import type { JobHandler, JobRow, JobType, QueueName } from './types';

export interface WorkerOptions {
  workerId?: string;
  queues?: QueueName[];
  concurrency?: number;
  pollIntervalMs?: number;
  emptyBackoffMs?: number;
  lockTimeoutSeconds?: number;
  maxBackoffMinutes?: number;
  client?: SupabaseClient;
}

export class QueueWorker {
  readonly workerId: string;
  readonly queues: QueueName[];
  readonly concurrency: number;
  readonly pollIntervalMs: number;
  readonly emptyBackoffMs: number;
  readonly lockTimeoutSeconds: number;
  readonly maxBackoffMinutes: number;
  private customDb?: SupabaseClient;

  private isRunning = false;
  private isStopping = false;
  private activeJobsCount = 0;
  private readonly handlers = new Map<JobType, JobHandler>();
  private pollTimeoutTimer: NodeJS.Timeout | null = null;

  constructor(options: WorkerOptions = {}) {
    this.workerId = options.workerId ?? `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
    this.queues = options.queues ?? [
      'broadcasts',
      'messages',
      'webhooks',
      'automations',
      'ai',
      'media',
    ];
    this.concurrency = Math.max(1, options.concurrency ?? 10);
    this.pollIntervalMs = options.pollIntervalMs ?? 200;
    this.emptyBackoffMs = options.emptyBackoffMs ?? 1500;
    this.lockTimeoutSeconds = options.lockTimeoutSeconds ?? 300;
    this.maxBackoffMinutes = options.maxBackoffMinutes ?? 60;
    this.customDb = options.client;
  }

  private getDb(): SupabaseClient {
    return this.customDb ?? supabaseAdmin();
  }

  /**
   * Register a job processing handler for a specific job_type.
   */
  registerHandler<T = unknown>(jobType: JobType, handler: JobHandler<T>): this {
    this.handlers.set(jobType, handler as JobHandler);
    return this;
  }

  /**
   * Start the background worker process.
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isStopping = false;

    console.log(
      `[queue-worker] Started worker ${this.workerId} on queues [${this.queues.join(', ')}] with concurrency ${this.concurrency}`
    );

    this.setupSignalHandlers();
    void this.pollLoop();
  }

  /**
   * Graceful worker shutdown. Waits for in-flight jobs to complete.
   */
  async stop(): Promise<void> {
    if (!this.isRunning || this.isStopping) return;
    this.isStopping = true;
    console.log(`[queue-worker] Stopping worker ${this.workerId}... Waiting for ${this.activeJobsCount} active jobs.`);

    if (this.pollTimeoutTimer) {
      clearTimeout(this.pollTimeoutTimer);
      this.pollTimeoutTimer = null;
    }

    const startWait = Date.now();
    while (this.activeJobsCount > 0 && Date.now() - startWait < 30_000) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    this.isRunning = false;
    console.log(`[queue-worker] Worker ${this.workerId} successfully stopped.`);
  }

  /**
   * Calculate exponential backoff timestamp.
   * Attempt 1: ~10s, Attempt 2: ~30s, Attempt 3: ~90s, Attempt 4: ~270s, up to maxBackoffMinutes.
   */
  calculateBackoff(attempts: number): Date {
    const baseSeconds = 10;
    const factor = 3;
    const backoffSeconds = Math.min(
      this.maxBackoffMinutes * 60,
      baseSeconds * Math.pow(factor, Math.max(0, attempts - 1))
    );
    // Add 10% jitter to prevent thundering herd on retry
    const jitter = backoffSeconds * 0.1 * (Math.random() * 2 - 1);
    const totalMs = Math.round((backoffSeconds + jitter) * 1000);
    return new Date(Date.now() + Math.max(1000, totalMs));
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning && !this.isStopping) {
      try {
        const availableSlots = this.concurrency - this.activeJobsCount;
        if (availableSlots <= 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        const jobs = await this.claimJobs(availableSlots);

        if (!jobs || jobs.length === 0) {
          // No jobs available: backoff to reduce idle DB load
          await new Promise((resolve) => {
            this.pollTimeoutTimer = setTimeout(resolve, this.emptyBackoffMs);
          });
          continue;
        }

        // Process claimed batch concurrently within available concurrency slots
        for (const job of jobs) {
          this.activeJobsCount++;
          void this.executeJob(job).finally(() => {
            this.activeJobsCount--;
          });
        }

        // Small delay between polls
        await new Promise((resolve) => setTimeout(resolve, this.pollIntervalMs));
      } catch (err) {
        console.error('[queue-worker] Error in poll loop:', err);
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }

  private async claimJobs(batchSize: number): Promise<JobRow[]> {
    const { data, error } = await this.getDb().rpc('claim_next_jobs', {
      p_queue_names: this.queues,
      p_worker_id: this.workerId,
      p_batch_size: batchSize,
      p_lock_timeout_seconds: this.lockTimeoutSeconds,
    });

    if (error) {
      console.error('[queue-worker] claim_next_jobs RPC failed:', error.message);
      return [];
    }

    return (data as JobRow[]) ?? [];
  }

  private async executeJob(job: JobRow): Promise<void> {
    const handler = this.handlers.get(job.job_type);

    if (!handler) {
      console.warn(`[queue-worker] No handler registered for job_type "${job.job_type}". Failing job ${job.id}`);
      await this.settle(job.id, 'failed', `No handler registered for job_type: ${job.job_type}`);
      return;
    }

    const startTime = Date.now();
    const waitTimeMs = Math.max(0, startTime - new Date(job.run_at).getTime());
    recordMetric('queue_wait_time_ms', waitTimeMs, 'ms', {
      job_type: job.job_type,
      queue: job.queue_name,
      account_id: job.account_id ?? 'system',
    });
    recordMetric('worker_concurrency_active', this.activeJobsCount, 'count', {
      worker_id: this.workerId,
    });

    try {
      await handler(job);
      const durationMs = Date.now() - startTime;
      recordMetric('job_processing_time_ms', durationMs, 'ms', {
        job_type: job.job_type,
        status: 'completed',
        account_id: job.account_id ?? 'system',
      });
      await this.settle(job.id, 'completed');
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;

      recordMetric('job_processing_time_ms', durationMs, 'ms', {
        job_type: job.job_type,
        status: 'failed',
        account_id: job.account_id ?? 'system',
      });

      console.error(
        `[queue-worker] Job ${job.id} (${job.job_type}) failed on attempt ${job.attempts}/${job.max_attempts}:`,
        errorMessage
      );

      if (job.attempts < job.max_attempts) {
        recordMetric('job_retry_count', 1, 'count', { job_type: job.job_type });
        const nextRunAt = this.calculateBackoff(job.attempts);
        await this.settle(job.id, 'retry', errorMessage, { stack: errorStack }, nextRunAt);
      } else {
        recordMetric('job_failed_count', 1, 'count', { job_type: job.job_type });
        console.error(`[queue-worker] Job ${job.id} reached max_attempts (${job.max_attempts}). Marking permanently failed.`);
        await this.settle(job.id, 'failed', errorMessage, { stack: errorStack });
      }
    }
  }

  private async settle(
    jobId: string,
    status: 'completed' | 'retry' | 'failed',
    errorMessage?: string,
    lastError?: Record<string, unknown>,
    nextRunAt?: Date
  ): Promise<void> {
    try {
      await this.getDb().rpc('settle_job', {
        p_job_id: jobId,
        p_status: status,
        p_error_message: errorMessage ?? null,
        p_last_error: lastError ?? null,
        p_next_run_at: nextRunAt ? nextRunAt.toISOString() : null,
      });
    } catch (err) {
      console.error(`[queue-worker] Failed to settle job ${jobId} to status ${status}:`, err);
    }
  }

  private setupSignalHandlers(): void {
    const handleSignal = (signal: string) => {
      console.log(`[queue-worker] Received ${signal}. Initiating graceful shutdown...`);
      void this.stop().then(() => {
        process.exit(0);
      });
    };

    process.once('SIGINT', () => handleSignal('SIGINT'));
    process.once('SIGTERM', () => handleSignal('SIGTERM'));
  }
}
