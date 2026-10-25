# Interlock — Benchmarking Guide

> How the automated load benchmark works, what each number means, and how to interpret the final report.

---

## Overview

The benchmark engine is a self-contained Node.js suite in the `benchmarking/` folder. It:

1. **Phase A** — Discovers the breaking limit **B** of a single centralized server using binary search
2. **Phase B** — Runs all three architectures at 0.5B, 0.7B, 1B, and 1.5B load and collects latency statistics
3. **Report** — Generates a human-readable Markdown file with tables, ASCII bar charts, key findings, and system metadata

---

## What is Being Measured

Each "client pair" = one **sender** + one **receiver**, both connected via WebSocket.

```
Sender ──── benchmarkMessage ────► Server ────► Redis (if enabled) ────► Server ────► Receiver
                                                                                          │
                                                                                    records:
                                                                                  now() - msg.sentAt
```

**Latency** = `Date.now()` at receiver − `sentAt` timestamp embedded in the message by the sender.

This is **end-to-end wall-clock latency** for a single message, including:
- Event loop queue time on the server
- Redis Pub/Sub relay time (if cross-instance)
- TCP round-trip time (loopback in this setup)
- Node.js event processing on receiver side

It is **not** a network RTT ping — it is the full delivery latency of a real chat message.

---

## Understanding Percentiles

We collect all latency samples from the 30-second measurement window and compute:

| Metric | Meaning |
|---|---|
| **p50** | Median — half of messages were faster than this |
| **p90** | 90% of messages were faster. A good "typical" measure. |
| **p95** | Only 5% of messages were slower. The "worst-case most users experience." |
| **p99** | Only 1% of messages were slower. Captures tail latency: GC pauses, Redis retries, OS scheduler noise. |

**Why not just report the average?**  
Averages are deceptive with latency distributions. If 99 messages take 5ms and one takes 5000ms, the average is ~55ms — which sounds bad, but the user experience for 99% of messages is excellent. Percentiles tell the real story.

---

## Phase A: Finding Breaking Limit B

### Algorithm

1. Start at 50 pairs, double until saturation (`p95 > 300ms` or connection timeout)
2. Binary search between last good and first bad count (5 rounds)
3. Return the highest pair count that stayed healthy = **B**

### What "Saturated" Means

A server is considered saturated when either:
- `p95 > 300ms` — messages are being delivered but slowly (event loop queued)
- Zero latencies collected despite sockets connecting — server accepted connections but stalled on message processing

### Why B = 200?

On the test machine (Windows, `~10th gen Intel, 16 cores, Node.js 20`), the single centralized server handles up to 200 sender+receiver pairs (400 simultaneous WebSocket connections) firing at 1 Hz before p95 latency collapses.

B is **machine-dependent** — rerunning Phase A on a different machine will give a different B. This is intentional: the benchmark is relative, not absolute. B is just the shared baseline used to make Phase B comparisons fair.

---

## Phase B: Architecture Comparison

### The Three Curves

| Architecture | What It Tests |
|---|---|
| **Centralized (No Redis)** | The original single-process monolith. Baseline. |
| **1-Server + Redis** | Same single process, but Redis adapter enabled. Measures the "Redis serialization tax." |
| **2-Server Cluster + Redis** | Two independent processes, 100% cross-server routing. Measures horizontal scaling gain. |

### Load Levels

| Multiplier | Pairs | Meaning |
|---|---|---|
| **0.5×B** | 100 | Comfortable production load — well under capacity |
| **0.7×B** | 140 | Approaching capacity — this is where scaling decisions get made |
| **1.0×B** | 200 | The exact breaking point for the centralized server |
| **1.5×B** | 300 | Heavy overload — what happens after you go viral |

---

## Running the Benchmark

### Requirements

- Node.js ≥ 18
- Redis running on `127.0.0.1:6379`
- `backend/.env` with at minimum `JWT_SECRET` and `MONGO_URI` (or `BENCHMARK_MODE=true` is set automatically by the runner)

