// benchmarking/run-benchmark.js
// ─────────────────────────────────────────────────────────────────────────────
// BENCHMARK ORCHESTRATOR — Entry point
//
// Runs the full benchmark pipeline end-to-end:
//   Phase A → Find Breaking Limit (B) on Centralized server
//   Phase B → 3-Curve Comparative Benchmark at 0.5B, 0.7B, 1.0B, 1.5B
//   Report  → Generate Markdown report with tables, ASCII graphs, findings
//
// Usage:
//   node benchmarking/run-benchmark.js
//   node benchmarking/run-benchmark.js --skip-phase-a --B=300  (known B)
//
// Requires: Redis running locally on port 6379 (default)
//           Backend .env present at backend/.env
// ─────────────────────────────────────────────────────────────────────────────

import { findBreakingLimit } from "./phases/phase-a-find-B.js";
import { runComparativeBenchmark } from "./phases/phase-b-comparative.js";
import { generateReport } from "./report/generate-report.js";
import { CONFIG } from "./lib/config.js";
import { mkdirSync, writeFileSync, existsSync, readFileSync } from "fs";
import path from "path";

// ── Parse CLI arguments ───────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter((a) => a.startsWith("--"))
    .map((a) => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    })
);

const SKIP_PHASE_A = args["skip-phase-a"] === true || args["skip-phase-a"] === "true";
const FORCED_B    = args["B"]    ? parseInt(args["B"], 10) : null;
const FAST_MODE   = args["fast"] === true || args["fast"] === "true";

// --fast: shrink warmup/measure so the full suite finishes in ~5 minutes
if (FAST_MODE) {
  CONFIG.WARMUP_SECONDS  = 3;
  CONFIG.MEASURE_SECONDS = 15;
  console.log("  ⚡ FAST MODE — warmup=3s, measure=15s");
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║     INTERLOCK — Distributed Backend Benchmark Suite      ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Config: ${CONFIG.MESSAGE_RATE_HZ}Hz, ~${CONFIG.PAYLOAD_BYTES}B payload`);
  console.log(`  Warm-up: ${CONFIG.WARMUP_SECONDS}s | Measure: ${CONFIG.MEASURE_SECONDS}s`);
  console.log(`  Results → ${CONFIG.RESULTS_DIR}\n`);

  mkdirSync(CONFIG.RESULTS_DIR, { recursive: true });
  const startTime = new Date();

  let B, rampData;

  // ── Phase A ───────────────────────────────────────────────────────────────
  if (SKIP_PHASE_A && FORCED_B) {
    B = FORCED_B;
    const phaseAPath = path.join(CONFIG.RESULTS_DIR, "phase-a-raw.json");
    if (existsSync(phaseAPath)) {
      try {
        const raw = JSON.parse(readFileSync(phaseAPath, "utf8"));
        rampData = raw.rampData || [];
      } catch {
        rampData = [];
      }
    } else {
      rampData = [];
    }
    console.log(`\n[Orchestrator] Skipping Phase A. Using B = ${B} (from --B argument). Loaded ${rampData.length} ramp data points.`);
  } else {
    const phaseAResult = await findBreakingLimit();
    B = phaseAResult.B;
    rampData = phaseAResult.rampData;

    // Save Phase A raw results
    const phaseAPath = path.join(CONFIG.RESULTS_DIR, "phase-a-raw.json");
    writeFileSync(phaseAPath, JSON.stringify({ B, rampData }, null, 2), "utf8");
    console.log(`  💾 Phase A data saved → ${phaseAPath}`);
  }

  // ── Phase B ───────────────────────────────────────────────────────────────
  const phaseB = await runComparativeBenchmark(B);

  // Save Phase B raw results
  const phaseBPath = path.join(CONFIG.RESULTS_DIR, "phase-b-raw.json");
  writeFileSync(phaseBPath, JSON.stringify({ B, phaseB }, null, 2), "utf8");
  console.log(`  💾 Phase B data saved → ${phaseBPath}`);

  // ── Report ────────────────────────────────────────────────────────────────
  const endTime = new Date();
  const reportPath = generateReport({ B, rampData, phaseB, startTime, endTime });

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                  BENCHMARK COMPLETE ✅                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  Breaking Limit B = ${B} pairs`);
  console.log(`  Report           → ${reportPath}`);
  console.log(`  Phase A raw      → ${CONFIG.RESULTS_DIR}/phase-a-raw.json`);
  console.log(`  Phase B raw      → ${CONFIG.RESULTS_DIR}/phase-b-raw.json`);
  console.log(`  Total duration   → ${((endTime - startTime) / 60_000).toFixed(1)} minutes\n`);
}

main().catch((err) => {
  console.error("\n[Orchestrator] FATAL ERROR:", err);
  process.exit(1);
});
