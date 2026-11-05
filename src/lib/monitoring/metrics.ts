// ============================================================
// WhatsApp CRM Performance Metrics & Structured Monitoring
// ============================================================

export type MetricUnit = 'ms' | 'count' | 'bytes' | 'percent';

export interface MetricEntry {
  name: string;
  value: number;
  unit: MetricUnit;
  tags?: Record<string, string | number | boolean>;
  timestamp: string;
}

interface MetricSummary {
  count: number;
  total: number;
  min: number;
  max: number;
  avg: number;
  p95?: number;
}

// In-memory ring buffer for the latest 1,000 metric data points
const MAX_METRIC_ENTRIES = 1000;
const metricBuffer: MetricEntry[] = [];

/**
 * Record a single structured metric.
 */
export function recordMetric(
  name: string,
  value: number,
  unit: MetricUnit = 'ms',
  tags?: Record<string, string | number | boolean>
): void {
  const entry: MetricEntry = {
    name,
    value,
    unit,
    tags,
    timestamp: new Date().toISOString(),
  };

  if (metricBuffer.length >= MAX_METRIC_ENTRIES) {
    metricBuffer.shift();
  }
  metricBuffer.push(entry);

  // Structured log for cloud monitoring / ingestion
  if (process.env.NODE_ENV !== 'test') {
    console.log(
      JSON.stringify({
        level: 'metric',
        metric: name,
        value,
        unit,
        ...tags,
        timestamp: entry.timestamp,
      })
    );
  }
}

/**
 * Measure execution duration of an async function.
 */
export async function measureAsync<T>(
  metricName: string,
  fn: () => Promise<T>,
  tags?: Record<string, string | number | boolean>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    recordMetric(metricName, duration, 'ms', { ...tags, success: true });
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    recordMetric(metricName, duration, 'ms', {
      ...tags,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Measure execution duration of a synchronous function.
 */
export function measureSync<T>(
  metricName: string,
  fn: () => T,
  tags?: Record<string, string | number | boolean>
): T {
  const start = performance.now();
  try {
    const result = fn();
    const duration = Math.round(performance.now() - start);
    recordMetric(metricName, duration, 'ms', { ...tags, success: true });
    return result;
  } catch (error) {
    const duration = Math.round(performance.now() - start);
    recordMetric(metricName, duration, 'ms', {
      ...tags,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Get aggregated summary of recent metrics.
 */
export function getMetricsSummary(): Record<string, MetricSummary> {
  const groups = new Map<string, number[]>();

  for (const entry of metricBuffer) {
    let list = groups.get(entry.name);
    if (!list) {
      list = [];
      groups.set(entry.name, list);
    }
    list.push(entry.value);
  }

  const summaries: Record<string, MetricSummary> = {};

  for (const [name, values] of groups.entries()) {
    if (values.length === 0) continue;
    values.sort((a, b) => a - b);
    const total = values.reduce((sum, v) => sum + v, 0);
    const count = values.length;
    const min = values[0];
    const max = values[count - 1];
    const avg = Math.round((total / count) * 10) / 10;
    const p95Index = Math.min(Math.floor(count * 0.95), count - 1);
    const p95 = values[p95Index];

    summaries[name] = { count, total, min, max, avg, p95 };
  }

  return summaries;
}

/**
 * Clear metric buffer (useful for testing).
 */
export function clearMetrics(): void {
  metricBuffer.length = 0;
}

