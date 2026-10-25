// benchmarking/phases/phase-a-find-B.js
// ─────────────────────────────────────────────────────────────────────────────
// PHASE A: Breaking Limit Discovery
//
// Runs only against the CENTRALIZED server (no Redis) to establish B —
// the maximum concurrent client-pairs the single-node event loop can handle
// before p95 latency exceeds CONFIG.P95_BREAK_THRESHOLD_MS.
//
// Algorithm:
//   1. Coarse exponential ramp: 50 → 100 → 200 → 400 → … pairs
//      Stop when p95 crosses the break threshold.
//   2. Binary search between the last-passing and first-failing load levels
//      to pinpoint B to within one binary search step.
//
// Returns the integer B (number of concurrent client pairs at saturation).
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG } from "../lib/config.js";
import { runLoad } from "../lib/load-runner.js";
import { summarize } from "../lib/stats.js";
import { startArchitecture, stopServers } from "../lib/server-manager.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run one measurement at a given load level on the centralized server.
 * @param {number[]} ports
 * @param {number} nPairs
 * @returns {Promise<{ nPairs, stats }>}
 */
async function measure(ports, nPairs) {
  console.log(`  → Testing ${nPairs} pairs…`);
  try {
    const latencies = await runLoad({
      ports,
      nPairs,
      messageRateHz: CONFIG.MESSAGE_RATE_HZ,
      payloadBytes: CONFIG.PAYLOAD_BYTES,
      warmupSeconds: CONFIG.WARMUP_SECONDS,
      measureSeconds: CONFIG.MEASURE_SECONDS,
    });
    const stats = summarize(latencies);
    console.log(`     n=${nPairs}  p95=${stats.p95}ms  p99=${stats.p99}ms  count=${stats.count}`);
    return { nPairs, stats };
  } catch (err) {
    console.log(`     n=${nPairs}  BREAK: ${err.message} (server saturated, event loop / socket backlog full)`);
    return {
      nPairs,
      stats: {
        p50: 9999,
        p90: 9999,
        p95: 9999,
        p99: 9999,
        mean: 9999,
        min: 9999,
        max: 9999,
        count: 0,
        saturated: true,
      },
    };
  }
}

/**
 * Discover B using coarse ramp + binary search.
 * @returns {Promise<{ B: number, rampData: Array }>}
 */
export async function findBreakingLimit() {
  // Use the Centralized (no Redis) architecture config
  const arch = CONFIG.ARCHITECTURES.find((a) => a.key === "centralized");
  if (!arch) throw new Error("Centralized architecture config not found");

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  PHASE A — Breaking Limit (B) Discovery                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Break threshold: p95 > ${CONFIG.P95_BREAK_THRESHOLD_MS}ms`);
  console.log(`  Message rate: ${CONFIG.MESSAGE_RATE_HZ} Hz  |  Payload: ~${CONFIG.PAYLOAD_BYTES} bytes`);
  console.log(`  Warm-up: ${CONFIG.WARMUP_SECONDS}s  |  Measure: ${CONFIG.MEASURE_SECONDS}s\n`);

  const instances = await startArchitecture(arch);
  await sleep(1000); // Let the server settle after startup

  const rampData = [];
  let lo = CONFIG.CLIENT_START;
  let hi = CONFIG.CLIENT_MAX;
  let lastPassing = lo;
  let firstFailing = hi;

  // ── Step 1: Coarse exponential ramp ──────────────────────────────────────
  console.log("Step 1: Coarse ramp…");
  let current = CONFIG.CLIENT_START;
  let broke = false;

  while (current <= CONFIG.CLIENT_MAX) {
    const { nPairs, stats } = await measure(arch.ports, current);
    rampData.push({ phase: "ramp", nPairs, ...stats });

    if (stats.p95 > CONFIG.P95_BREAK_THRESHOLD_MS || stats.count === 0) {
      firstFailing = current;
      broke = true;
      break;
    } else {
      lastPassing = current;
    }
    lo = current;
    current = Math.min(current * 2, CONFIG.CLIENT_MAX);
    await sleep(2000); // Brief pause between ramp steps
  }

  if (!broke) {
    console.log(`  ⚠️  Server did not break below CLIENT_MAX=${CONFIG.CLIENT_MAX}. Using CLIENT_MAX as B.`);
    stopServers(instances);
    return { B: CONFIG.CLIENT_MAX, rampData };
  }

  // ── Step 2: Binary search between lastPassing and firstFailing ────────────
  console.log(`\nStep 2: Binary search between ${lastPassing} and ${firstFailing} pairs…`);
  lo = lastPassing;
  hi = firstFailing;

  for (let step = 0; step < CONFIG.BINARY_SEARCH_STEPS; step++) {
    const mid = Math.floor((lo + hi) / 2);
    if (mid === lo || mid === hi) break;

    const { stats } = await measure(arch.ports, mid);
    rampData.push({ phase: "binary", nPairs: mid, ...stats });

    if (stats.p95 > CONFIG.P95_BREAK_THRESHOLD_MS || stats.count === 0) {
      hi = mid;
      firstFailing = mid;
    } else {
      lo = mid;
      lastPassing = mid;
    }
    await sleep(2000);
  }

  stopServers(instances);
  await sleep(1000);

  const B = lastPassing;
  console.log(`\n  ✅ Breaking Limit B = ${B} concurrent client pairs`);
  return { B, rampData };
}
