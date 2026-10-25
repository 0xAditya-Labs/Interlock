// benchmarking/lib/server-manager.js
// ─────────────────────────────────────────────────────────────────────────────
// Starts and stops backend server instances for each benchmarked architecture.
// Waits for the /healthz endpoint to become available before resolving.
// ─────────────────────────────────────────────────────────────────────────────

import { spawn } from "child_process";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(__dirname, "../../backend");
const STARTUP_TIMEOUT_MS = 15_000;
const HEALTH_POLL_MS = 250;

/**
 * Poll the /healthz endpoint of a server until it responds 200 or times out.
 * @param {number} port
 * @returns {Promise<void>}
 */
async function waitForHealth(port) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const check = () => {
      if (Date.now() > deadline) {
        return reject(new Error(`Server on port ${port} did not become healthy within ${STARTUP_TIMEOUT_MS}ms`));
      }
      const req = http.get(`http://localhost:${port}/healthz`, (res) => {
        if (res.statusCode === 200) return resolve();
        setTimeout(check, HEALTH_POLL_MS);
      });
      req.on("error", () => setTimeout(check, HEALTH_POLL_MS));
      req.end();
    };
    check();
  });
}

/**
 * Start one backend server instance.
 * @param {number} port
 * @param {Object} env - Extra environment variables to pass in
 * @returns {{ port: number, proc: ChildProcess }}
 */
async function startServer(port, env = {}) {
  const mergedEnv = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "development",
    ...env,
  };

  const proc = spawn("node", ["src/index.js"], {
    cwd: BACKEND_DIR,
    env: mergedEnv,
    stdio: "pipe",   // suppress noisy output during benchmarking
  });

  proc.stderr.on("data", (d) => {
    const msg = d.toString().trim();
    if (msg) process.stderr.write(`  [Server:${port}] ${msg}\n`);
  });

  proc.on("error", (err) => {
    console.error(`[ServerManager] Spawn error on port ${port}:`, err.message);
  });

  await waitForHealth(port);
  console.log(`  [ServerManager] ✓ Port ${port} ready`);
  return { port, proc };
}

/**
 * Start all server instances for a given architecture configuration.
 * @param {Object} arch - Architecture object from CONFIG.ARCHITECTURES
 * @returns {Promise<Array<{ port, proc }>>}
 */
export async function startArchitecture(arch) {
  console.log(`\n[ServerManager] Starting architecture: "${arch.name}"`);
  const instances = [];
  for (const port of arch.ports) {
    const instance = await startServer(port, arch.env);
    instances.push(instance);
  }
  return instances;
}

/**
 * Kill all running server instances.
 * @param {Array<{ port, proc }>} instances
 */
export function stopServers(instances) {
  for (const { port, proc } of instances) {
    proc.kill("SIGTERM");
    console.log(`  [ServerManager] Stopped port ${port}`);
  }
}
