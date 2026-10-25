// backend/src/lib/redis.js
// Centralized Redis client singleton.
// Both the Socket.io adapter and the cache layer share these connections.

import { Redis } from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// pubClient  – used by the Socket.io adapter to publish events across instances.
// subClient  – duplicate used by the adapter to subscribe to incoming events.
// cacheClient – a separate connection for get/set cache operations so it never
//               competes with the real-time pub/sub pipeline.

export const pubClient = new Redis(REDIS_URL);
export const subClient = pubClient.duplicate();
export const cacheClient = pubClient.duplicate();

pubClient.on("error", (err) => console.error("[Redis pubClient]", err.message));
subClient.on("error", (err) => console.error("[Redis subClient]", err.message));
cacheClient.on("error", (err) => console.error("[Redis cacheClient]", err.message));

// ─── Presence helpers ────────────────────────────────────────────────────────
// We store an integer connection-reference-count per user.
// Key: user_presence:<userId>  Value: integer
// When count reaches 0 the user is truly offline (all tabs / devices closed).

const PRESENCE_TTL_SECONDS = 60 * 60 * 24; // 1 day safety TTL

export const presenceIncr = async (userId) => {
  const key = `user_presence:${userId}`;
  const count = await cacheClient.incr(key);
  await cacheClient.expire(key, PRESENCE_TTL_SECONDS);
  return count; // 1 means first connection → user just came online
};

export const presenceDecr = async (userId) => {
  const key = `user_presence:${userId}`;
  const count = await cacheClient.decr(key);
  if (count <= 0) {
    // Clamp at 0 and remove the key so it does not go negative on crashes
    await cacheClient.del(key);
    return 0;
  }
  return count; // > 0 means other tabs/devices are still open → stay online
};

// ─── Online Users Set helpers ────────────────────────────────────────────────
const ONLINE_SET_KEY = "online_users";

export const addOnlineUser = (userId) =>
  cacheClient.sadd(ONLINE_SET_KEY, userId);

export const removeOnlineUser = (userId) =>
  cacheClient.srem(ONLINE_SET_KEY, userId);

export const getOnlineUsers = () =>
  cacheClient.smembers(ONLINE_SET_KEY);

// ─── Chat Cache helpers ──────────────────────────────────────────────────────
// Cache key is deterministic regardless of who queries first:
// chat:<smaller_id>:<larger_id>
const CHAT_CACHE_TTL = 60 * 60; // 1 hour

const chatCacheKey = (a, b) => {
  const [lo, hi] = [String(a), String(b)].sort();
  return `chat:${lo}:${hi}`;
};

export const getCachedMessages = async (userA, userB) => {
  const raw = await cacheClient.get(chatCacheKey(userA, userB));
  return raw ? JSON.parse(raw) : null;
};

export const setCachedMessages = async (userA, userB, messages) => {
  await cacheClient.set(
    chatCacheKey(userA, userB),
    JSON.stringify(messages),
    "EX",
    CHAT_CACHE_TTL
  );
};

export const invalidateChatCache = async (userA, userB) => {
  await cacheClient.del(chatCacheKey(userA, userB));
};
