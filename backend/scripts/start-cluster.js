// backend/scripts/start-cluster.js
// ─────────────────────────────────────────────────────────────────────────────
// Cluster orchestrator: starts two Node.js backend instances for distributed
// testing / production use.
//
// Ports used: 5001 (core 0) and 5002 (core 1)
// Linux only: uses taskset + nice to pin each process to a dedicated CPU core,
//             preventing OS scheduling noise during benchmarks.
// Windows/macOS: CPU pinning is skipped gracefully; instances run normally.
//
// Usage:
//   node scripts/start-cluster.js             # normal run
//   BENCHMARK_MODE=true node scripts/start-cluster.js  # benchmark run (no MongoDB)
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from "child_process";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

const isLinux = os.platform() === "linux";

if (!isLinux) {
  console.log(
    `[Cluster] OS: ${os.platform()}. CPU pinning (taskset/nice) is only available on Linux — skipping.`
  );
}

const children = [];

function startInstance(port, coreIndex) {
  const env = { ...process.env, PORT: String(port) };

  let command, args;

  if (isLinux) {
    command = "taskset";
    // taskset -c <core> nice -n -10 node src/index.js
    args = ["-c", String(coreIndex), "nice", "-n", "-10", "node", "src/index.js"];
  } else {
    command = "node";
    args = ["src/index.js"];
  }

  const child = spawn(command, args, {
    cwd: backendRoot,
    env,
    stdio: "inherit",
  });

  child.on("close", (code) => {
    console.log(`[Cluster] Instance on port ${port} exited with code ${code}`);
  });

  child.on("error", (err) => {
    console.error(`[Cluster] Failed to start instance on port ${port}:`, err.message);
  });

  children.push({ port, child });
  console.log(`[Cluster] Started instance on port ${port} (PID: ${child.pid})`);
}

// Start two instances
startInstance(5001, 0);
startInstance(5002, 1);

// ─── Graceful Shutdown ────────────────────────────────────────────────────────
// Ensure child processes are killed when the cluster runner is terminated.
// Without this, pressing Ctrl+C can leave orphan Node.js processes holding ports.

function shutdown(signal) {
  console.log(`\n[Cluster] Received ${signal}. Shutting down all instances…`);
  for (const { port, child } of children) {
    console.log(`[Cluster] Killing instance on port ${port} (PID: ${child.pid})`);
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 2000);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
