# Implementation Notes & Technical Justifications

## Phase 1 — Dual-Mode Adapter Architecture

### What Was Done
- Installed `ioredis` and `@socket.io/redis-adapter` to enable distributed WebSocket pub/sub across multiple Node.js instances.
- Modified `backend/src/lib/socket.js` to conditionally initialize the Redis adapter based on the `ENABLE_REDIS_ADAPTER` environment variable.
- Created `backend/scripts/start-cluster.js` and a `start:cluster` npm script to launch two parallel backend instances (on ports 5001 and 5002). The script includes OS detection to apply Linux-specific `taskset` and `nice` CPU pinning for clean benchmark isolation, gracefully falling back on Windows/macOS.
- Migrated message delivery in `backend/src/controllers/message.controller.js` to use Socket.io rooms keyed strictly by `userId` (e.g., `socket.join(userId)` and `io.to(receiverId).emit()`).

### Technical Justifications & Design Choices
1. **Dual-Mode Adapter (`ENABLE_REDIS_ADAPTER`)**: We need a baseline to prove the value (and the cost) of the Redis adapter. By conditionally loading it, we can run the identical codebase in a "legacy" purely in-memory mode without switching git branches, avoiding file-lock or socket cleanup friction during automated benchmark loops.
2. **Room-Based Message Routing**: Previously, the system mapped `userId -> socketId` in a local memory object. In a distributed setup, User A (on Server 1) has no idea what User B's `socketId` is if User B is connected to Server 2. By making users join a room named after their own `userId`, Server 1 simply emits to the `userId` room, and the Redis adapter handles routing that message to Server 2 where User B's socket resides. This ensures **location-transparent routing**.
3. **OS-Aware CPU Pinning**: Benchmarking Node.js on a multi-core machine can lead to misleading results if the OS scheduler bounces the process between cores. `taskset` pins the instances to dedicated cores, preventing CPU contention and cache invalidation, ensuring the limits we hit are Node's event loop limits, not the OS scheduler's.

---

## Phase 2 — Centralized Redis Presence & Cache-Aside Architecture

### What Was Done
- Created `backend/src/lib/redis.js` managing three dedicated Redis clients (`pubClient`, `subClient`, and `cacheClient`).
- Implemented atomic reference-counted presence tracking via `presenceIncr(userId)` and `presenceDecr(userId)` using Redis `INCR` / `DECR`.
- Built cache-aside caching for conversation histories in `getMessages` and automatic cache invalidation in `sendMessage`.
- Implemented `BENCHMARK_MODE=true` bypass in `sendMessage` to eliminate MongoDB and Cloudinary I/O during network load tests.

### Technical Justifications & Design Choices
1. **Three Dedicated Redis Connections**: `@socket.io/redis-adapter` requires dedicated Pub and Sub connections because Redis connections in subscription mode cannot issue regular commands like `GET` or `SET`. A third connection (`cacheClient`) was created for presence and chat caching to prevent command blocking.
2. **Atomic Reference Counting for Presence**:
   - *The Bug:* In monolithic chat apps, opening two tabs and closing one triggers a disconnect event that removes the user from the online set, broadcasting a false offline alert to all contacts.
   - *The Solution:* Redis stores an atomic integer counter `presence:<userId>`. When tab 1 connects, count is 1. When tab 2 connects, count is 2. When tab 1 closes, count drops to 1 (user stays online). Only when count reaches 0 are all tabs closed and the user marked offline.
3. **Deterministic Cache Keys**: Cache keys are generated as `chat:<minId>:<maxId>` (sorting user IDs alphabetically). This ensures both `UserA -> UserB` and `UserB -> UserA` hit the exact same cache entry regardless of who queried first.

---

## Phase 3 — Systems Benchmarking & Breaking Limit (B) Discovery

### What Was Done
- Created the `benchmarking/` suite with zero external framework dependencies:
  - `load-runner.js`: High-concurrency WebSocket load client using `socket.io-client` with batching, connection budgets, and hard timeout deadlines.
  - `server-manager.js`: Programmatic process lifecycle management that starts/stops backend instances on designated test ports.
  - `stats.js`: Computes exact latency percentiles ($p50, p90, p95, p99$, min, mean, max).
- Built **Phase A** binary-search ramp test (`phase-a-find-B.js`) to find breaking point $B$.
- Built **Phase B** 3-curve comparative benchmark (`phase-b-comparative.js`) across $0.5B, 0.7B, 1.0B, 1.5B$.
- Built automated Markdown report generator (`generate-report.js`) with ASCII charts.

### Technical Justifications & Design Choices
1. **End-to-End Wall-Clock Latency**: Rather than measuring HTTP request round-trips, virtual senders embed `sentAt: Date.now()` in the payload. Receivers compute `now() - sentAt` upon arrival. This captures the complete delivery path: client serialization $\rightarrow$ server event loop $\rightarrow$ Redis Pub/Sub relay $\rightarrow$ recipient event loop $\rightarrow$ client receipt.
2. **Binary Search Limit Finding**: Doubling pairs ($50 \rightarrow 100 \rightarrow 200 \rightarrow 400$) quickly isolates the failure window. Once saturation occurs, binary search pinpoints $B$ within 5 rounds without unnecessary testing duration.
3. **100% Cross-Server Worst-Case Partitioning**: In the 2-Server cluster benchmark, senders are connected to Port 5012 and receivers to Port 5013. This forces **every single message** to cross the Redis Pub/Sub boundary. In production, a round-robin load balancer would keep ~50% of messages local. By enforcing 100% cross-server relay, our benchmark provides a conservative lower bound.

---

## Phase 4 — Results & Systems Insights

### Key Findings
1. **The Single-Process Wall ($B = 200$ pairs / 400 sockets):** At 200 concurrent chat pairs firing 1 msg/sec, a single Node.js event loop collapses. Beyond 200 pairs, connections time out and p95 latency blows past 9,999ms.
2. **The Horizontal Scalability Proof:** Under that exact same $1.0\times B$ load where the single server crashed, the **2-Server Cluster + Redis delivered 100% of messages (3,000 sent) with $p50 = 17\text{ms}$ and $p95 = 35\text{ms}$**!
3. **The Redis Serialization Tax:** At low load ($0.5\times B$), in-memory delivery took $10\text{ms}$, while Redis delivery took $31\text{ms}$ ($+21\text{ms}$ loopback TCP overhead). Redis adds measurable overhead under light load and should only be introduced when scaling beyond single-core capacity.
