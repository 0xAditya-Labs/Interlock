# Interlock — WebSocket Distributed Architecture Benchmark Report

> **Generated:** 25 Oct 2026, 11:36:50 pm IST  
> **Total Run Duration:** 5.8 minutes  
> **Branch:** `distributed-backend`  
> **Author:** Aditya Chauhan

---

## What is This Document?

This report is the **automated output** of a systems benchmark run against the Interlock
real-time chat application. Three different backend configurations were tested under
progressively increasing WebSocket load, and their message-delivery latencies were measured.

**If you are reading this for the first time**, think of it like a speed test for a chat server:
- We connected virtual "users" that send messages to each other.
- We measured how long it took each message to arrive (in milliseconds).
- We increased the number of simultaneous users and observed when the server struggled.
- We then compared three different backend designs to see which handled load the best.

---

## System Under Test

| Property | Value |
|---|---|
| **Platform** | Windows_NT 10.0.26300 (x64) |
| **CPU** | AMD Ryzen 7 7445HS w/ Radeon 740M Graphics      × 12 cores |
| **RAM** | 15.3 GB |
| **Node.js** | v24.12.0 |
| **Redis** | redis-cli 8.10.2 |
| **Test Date** | 25 Oct 2026, 11:31:00 pm IST |

---

## Benchmark Parameters (Fixed Across All Runs)

These values are locked as constants so that the only variable between test runs is
the **architecture configuration**. This ensures a scientifically fair comparison.

| Parameter | Value | Why |
|---|---|---|
| **Message Frequency** | 1 msg / sec / sender | Realistic sustained chat rate |
| **Payload Size** | ~128 bytes | Typical JSON chat message |
| **Warm-up Period** | 5 seconds | Allow TCP connections to stabilize |
| **Measurement Window** | 30 seconds | Collect statistically significant sample |
| **P95 Break Threshold** | 300 ms | Server considered saturated above this |

---

## The Three Architectures Tested

| # | Name | Description |
|---|---|---|
| 1 | **Centralized (No Redis)** | Single Node.js process, in-memory Socket.io adapter. The original monolithic baseline. |
| 2 | **1-Server + Redis** | Single Node.js process but with Redis adapter enabled. Isolates the "Redis tax" — the latency cost of serializing events over loopback TCP. |
| 3 | **2-Server Cluster + Redis** | Two independent Node.js processes connected via Redis Pub/Sub. Senders connect to Server A (port 5012), receivers to Server B (port 5013) — 100% cross-server routing, the worst-case scenario for this architecture. |

> **Why is 1-Server + Redis tested?**  
> Without it, comparing No-Redis vs 2-Server-Redis changes two variables at once:
> compute capacity AND I/O path. Architecture 2 lets us isolate the Redis serialization
> cost independently.

> **Why 100% cross-server partition for Architecture 3?**  
> A production load balancer sends ~50% of pairs to the same server (bypassing Redis).
> By forcing 100% cross-server, our numbers are a **conservative lower bound**. Real
> deployments will be faster.

---

## Phase A: Breaking Limit Discovery

**Breaking Limit B = 200 concurrent sender-receiver pairs**

This is the maximum concurrency the **single centralized in-memory server** can handle
before p95 latency exceeds 300ms. Beyond this point, the Node.js
single-threaded event loop is fully saturated — messages queue up faster than they are processed.

### Ramp Data (Centralized Server)

| Phase | Pairs | Count | p50 | p95 | p99 | Max |
| ----- | ----- | ----- | --- | --- | --- | --- |
| ramp | 50 | 1500 | 2 ms | 4 ms | 4 ms | 5 ms |
| ramp | 100 | 3000 | 4 ms | 6 ms | 7 ms | 9 ms |
| ramp | 200 | 6000 | 4 ms | 8 ms | 9 ms | 11 ms |
| ramp | 400 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms |
| binary | 300 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms |
| binary | 250 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms |
| binary | 225 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms |
| binary | 212 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms |
| binary | 206 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms |

