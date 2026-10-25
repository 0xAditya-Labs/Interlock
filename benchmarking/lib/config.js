// benchmarking/lib/config.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all benchmark configuration constants.
// Edit ONLY this file to change test parameters.
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  // ── Message parameters ────────────────────────────────────────────────────
  // Fixed across ALL runs to ensure a fair scientific comparison.
  MESSAGE_RATE_HZ: 1,          // Sends per sender per second
  PAYLOAD_BYTES: 128,           // Target size of each message payload (bytes)
  WARMUP_SECONDS: 5,            // Warm-up time before measurement starts
  MEASURE_SECONDS: 30,          // Measurement window duration

  // ── Phase A: Binary-search ramp for finding B ─────────────────────────────
  // We start at CLIENT_START pairs and double until latency breaks, then
  // binary-search to find the exact knee within BINARY_SEARCH_STEPS steps.
  CLIENT_START: 50,             // Starting client pairs for B discovery
  CLIENT_MAX: 2000,             // Safety ceiling — stop even if no break found
  P95_BREAK_THRESHOLD_MS: 300,  // A p95 above this marks the server as saturated
  BINARY_SEARCH_STEPS: 5,       // Precision rounds after the coarse ramp

  // ── Phase B: Comparative benchmark load levels ────────────────────────────
  // Expressed as multiples of B (discovered in Phase A)
  LOAD_MULTIPLIERS: [0.5, 0.7, 1.0, 1.5],

  // ── Architectures under test ──────────────────────────────────────────────
  ARCHITECTURES: [
    {
      name: "Centralized (No Redis)",
      key: "centralized",
      env: { ENABLE_REDIS_ADAPTER: "false", BENCHMARK_MODE: "true" },
      ports: [5010],                  // Single server
    },
    {
      name: "1-Server + Redis",
      key: "one_redis",
      env: { ENABLE_REDIS_ADAPTER: "true", BENCHMARK_MODE: "true" },
      ports: [5011],                  // Single server, Redis adapter enabled
    },
    {
      name: "2-Server Cluster + Redis",
      key: "two_redis",
      env: { ENABLE_REDIS_ADAPTER: "true", BENCHMARK_MODE: "true" },
      ports: [5012, 5013],            // Senders → 5012, Receivers → 5013 (worst case)
    },
  ],

  // ── Redis ─────────────────────────────────────────────────────────────────
  REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",

  // ── Output paths ─────────────────────────────────────────────────────────
  RESULTS_DIR: "./benchmarking/results",
  REPORT_PATH: "./benchmarking/results/BENCHMARK_REPORT.md",
};
