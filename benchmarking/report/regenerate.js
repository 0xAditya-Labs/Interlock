// benchmarking/report/regenerate.js
// ─────────────────────────────────────────────────────────────────────────────
// Regenerates the benchmark report from saved raw JSON files without re-running tests.
// Usage: node benchmarking/report/regenerate.js
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, existsSync } from "fs";
import path from "path";
import { CONFIG } from "../lib/config.js";
import { generateReport } from "./generate-report.js";

const phaseAPath = path.join(CONFIG.RESULTS_DIR, "phase-a-raw.json");
const phaseBPath = path.join(CONFIG.RESULTS_DIR, "phase-b-raw.json");

if (!existsSync(phaseBPath)) {
  console.error("Error: phase-b-raw.json not found in " + CONFIG.RESULTS_DIR);
  process.exit(1);
}

let rampData = [];
if (existsSync(phaseAPath)) {
  try {
    const rawA = JSON.parse(readFileSync(phaseAPath, "utf8"));
    rampData = rawA.rampData || [];
  } catch {}
}

const rawB = JSON.parse(readFileSync(phaseBPath, "utf8"));
const B = rawB.B || 200;
const phaseB = rawB.phaseB;

const reportPath = generateReport({
  B,
  rampData,
  phaseB,
  startTime: new Date(Date.now() - 350_000),
  endTime: new Date(),
});

console.log(`[Regenerate] Report updated successfully at: ${reportPath}`);