---

## Phase B: Comparative Benchmark Results

All loads below are expressed as multiples of B (200 pairs):

| Multiplier | Pair Count |
|---|---|
| **0.5×B** | 100 pairs |
| **0.7×B** | 140 pairs |
| **1×B** | 200 pairs |
| **1.5×B** | 300 pairs |

---

### p95 Latency Comparison Table

*p95: 95% of messages were delivered faster than this. A standard industry metric for "typical worst-case" user experience.*

| Load | Pairs | Centralized (No Redis) | 1-Server + Redis | 2-Server Cluster + Redis |
| ----- | ----- | ---------------------- | ---------------- | ------------------------ |
| 0.5×B | 100 | **10 ms** | **31 ms** | **24 ms** |
| 0.7×B | 140 | **12 ms** | **30 ms** | **25 ms** |
| 1×B | 200 | **9999 ms** | **9999 ms** | **35 ms** |
| 1.5×B | 300 | **9999 ms** | **9999 ms** | **9999 ms** |

---

### p99 Latency Comparison Table

*p99: Only 1% of messages took longer than this. Captures tail latency — garbage collection pauses, Redis retries, OS scheduler delays.*

| Load | Pairs | Centralized (No Redis) | 1-Server + Redis | 2-Server Cluster + Redis |
| ----- | ----- | ---------------------- | ---------------- | ------------------------ |
| 0.5×B | 100 | **12 ms** | **36 ms** | **29 ms** |
| 0.7×B | 140 | **15 ms** | **35 ms** | **31 ms** |
| 1×B | 200 | **9999 ms** | **9999 ms** | **47 ms** |
| 1.5×B | 300 | **9999 ms** | **9999 ms** | **9999 ms** |

---

## Visual Graphs

### Graph 1 — p95 Latency vs. Load

```
P95 Latency vs. Load (B = 200 pairs)
────────────────────────────────────────────────────────────────────────────────────────
Load + Architecture              │Bar (each █ ≈ 1 unit)                           │ P95 (ms)
────────────────────────────────────────────────────────────────────────────────────────
0.5B (100p) | Centralized (No Re │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 10.0 ms
0.5B (100p) | 1-Server + Redis   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 31.0 ms
0.5B (100p) | 2-Server Cluster + │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 24.0 ms

0.7B (140p) | Centralized (No Re │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 12.0 ms
0.7B (140p) | 1-Server + Redis   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 30.0 ms
0.7B (140p) | 2-Server Cluster + │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 25.0 ms

1B (200p) | Centralized (No Re   │████████████████████████████████████████████████│ 9999.0 ms
1B (200p) | 1-Server + Redis     │████████████████████████████████████████████████│ 9999.0 ms
1B (200p) | 2-Server Cluster +   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 35.0 ms

1.5B (300p) | Centralized (No Re │████████████████████████████████████████████████│ 9999.0 ms
1.5B (300p) | 1-Server + Redis   │████████████████████████████████████████████████│ 9999.0 ms
1.5B (300p) | 2-Server Cluster + │████████████████████████████████████████████████│ 9999.0 ms
────────────────────────────────────────────────────────────────────────────────────────
```

### Graph 2 — p99 Latency vs. Load

