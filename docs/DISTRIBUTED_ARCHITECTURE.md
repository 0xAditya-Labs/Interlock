# Interlock — Distributed Architecture Deep-Dive

> This document explains every design decision made in the `distributed-backend` branch —
> from why Redis was chosen to how the multi-tab bug was fixed with a single atomic counter.
> It is written for three audiences: a college fresher encountering this for the first time,
> a backend engineer reviewing the code before an interview, and the author revisiting it later.

---

## Table of Contents

1. [The Core Problem](#the-core-problem)
2. [The Solution Overview](#the-solution-overview)
3. [Component 1 — Redis Clients (`redis.js`)](#component-1--redis-clients)
4. [Component 2 — Dual-Mode Socket Adapter (`socket.js`)](#component-2--dual-mode-socket-adapter)
5. [Component 3 — Cache-Aside Pattern (`message.controller.js`)](#component-3--cache-aside-pattern)
6. [Component 4 — Benchmark Mode (`index.js`)](#component-4--benchmark-mode)
7. [Component 5 — Cluster Launcher (`start-cluster.js`)](#component-5--cluster-launcher)
8. [The Multi-Tab False-Offline Bug (and Fix)](#the-multi-tab-false-offline-bug-and-fix)
9. [Why This Architecture is "Conservative"](#why-this-architecture-is-conservative)
10. [Q&A — Common Questions](#qa--common-questions)

---

## The Core Problem

Node.js is single-threaded. A single process runs on exactly one CPU core. When hundreds of WebSocket connections send messages simultaneously, every event handler queues up on the same thread. Beyond a certain concurrency level — empirically found to be **200 concurrent chat pairs** in this project — the event loop saturates and message delivery latency explodes.

The standard industry solution: **run multiple Node.js processes** and let them share load. But Socket.io by default stores all connection state in process memory. If user A is connected to process 1 and user B is connected to process 2, a message from A to B will silently be lost — process 1 has no way to reach process 2's in-memory socket.

This is the problem Redis solves.

---

## The Solution Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Redis (shared brain)                      │
│                                                              │
│  Pub/Sub channels ─── socket.io adapter events              │
│  Hash: presence:{userId} = connectionCount                   │
│  List: chat:{idA}:{idB} = [message JSON, ...]               │
└──────┬───────────────────────────────────────┬───────────────┘
       │                                       │
┌──────▼──────────┐                  ┌─────────▼───────────┐
│  Node.js        │                  │  Node.js            │
│  Instance 1     │                  │  Instance 2         │
│  Port 5001      │                  │  Port 5002          │
│                 │                  │                     │
│  User A socket  │                  │  User B socket      │
└─────────────────┘                  └─────────────────────┘
         ▲                                      ▲
    Browser A                              Browser B
```

When A sends a message to B:
1. Instance 1 receives the `sendMessage` HTTP request (or socket event)
2. It publishes the event to Redis via the `@socket.io/redis-adapter`
3. Redis broadcasts to all subscribed instances
4. Instance 2 receives the event and emits it to B's socket

Neither instance needs to know the other exists. Redis is the only shared state.

---

## Component 1 — Redis Clients

**File:** `backend/src/lib/redis.js`

Three dedicated ioredis connections are created:

```js
export const pubClient   = new Redis(REDIS_URL);  // For socket.io adapter — publishes events
export const subClient   = pubClient.duplicate(); // For socket.io adapter — receives events
export const cacheClient = pubClient.duplicate(); // For presence + chat cache
```

**Why three separate connections?**

The `@socket.io/redis-adapter` requires two dedicated connections — one for publishing and one for subscribing — because ioredis cannot both send commands and subscribe on the same connection simultaneously (it's a Redis protocol constraint). A third dedicated connection for our cache/presence operations prevents our GET/SET commands from interfering with the adapter's Pub/Sub streams.

### Presence Reference Counting

```js
export async function presenceIncr(userId) {
  return cacheClient.incr(`presence:${userId}`);
}

export async function presenceDecr(userId) {
  const val = await cacheClient.decr(`presence:${userId}`);
  if (val <= 0) await cacheClient.del(`presence:${userId}`);
  return val;
}
```

Each tab that connects increments the counter. Each tab that disconnects decrements it. Only when the counter reaches zero (all tabs closed) is the user considered offline. See [The Multi-Tab Bug section](#the-multi-tab-false-offline-bug-and-fix) for full context.

---

## Component 2 — Dual-Mode Socket Adapter

**File:** `backend/src/lib/socket.js`

The same codebase supports both architectures, toggled by environment variable:

```js
if (process.env.ENABLE_REDIS_ADAPTER === "true") {
  // Distributed mode: plug in Redis adapter
  io.adapter(createAdapter(pubClient, subClient));
} else {
  // Centralized mode: default in-memory adapter (original behaviour)
}
```

This lets us benchmark both modes from a single repo without branch switching.

### Room-Based Routing

```js
socket.on("connect", () => {
  const userId = socket.handshake.query.userId;
  socket.join(userId); // Each user has a virtual room equal to their userId
});
```

To send to a user:
```js
io.to(receiverId).emit("newMessage", message);
```

`io.to(receiverId)` broadcasts to the `receiverId` room. With the Redis adapter, this transparently works even if the receiver is on a different process — the adapter handles cross-process relay automatically.

---

## Component 3 — Cache-Aside Pattern

**File:** `backend/src/controllers/message.controller.js`

```
getMessages request arrives
        │
        ▼
  Check Redis cache
   (key: chat:<A>:<B>)
        │
    ┌───┴───────────────────┐
    │                       │
  HIT                     MISS
    │                       │
  Return cached          Query MongoDB
  messages               → Store in Redis (TTL 1h)
                         → Return messages
```

Cache invalidation: every `sendMessage` deletes the cache key for that conversation.

**Why sort the user IDs for the cache key?**

A conversation between user A and user B is the same regardless of who initiated the query. Sorting the IDs (`[A, B].sort().join(':')`) means `chat:A:B` and `chat:B:A` map to the same key, preventing double-caching of the same conversation.

---

## Component 4 — Benchmark Mode

**File:** `backend/src/index.js`

```js
if (process.env.BENCHMARK_MODE !== "true") {
  await connectDB();
}
```

When `BENCHMARK_MODE=true`:
- MongoDB connection is skipped entirely
- `sendMessage` skips database writes and Cloudinary uploads
- Messages are routed directly through Socket.io / Redis

This isolates **networking and event-loop throughput** from **disk I/O latency**. Without this bypass, benchmark results would reflect MongoDB write speed, not the WebSocket architecture being tested.

The server still starts normally, exposes `/healthz`, and handles WebSocket connections — the only difference is what happens inside `sendMessage`.

---

## Component 5 — Cluster Launcher

**File:** `backend/scripts/start-cluster.js`

Spawns two backend instances:
- Instance 1: port 5001
- Instance 2: port 5002

Both have `ENABLE_REDIS_ADAPTER=true` so they form a cluster.

On Linux, each instance is pinned to a dedicated CPU core via `taskset`:
```bash
taskset -c 0 node src/index.js  # Instance 1 → core 0
taskset -c 1 node src/index.js  # Instance 2 → core 1
```

This prevents the OS scheduler from bouncing processes between cores, which can cause cache misses and measurement noise during benchmarking.

On Windows/macOS, `taskset` is not available; instances run normally without core pinning.

SIGINT/SIGTERM handlers ensure both children are killed cleanly when the parent process exits.

---

## The Multi-Tab False-Offline Bug (and Fix)

### The Bug (Original Code)

```js
// Original socket.js onDisconnect:
onlineUsers.delete(userId);
io.emit("getOnlineUsers", [...onlineUsers]);
```

**Scenario:**
1. User opens Tab 1 → connects → marked online ✅
2. User opens Tab 2 → another socket connects — but `onlineUsers` just has one entry per user
3. User closes Tab 2 → `onDisconnect` fires → `onlineUsers.delete(userId)` → **user broadcast as offline** ❌
4. Tab 1 is still open but app shows user as offline 🐛

### The Fix (Redis Reference Counting)

```js
// On connect:
const count = await presenceIncr(userId);   // count = 2 (both tabs)
if (count === 1) {
  // Only on first connection — add to online set and broadcast
  await addOnlineUser(userId);
  io.emit("getOnlineUsers", await getOnlineUsers());
}

// On disconnect:
const count = await presenceDecr(userId);   // count = 1 (one tab still open)
if (count <= 0) {
  // Only when ALL tabs close — remove from online set and broadcast
  await removeOnlineUser(userId);
  io.emit("getOnlineUsers", await getOnlineUsers());
}
```

The counter is stored in Redis (not process memory), so it works correctly even when the two tabs are connected to different server instances.

---

## Why This Architecture is "Conservative"

The Phase B benchmark tests **2 server instances** with a **100% cross-server partition**: all senders connect to Instance 1, all receivers connect to Instance 2. Every single message must cross the Redis relay.

In production:
- A **round-robin load balancer** sends ~50% of users to each instance
- ~50% of chat pairs will be on the same instance (bypass Redis entirely)
- Only ~25% of messages need to cross Redis (when sender and receiver land on different instances)

This means our benchmark latency numbers for "2-Server Cluster" are a **conservative lower bound** — real-world deployments will see better numbers than what is reported here.

---

## Q&A — Common Questions

**Q: Why Redis and not just spawning Node.js worker threads?**  
Worker threads share memory but they can't each bind their own TCP port — you can't accept WebSocket connections inside a worker thread directly. The standard pattern for multi-core Node.js servers is the `cluster` module (separate OS processes, separate ports) with a shared communication bus. Redis is the battle-tested choice for that bus.

**Q: Why ioredis instead of the built-in `redis` package?**  
`@socket.io/redis-adapter` recommends ioredis. It has better Promise support, built-in retry logic, and a more ergonomic API for the subscribe/publish pattern.

**Q: What is p95 latency and why does it matter?**  
If you send 100 messages and sort them by delivery time, p95 is the 95th value — only 5% of messages were slower. It's the industry standard "typical worst-case" experience. Monitoring p50 alone would hide the tail latency that makes a chat app feel laggy.

**Q: Why does the Windows Firewall prompt appear when running the benchmark?**  
`redis-server.exe` opens a server port (6379) on first run. Windows Defender Firewall intercepts any new listening socket and asks for permission. This is expected — allow it for "private networks." It only appears once.

**Q: Can this run on Linux?**  
Yes — and it works better there. On Linux, `taskset` is used for CPU pinning during the cluster launch, the APT/Homebrew Redis packages are simpler to install, and there's no Windows Firewall prompt. The codebase is OS-agnostic by design; only the cluster launcher has a platform-conditional code path.

**Q: Is the Redis connection persistent? What happens if Redis goes down?**  
In the current implementation, a Redis crash will take down presence tracking and the Pub/Sub relay. In production you would add ioredis retry/reconnect logic and consider Redis Sentinel or Redis Cluster for HA. This is listed in the roadmap.

---

*Part of the Interlock project — [`README.md`](../README.md) | [`BENCHMARKING_GUIDE.md`](./BENCHMARKING_GUIDE.md)*
