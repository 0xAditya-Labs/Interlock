# Implementation Notes & Technical Justifications

## Phase 1 — Dual-Mode Adapter Architecture

### What Was Done
- Installed `ioredis` and `@socket.io/redis-adapter` to enable distributed WebSocket pub/sub across multiple Node.js instances.
- Modified `socket.js` to conditionally initialize the Redis adapter based on the `ENABLE_REDIS_ADAPTER` environment variable.
- Created `scripts/start-cluster.js` and a `start:cluster` npm script to launch two parallel backend instances (on ports 5001 and 5002). The script includes OS detection to apply Linux-specific `taskset` and `nice` CPU pinning for clean benchmark isolation, gracefully falling back on Windows/macOS.
- Migrated message delivery in `message.controller.js` to use Socket.io rooms keyed strictly by `userId` (e.g., `socket.join(userId)` and `io.to(receiverId).emit()`).

### Technical Justifications & Design Choices
1. **Dual-Mode Adapter (`ENABLE_REDIS_ADAPTER`)**: We need a baseline to prove the value (and the cost) of the Redis adapter. By conditionally loading it, we can run the identical codebase in a "legacy" purely in-memory mode without switching git branches, avoiding file-lock or socket cleanup friction during automated benchmark loops.
2. **Room-Based Message Routing**: Previously, the system mapped `userId -> socketId` in a local memory object. In a distributed setup, User A (on Server 1) has no idea what User B's `socketId` is if User B is connected to Server 2. By making users join a room named after their own `userId`, Server 1 simply emits to the `userId` room, and the Redis adapter handles routing that message to Server 2 where User B's socket resides. This ensures **location-transparent routing**.
3. **OS-Aware CPU Pinning**: Benchmarking Node.js on a multi-core machine can lead to misleading results if the OS scheduler bounces the process between cores. `taskset` pins the instances to dedicated cores, preventing CPU contention and cache invalidation, ensuring the limits we hit are Node's event loop limits, not the OS scheduler's.

### Likely Interview Questions
- **Q:** *Why did you switch from mapping socket IDs in memory to using Socket.io rooms for direct user IDs?*
  **A:** Because `socket.id` is ephemeral and only known to the server the user connected to. In a multi-server setup, maintaining a globally synchronized map of `socket.id`s across servers is expensive and race-condition-prone. Socket.io rooms natively integrate with the Redis adapter, handling the pub/sub fanout automatically across instances without needing to know *which* server holds the socket.
- **Q:** *Why did you add CPU pinning (`taskset`) for the benchmark?*
  **A:** To isolate the system under test. If the OS moves the Node process between cores, or if both Node instances fight for the same core, the resulting latency spikes would be a symptom of CPU contention, not an architectural bottleneck in the application's event loop or the Redis relay.