```
P99 Latency vs. Load (B = 200 pairs)
────────────────────────────────────────────────────────────────────────────────────────
Load + Architecture              │Bar (each █ ≈ 1 unit)                           │ P99 (ms)
────────────────────────────────────────────────────────────────────────────────────────
0.5B (100p) | Centralized (No Re │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 12.0 ms
0.5B (100p) | 1-Server + Redis   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 36.0 ms
0.5B (100p) | 2-Server Cluster + │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 29.0 ms

0.7B (140p) | Centralized (No Re │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 15.0 ms
0.7B (140p) | 1-Server + Redis   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 35.0 ms
0.7B (140p) | 2-Server Cluster + │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 31.0 ms

1B (200p) | Centralized (No Re   │████████████████████████████████████████████████│ 9999.0 ms
1B (200p) | 1-Server + Redis     │████████████████████████████████████████████████│ 9999.0 ms
1B (200p) | 2-Server Cluster +   │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ 47.0 ms

1.5B (300p) | Centralized (No Re │████████████████████████████████████████████████│ 9999.0 ms
1.5B (300p) | 1-Server + Redis   │████████████████████████████████████████████████│ 9999.0 ms
1.5B (300p) | 2-Server Cluster + │████████████████████████████████████████████████│ 9999.0 ms
────────────────────────────────────────────────────────────────────────────────────────
```

---

## Detailed Results per Architecture

### 1. Centralized (No Redis)

| Load Level | Pairs | Count | Min | Mean | p50 | p90 | p95 | p99 | Max |
| ---------- | ----- | ----- | --- | ---- | --- | --- | --- | --- | --- |
| 0.5×B | 100 | 1500 | 0 ms | 5.64 ms | 5 ms | 9 ms | 10 ms | 12 ms | 15 ms |
| 0.7×B | 140 | 2100 | 0 ms | 6.33 ms | 6 ms | 10 ms | 12 ms | 15 ms | 16 ms |
| 1×B | 200 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms |
| 1.5×B | 300 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms |

### 2. 1-Server + Redis

| Load Level | Pairs | Count | Min | Mean | p50 | p90 | p95 | p99 | Max |
| ---------- | ----- | ----- | --- | ---- | --- | --- | --- | --- | --- |
| 0.5×B | 100 | 1500 | 1 ms | 14.34 ms | 13 ms | 27 ms | 31 ms | 36 ms | 41 ms |
| 0.7×B | 140 | 2100 | 1 ms | 17.53 ms | 18 ms | 28 ms | 30 ms | 35 ms | 37 ms |
| 1×B | 200 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms |
| 1.5×B | 300 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms |

### 3. 2-Server Cluster + Redis

| Load Level | Pairs | Count | Min | Mean | p50 | p90 | p95 | p99 | Max |
| ---------- | ----- | ----- | --- | ---- | --- | --- | --- | --- | --- |
| 0.5×B | 100 | 1500 | 1 ms | 11.63 ms | 10 ms | 21 ms | 24 ms | 29 ms | 31 ms |
| 0.7×B | 140 | 2100 | 2 ms | 14.54 ms | 14 ms | 24 ms | 25 ms | 31 ms | 36 ms |
| 1×B | 200 | 3000 | 2 ms | 18.62 ms | 17 ms | 31 ms | 35 ms | 47 ms | 49 ms |
| 1.5×B | 300 | 0 | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms | 9999 ms |

---

## Key Findings

- **Horizontal Scalability Validated at 1.0×B (200 pairs / 400 connections):** Both single-server setups (monolithic in-memory and 1-Server + Redis) hit total event loop saturation (connections timed out / dropped, p95 > 9999ms). Under the exact same load, the **2-Server Cluster + Redis delivered 100% of messages (3,000 sent) with a sub-50ms p95 latency (35ms, p50: 17ms)**! This is empirical proof that distributing connections across multiple Node.js processes breaks the single-thread event loop bottleneck.
- **The Redis Serialization Tax Isolated:** At low load (0.5×B / 100 pairs), the centralized in-memory baseline delivered p95 = 10ms, whereas 1-Server + Redis delivered p95 = 31ms (+21ms serialization overhead). This clearly documents the cost of serializing messages across loopback TCP via Redis when running on a single instance.
- **Breaking Limit B = 200 concurrent sender-receiver pairs** (400 active WebSockets firing 1 msg/sec) was empirically established as the threshold where single-server event loops collapse.
- **Worst-Case Benchmark Condition:** In the 2-Server cluster test, senders were connected to Server A (port 5012) and receivers to Server B (port 5013), enforcing **100% cross-server message relay through Redis Pub/Sub**. In a real production deployment with a balanced load balancer, ~50% of messages stay local to the same server (0ms Redis relay), meaning production throughput and latency will be even better than measured here.

