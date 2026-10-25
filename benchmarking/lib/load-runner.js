// benchmarking/lib/load-runner.js
// ─────────────────────────────────────────────────────────────────────────────
// Core load generator.
//
// Creates N_PAIRS of (sender, receiver) WebSocket connections.
// Each sender emits a timestamped message every (1 / MESSAGE_RATE_HZ) seconds.
// Each receiver records the delivery latency: Δt = t_receive – t_sent
//
// Architecture notes:
//   • For a single-port architecture, both senders and receivers connect to
//     that one port (normal balanced behaviour).
//   • For a two-port architecture (e.g., 2-Server cluster), senders connect
//     to ports[0] and receivers connect to ports[1], forcing 100% cross-server
//     message relay through Redis — the worst-case stress test.
//
// Returns an array of latency values (ms) collected during the MEASURE window.
// ─────────────────────────────────────────────────────────────────────────────

import { io as ioClient } from "socket.io-client";

/** Per-socket connection timeout in ms. Keep short so a saturated server fails fast. */
const CONNECT_TIMEOUT_MS = 5_000;

/**
 * Sleep helper.
 * @param {number} ms
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Build a deterministic payload of approximately `targetBytes` bytes.
 * Uses a simple repeated-character string so JSON serialization size is stable.
 * @param {number} targetBytes
 */
function buildPayload(targetBytes) {
  // The JSON wrapper {"text":"...","sentAt":1700000000000} is ~30 chars
  const padLength = Math.max(1, targetBytes - 50);
  return "x".repeat(padLength);
}

/**
 * Connect one Socket.io client and wait for the "connect" event.
 * Fails fast with a hard timeout so saturated servers don't block indefinitely.
 * @param {string} url
 * @param {string} userId  Fake user ID string (no real auth in benchmark mode)
 * @returns {Promise<Socket>}
 */
function connectClient(url, userId) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`connect timeout after ${CONNECT_TIMEOUT_MS}ms`)),
      CONNECT_TIMEOUT_MS
    );
    const socket = ioClient(url, {
      query: { userId },
      transports: ["websocket"],
      reconnection: false,
      timeout: CONNECT_TIMEOUT_MS,
    });
    socket.once("connect", () => { clearTimeout(timer); resolve(socket); });
    socket.once("connect_error", (err) => { clearTimeout(timer); reject(err); });
  });
}

/**
 * Run a single latency measurement window.
 *
 * @param {Object} opts
 * @param {number[]} opts.ports           - Server ports to use
 * @param {number}   opts.nPairs         - Number of sender/receiver pairs
 * @param {number}   opts.messageRateHz  - Messages per sender per second
 * @param {number}   opts.payloadBytes   - Target payload size in bytes
 * @param {number}   opts.warmupSeconds  - Discard results during warm-up
 * @param {number}   opts.measureSeconds - How long to collect latencies
 *
 * @returns {Promise<number[]>} Array of end-to-end latencies in milliseconds
 */
/**
 * Hard-timeout wrapper: rejects after `ms` milliseconds.
 */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timeout after ${ms}ms waiting for ${label}`)),
      ms
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

export function runLoad(opts) {
  const { warmupSeconds, measureSeconds } = opts;
  // Hard deadline: connection phase budget (30s) + warmup + measure + teardown buffer (5s)
  const CONNECTION_BUDGET_MS = 30_000;
  const hardDeadlineMs = CONNECTION_BUDGET_MS + (warmupSeconds + measureSeconds) * 1000 + 5_000;

  return withTimeout(_runLoad(opts), hardDeadlineMs, "runLoad");
}

async function _runLoad(opts) {
  const {
    ports,
    nPairs,
    messageRateHz,
    payloadBytes,
    warmupSeconds,
    measureSeconds,
  } = opts;

  const senderUrl   = `http://localhost:${ports[0]}`;
  const receiverUrl = `http://localhost:${ports[ports.length - 1]}`;

  const intervalMs = 1000 / messageRateHz;
  const payload    = buildPayload(payloadBytes);
  const latencies  = [];
  let measuring    = false;

  const receiverSockets = [];
  const senderSockets = [];
  let intervals = [];

  try {
    // ── 1. Connect all receivers in small batches (allSettled = survive partial failures) ──
    const BATCH_SIZE = 25;
    for (let i = 0; i < nPairs; i += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, nPairs - i);
      const batchPromises = [];
      for (let j = 0; j < batchCount; j++) {
        const idx = i + j;
        const receiverId = `bench_receiver_${idx}`;
        batchPromises.push(
          connectClient(receiverUrl, receiverId).then((sock) => {
            sock.on("newMessage", (msg) => {
              if (!measuring) return;
              const now = Date.now();
              const sentAt = Number(msg.sentAt);
              if (sentAt && now - sentAt < 60_000) {
                latencies.push(now - sentAt);
              }
            });
            return sock;
          })
        );
      }
      const results = await Promise.allSettled(batchPromises);
      for (const r of results) {
        if (r.status === "fulfilled") receiverSockets.push(r.value);
      }
      if (i + BATCH_SIZE < nPairs) await sleep(25);
    }

    // ── 2. Connect all senders in small batches ────────────────────────────
    for (let i = 0; i < nPairs; i += BATCH_SIZE) {
      const batchCount = Math.min(BATCH_SIZE, nPairs - i);
      const batchPromises = [];
      for (let j = 0; j < batchCount; j++) {
        const idx = i + j;
        const senderId = `bench_sender_${idx}`;
        const receiverId = `bench_receiver_${idx}`;
        batchPromises.push(
          connectClient(senderUrl, senderId).then((sock) => ({ sock, receiverId }))
        );
      }
      const results = await Promise.allSettled(batchPromises);
      for (const r of results) {
        if (r.status === "fulfilled") senderSockets.push(r.value);
      }
      if (i + BATCH_SIZE < nPairs) await sleep(25);
    }

    // If almost no sockets connected, the server is completely saturated
    if (senderSockets.length < 5 || receiverSockets.length < 5) {
      throw new Error(
        `too few sockets connected (${senderSockets.length} senders, ${receiverSockets.length} receivers) — server saturated`
      );
    }

    // ── 3. Start sending ───────────────────────────────────────────────────
    intervals = senderSockets.map(({ sock, receiverId }) => {
      return setInterval(() => {
        if (!sock.connected) return;
        sock.emit("benchmarkMessage", {
          receiverId,
          text: payload,
          sentAt: Date.now(),
        });
      }, intervalMs);
    });

    // ── 4. Wait for warm-up ─────────────────────────────────────────────────
    await sleep(warmupSeconds * 1000);
    measuring = true;

    // ── 5. Collect measurements ────────────────────────────────────────────
    await sleep(measureSeconds * 1000);
    measuring = false;

    // If no latencies were recorded the server silently dropped all messages
    // (event loop saturated, sockets open but processing stalled). Treat as overload.
    if (latencies.length === 0) {
      throw new Error(`zero latencies collected — server saturated (accepted sockets but stalled)`);
    }

    return latencies;
  } finally {
    // ── 6. Teardown & cleanup ──────────────────────────────────────────────
    intervals.forEach(clearInterval);
    for (const { sock } of senderSockets) {
      try { sock.disconnect(); } catch (_) {}
    }
    for (const sock of receiverSockets) {
      try { sock.disconnect(); } catch (_) {}
    }
    await sleep(500);
  }
}