### Commands

```bash
# Full run (Phase A + Phase B + Report) — takes ~15 minutes
npm run benchmark

# Full run, fast mode (3s warmup / 15s measure) — takes ~5 minutes
node benchmarking/run-benchmark.js --fast

# Skip Phase A (use known B=200)
node benchmarking/run-benchmark.js --skip-phase-a --B=200

# Skip Phase A + fast mode
node benchmarking/run-benchmark.js --skip-phase-a --B=200 --fast
```

### Output Files

```
benchmarking/results/
├── phase-a-raw.json         # All ramp measurements from Phase A
├── phase-b-raw.json         # All latency measurements from Phase B
└── BENCHMARK_REPORT.md      # ← Human-readable report
```

---

## Architecture: How the Engine Works

```
run-benchmark.js (orchestrator)
    │
    ├── phase-a-find-B.js
    │       └── load-runner.js → server-manager.js
    │
    ├── phase-b-comparative.js
    │       └── load-runner.js → server-manager.js
    │
    └── generate-report.js
```

### `server-manager.js`

- Uses `child_process.spawn` to start backend instances as separate OS processes
- Passes environment variables (`PORT`, `ENABLE_REDIS_ADAPTER`, `BENCHMARK_MODE`) to each child
- Polls `/healthz` every 250ms until the server is ready (or 15s timeout)
- Kills processes cleanly between test phases

### `load-runner.js`

- Connects WebSocket clients in **batches of 25** to avoid OS TCP exhaustion during connection phase
- Senders emit `benchmarkMessage` events at 1 Hz with a `sentAt` timestamp
- Receivers listen for `newMessage` events and record `Date.now() - sentAt`
- After warmup+measure window, if zero latencies were collected (server accepted connections but stalled), throws a saturation error

### `stats.js`

- Sorts all collected latency samples
- Computes p50, p90, p95, p99 using nearest-rank method
- Returns a clean stats object for the report generator

### `generate-report.js`

- Reads system metadata (OS, CPU, Node version, Redis version)
- Builds Markdown tables for p95 and p99 across all architectures
- Renders ASCII bar charts for visual comparison
- Writes the report to `benchmarking/results/BENCHMARK_REPORT.md`

---

## Benchmark Mode Flag

The backend uses `BENCHMARK_MODE=true` to skip MongoDB and Cloudinary during benchmarking:

```js
// message.controller.js — sendMessage
if (process.env.BENCHMARK_MODE === "true") {
  // Skip DB write, skip Cloudinary, just route via socket
  io.to(receiverId).emit("newMessage", { text, sentAt });
  return res.status(200).json({ ok: true });
}
```

Without this, latency numbers would include MongoDB write latency (~5-30ms on Atlas) and Cloudinary upload time — which are real-world costs, but not what we're trying to measure (the WebSocket and Redis architecture).

---

## Interpreting the Report

### "Saturated" Entries

When a cell in the table shows `9999ms` or a row is marked `SATURATED`, it means the server could not deliver any messages at that load level within the timeout window. The number `9999` is a sentinel value — not an actual latency.

### The Redis Tax

The "1-Server + Redis" row at 0.5B load will typically show slightly higher latency than "Centralized (No Redis)". This is the **Redis serialization overhead**: even though only one server is running, every `io.emit` must now:
1. Serialize the socket event to JSON
2. PUBLISH it to Redis over loopback TCP
3. SUBSCRIBE receives it back
4. Deserialize and emit to the local socket

On loopback, this adds ~3-5ms. In a real cluster, this overhead is the price you pay to gain horizontal scalability.

### The Cluster Benefit

The "2-Server Cluster + Redis" row at 1B load (where the centralized server saturates) should show healthy latency. This is the payoff — the same load that crashes one server is shared between two, each handling half the connections.

---

*Part of the Interlock project — [`README.md`](../README.md) | [`DISTRIBUTED_ARCHITECTURE.md`](./DISTRIBUTED_ARCHITECTURE.md)*