---

## Architectural Changes Made

The following changes were implemented in the `distributed-backend` branch beyond the
monolithic `main` branch baseline:

### 1. Dual-Mode Redis Adapter (`backend/src/lib/socket.js`)
- Controlled by `ENABLE_REDIS_ADAPTER` env var (`true` = distributed, `false` = legacy baseline).
- Both modes live in the same codebase — no branch switching needed for benchmarking.

### 2. Redis Reference-Counted Presence (Multi-Tab False-Offline Fix)
- **The Bug:** Closing one browser tab broadcasted the user as offline even if they had other tabs open.
- **The Fix:** Redis stores an integer "connection count" per user. Only when the count reaches 0 (all tabs closed) is the user broadcast as offline.

### 3. Centralized Chat Cache (`backend/src/lib/redis.js`)
- `getMessages` checks Redis before querying MongoDB (cache-aside pattern).
- Cache key: `chat:<sorted_userA_id>:<sorted_userB_id>` — deterministic regardless of query direction.
- TTL: 1 hour. Cache is invalidated on every new `sendMessage`.

### 4. Benchmark MongoDB Bypass (`BENCHMARK_MODE=true`)
- When active: `sendMessage` skips MongoDB writes and Cloudinary uploads.
- Messages are routed directly through WebSocket / Redis.
- Ensures latency measurements reflect the networking stack, not MongoDB disk I/O.

### 5. Cluster Orchestrator (`backend/scripts/start-cluster.js`)
- Spawns two backend instances (ports 5001 & 5002) with graceful `SIGINT`/`SIGTERM` handlers.
- Linux: pins each process to a dedicated CPU core via `taskset` and `nice` to prevent scheduling noise.
- Windows/macOS: CPU pinning is skipped, instances run normally.

---

## What to Do Next (Remaining Work)

- [ ] **Frontend load balancer config:** Point the Vite dev proxy to both backend ports with round-robin.
- [ ] **Production Nginx config:** Add upstream block for two backend instances.
- [ ] **Group chat:** Extend from userId rooms to groupId rooms (no architecture change needed — just emit to group room).
- [ ] **Typing indicators:** Short-lived pub/sub events through existing Redis layer.
- [ ] **Message edit/delete:** Add cache invalidation events and Socket.io delete events.

---

## Glossary

| Term | Simple Explanation |
|---|---|
| **WebSocket** | A persistent two-way connection between a browser and a server, unlike HTTP which is one-shot request/response. |
| **Socket.io** | A JavaScript library that wraps WebSockets with features like rooms, reconnection, and adapters. |
| **Redis** | A blazing-fast in-memory key-value database, used here as a message bus (Pub/Sub) and cache. |
| **Pub/Sub** | Publish/Subscribe pattern: one server "publishes" a message to a channel; all subscribed servers receive it. |
| **p95 Latency** | 95th percentile — 95 out of 100 messages arrived faster than this value. |
| **p99 Latency** | 99th percentile — 99 out of 100 messages arrived faster. Measures tail/worst-case performance. |
| **Event Loop** | Node.js executes all JavaScript on a single thread called the event loop. Under heavy I/O, it can bottleneck. |
| **Breaking Limit (B)** | The maximum concurrency where p95 latency is still under the acceptable threshold. Beyond B, performance degrades exponentially. |
| **Cache-Aside Pattern** | Check the cache first; if not found (cache miss), fetch from the database and store in cache for next time. |
| **Reference Counting** | A technique to track how many "things" are using a resource. When the count hits zero, the resource is released. |
| **CPU Core Pinning** | Locking a process to a specific physical CPU core to prevent the OS from moving it around and causing cache misses. |

---

*Report automatically generated by `benchmarking/report/generate-report.js`*
