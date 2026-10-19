/** Sensors sample every 15s; the cabinet shows one smoothed value per 5 minutes (up to 20 samples). */
export const DISPLAY_WINDOW_MS = 5 * 60 * 1000;

export function bucketStartMs(tsMs: number) {
  return Math.floor(tsMs / DISPLAY_WINDOW_MS) * DISPLAY_WINDOW_MS;
}

/**
 * Smoothed window average from the customer's formula.
 *
 * Samples are in time order, t1 … tn, where tn is the latest value in the window:
 *   St = [ t1 + Σ (t_i · 0.9 + tn · 0.1) for i = 1 … n−1 ] / n
 *
 * n is the number of samples that actually arrived. A 5-minute window with lost
 * packets (for example 5 readings instead of 20) is divided by that count.
 * A flat series is unchanged. An empty list returns null.
 */
export function smoothedWindowAverage(values: readonly number[]): number | null {
  const n = values.length;
  if (n === 0) return null;
  const current = values[n - 1];
  let sum = values[0];
  for (let i = 0; i < n - 1; i++) {
    sum += values[i] * 0.9 + current * 0.1;
  }
  return sum / n;
}

export type TimedValue = { ts: Date; value: number };

/** One smoothed point per 5-minute bucket. `ts` is the start of that bucket. */
export function smoothTimeSeries(points: readonly TimedValue[]): { ts: Date; value: number; count: number }[] {
  const ordered = [...points].sort((a, b) => a.ts.getTime() - b.ts.getTime());
  const buckets = new Map<number, number[]>();
  for (const point of ordered) {
    const start = bucketStartMs(point.ts.getTime());
    const values = buckets.get(start);
    if (values) values.push(point.value);
    else buckets.set(start, [point.value]);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .flatMap(([start, values]) => {
      const value = smoothedWindowAverage(values);
      if (value === null) return [];
      return [{ ts: new Date(start), value, count: values.length }];
    });
}
