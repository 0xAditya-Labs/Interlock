// benchmarking/phases/phase-b-comparative.js
// ─────────────────────────────────────────────────────────────────────────────
// PHASE B: 3-Curve Comparative Benchmark
//
// Runs all three architecture configurations at each of the four load levels
// expressed as multiples of B (the breaking limit found in Phase A):
//   0.5B  → light / normal production load
//   0.7B  → approaching capacity
//   1.0B  → the single-server breaking point
//   1.5B  → heavy overload zone
//
// For each (architecture, load) combination, records p50, p90, p95, p99
// latencies over a 30-second measurement window.
//
// Returns a structured results object for the report generator.
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG } from "../lib/config.js";
import { runLoad } from "../lib/load-runner.js";
import { summarize } from "../lib/stats.js";
import { startArchitecture, stopServers } from "../lib/server-manager.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run the 3-curve comparative benchmark.
 *
 * @param {number} B - Breaking limit (pairs) from Phase A
 * @returns {Promise<Object>} Full results keyed by architecture → load level
 */
export async function runComparativeBenchmark(B) {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  PHASE B — 3-Curve Comparative Benchmark                 ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Breaking Limit B = ${B} pairs`);
  console.log(`  Load levels: ${CONFIG.LOAD_MULTIPLIERS.map((m) => `${m}×B=${Math.round(m * B)}`).join("  ")} pairs`);

  const allResults = {};

  for (const arch of CONFIG.ARCHITECTURES) {
    console.log(`\n━━━ Architecture: "${arch.name}" ━━━`);
    allResults[arch.key] = {
      name: arch.name,
      measurements: [],
    };

    const instances = await startArchitecture(arch);
    await sleep(1500); // Let servers settle

    for (const multiplier of CONFIG.LOAD_MULTIPLIERS) {
      const nPairs = Math.max(1, Math.round(multiplier * B));
      const loadLabel = `${multiplier}B (${nPairs} pairs)`;

      console.log(`\n  Load: ${loadLabel}`);

      try {
        const latencies = await runLoad({
          ports: arch.ports,
          nPairs,
          messageRateHz: CONFIG.MESSAGE_RATE_HZ,
          payloadBytes: CONFIG.PAYLOAD_BYTES,
          warmupSeconds: CONFIG.WARMUP_SECONDS,
          measureSeconds: CONFIG.MEASURE_SECONDS,
        });

        const stats = summarize(latencies);
        console.log(
          `  p50=${stats.p50}ms  p90=${stats.p90}ms  p95=${stats.p95}ms  p99=${stats.p99}ms  n=${stats.count}`
        );

        allResults[arch.key].measurements.push({
          multiplier,
          nPairs,
          loadLabel,
          ...stats,
        });
      } catch (err) {
        console.log(`  OVERLOADED / SATURATED at ${loadLabel}: ${err.message}`);
        allResults[arch.key].measurements.push({
          multiplier,
          nPairs,
          loadLabel,
          p50: 9999,
          p90: 9999,
          p95: 9999,
          p99: 9999,
          mean: 9999,
          min: 9999,
          max: 9999,
          count: 0,
          saturated: true,
        });
      }

      await sleep(2000); // Cool-down between load levels
    }

    stopServers(instances);
    await sleep(2000); // Let ports release before next architecture test
  }

  console.log("\n  ✅ Phase B complete");
  return allResults;
}
