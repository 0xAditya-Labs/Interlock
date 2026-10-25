// benchmarking/lib/stats.js
// ─────────────────────────────────────────────────────────────────────────────
// Statistical helpers: percentile, mean, standard-deviation.
// All inputs are arrays of latency values in milliseconds.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the p-th percentile of the sorted latency array.
 * Uses the nearest-rank method.
 *
 * @param {number[]} sortedMs - Array of latencies sorted ascending
 * @param {number}   p        - Percentile (0–100)
 * @returns {number} Latency at that percentile, in ms
 */
export function percentile(sortedMs, p) {
  if (!sortedMs.length) return 0;
  const idx = Math.ceil((p / 100) * sortedMs.length) - 1;
  return sortedMs[Math.max(0, idx)];
}

/**
 * Arithmetic mean.
 * @param {number[]} arr
 * @returns {number}
 */
export function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Minimum of an array.
 * @param {number[]} arr
 * @returns {number}
 */
export function min(arr) {
  if (!arr.length) return 0;
  return Math.min(...arr);
}

/**
 * Maximum of an array.
 * @param {number[]} arr
 * @returns {number}
 */
export function max(arr) {
  if (!arr.length) return 0;
  return Math.max(...arr);
}

/**
 * Computes a full statistics object from a latency array.
 * @param {number[]} latenciesMs - Raw unsorted latency values (ms)
 * @returns {{ count, min, max, mean, p50, p90, p95, p99 }}
 */
export function summarize(latenciesMs) {
  if (!latenciesMs.length) {
    return { count: 0, min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    count:  sorted.length,
    min:    min(sorted),
    max:    max(sorted),
    mean:   parseFloat(mean(sorted).toFixed(2)),
    p50:    parseFloat(percentile(sorted, 50).toFixed(2)),
    p90:    parseFloat(percentile(sorted, 90).toFixed(2)),
    p95:    parseFloat(percentile(sorted, 95).toFixed(2)),
    p99:    parseFloat(percentile(sorted, 99).toFixed(2)),
  };
}
