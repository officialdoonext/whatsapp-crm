import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordMetric,
  measureAsync,
  measureSync,
  getMetricsSummary,
  clearMetrics,
} from './metrics';

describe('Metrics & Monitoring', () => {
  beforeEach(() => {
    clearMetrics();
  });

  it('records metrics and calculates summary percentiles', () => {
    recordMetric('queue_wait_time_ms', 10, 'ms', { queue: 'broadcast' });
    recordMetric('queue_wait_time_ms', 20, 'ms', { queue: 'broadcast' });
    recordMetric('queue_wait_time_ms', 30, 'ms', { queue: 'broadcast' });
    recordMetric('queue_wait_time_ms', 100, 'ms', { queue: 'broadcast' });

    const summary = getMetricsSummary();
    expect(summary.queue_wait_time_ms).toBeDefined();
    expect(summary.queue_wait_time_ms.count).toBe(4);
    expect(summary.queue_wait_time_ms.min).toBe(10);
    expect(summary.queue_wait_time_ms.max).toBe(100);
    expect(summary.queue_wait_time_ms.avg).toBe(40);
    expect(summary.queue_wait_time_ms.total).toBe(160);
  });

  it('measures async duration and records metric on success', async () => {
    const result = await measureAsync('test_async_op', async () => {
      return 42;
    }, { test: true });

    expect(result).toBe(42);
    const summary = getMetricsSummary();
    expect(summary.test_async_op).toBeDefined();
    expect(summary.test_async_op.count).toBe(1);
  });

  it('measures sync duration and records metric on success', () => {
    const result = measureSync('test_sync_op', () => {
      return 'done';
    });

    expect(result).toBe('done');
    const summary = getMetricsSummary();
    expect(summary.test_sync_op).toBeDefined();
    expect(summary.test_sync_op.count).toBe(1);
  });
});

