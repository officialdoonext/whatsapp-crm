import { describe, expect, it, vi } from 'vitest';
import { QueueWorker } from './worker';
import { enqueueJob } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('Background Queue Architecture', () => {
  it('calculates exponential backoff with jitter correctly', () => {
    const worker = new QueueWorker({
      maxBackoffMinutes: 60,
    });

    const now = Date.now();
    const backoff1 = worker.calculateBackoff(1);
    const diff1 = (backoff1.getTime() - now) / 1000;
    // Attempt 1: ~10s +/- 10%
    expect(diff1).toBeGreaterThanOrEqual(8);
    expect(diff1).toBeLessThanOrEqual(13);

    const backoff2 = worker.calculateBackoff(2);
    const diff2 = (backoff2.getTime() - now) / 1000;
    // Attempt 2: ~30s +/- 10%
    expect(diff2).toBeGreaterThanOrEqual(25);
    expect(diff2).toBeLessThanOrEqual(36);

    const backoff3 = worker.calculateBackoff(3);
    const diff3 = (backoff3.getTime() - now) / 1000;
    // Attempt 3: ~90s +/- 10%
    expect(diff3).toBeGreaterThanOrEqual(75);
    expect(diff3).toBeLessThanOrEqual(105);

    // Caps at maxBackoffMinutes (60 minutes = 3600s)
    const backoffMax = worker.calculateBackoff(10);
    const diffMax = (backoffMax.getTime() - now) / 1000;
    expect(diffMax).toBeLessThanOrEqual(3600 * 1.15);
  });

  it('registers handlers for different job types', () => {
    const worker = new QueueWorker();
    const handler = vi.fn();
    worker.registerHandler('outbound_message', handler);
    worker.registerHandler('broadcast_recipient', handler);

    // Verify registration does not throw
    expect(worker).toBeDefined();
  });

  it('enqueues job with proper schema and handles uniqueness conflict', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key' },
        }),
      }),
    });

    const mockClient = {
      from: vi.fn().mockReturnValue({
        insert: mockInsert,
      }),
    } as unknown as SupabaseClient;

    const result = await enqueueJob(
      {
        accountId: 'acc-123',
        queueName: 'messages',
        jobType: 'outbound_message',
        payload: { accountId: 'acc-123', conversationId: 'conv-1', messageType: 'text' },
        idempotencyKey: 'idem-1',
      },
      mockClient
    );

    expect(result.duplicated).toBe(true);
    expect(result.id).toBeNull();
  });
});

