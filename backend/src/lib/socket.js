// backend/src/lib/socket.js
// ─────────────────────────────────────────────────────────────────────────────
// DISTRIBUTED SOCKET LAYER
//
// Key changes from the monolithic baseline (main branch):
//
//  1. DUAL-MODE ADAPTER: controlled by ENABLE_REDIS_ADAPTER env var.
//     • "true"  (default) → uses @socket.io/redis-adapter for cross-server routing.
//     • "false"           → uses the default in-memory adapter (legacy baseline mode).
//
//  2. ROOM-BASED ROUTING: every client joins a room keyed by their database
//     userId.  Messages are emitted to io.to(receiverId) instead of a raw
//     socket.id lookup, making delivery location-transparent across instances.
//
//  3. REDIS REFERENCE-COUNTED PRESENCE: fixes the multi-tab false-offline bug.
//     The online-user set lives in Redis so all cluster nodes see the same state.
//
// ─────────────────────────────────────────────────────────────────────────────

import { Server } from "socket.io";
import http from "http";
import express from "express";
import { createAdapter } from "@socket.io/redis-adapter";

import {
  pubClient,
  subClient,
  presenceIncr,
  presenceDecr,
  addOnlineUser,
  removeOnlineUser,
  getOnlineUsers,
} from "./redis.js";

export const app = express();
export const server = http.createServer(app);

// Allow both Vite dev server and production origin
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

const io = new Server(server, {
  cors: { origin: CORS_ORIGINS, credentials: true },
  // Increase ping timeout slightly so benchmark clients do not drop early
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ─── Phase 1: Dual-Mode Adapter ──────────────────────────────────────────────
const ENABLE_REDIS_ADAPTER = process.env.ENABLE_REDIS_ADAPTER !== "false";

if (ENABLE_REDIS_ADAPTER) {
  io.adapter(createAdapter(pubClient, subClient));
  console.log("[Socket.io] Mode: DISTRIBUTED  (Redis Adapter enabled)");
  console.log(`[Socket.io] Redis URL: ${process.env.REDIS_URL || "redis://127.0.0.1:6379"}`);
} else {
  console.log("[Socket.io] Mode: CENTRALIZED  (In-Memory Baseline — no Redis adapter)");
}

// Legacy in-memory map (used only when ENABLE_REDIS_ADAPTER=false)
const legacySocketMap = {}; // { userId: socketId }

// ─── Connection Handler ───────────────────────────────────────────────────────
io.on("connection", async (socket) => {
  const userId = socket.handshake.query.userId;

  if (!userId) {
    // Unauthenticated socket — disconnect immediately
    socket.disconnect(true);
    return;
  }

  console.log(`[Socket.io] + Connected  userId=${userId}  socketId=${socket.id}`);

  // Join the room named after the user's DB _id.
  // io.to(userId).emit(…) will reach this socket regardless of which server
  // instance it is connected to (Redis adapter handles the cross-server fanout).
  socket.join(userId);

  // ── Presence: increment reference count ─────────────────────────────────
  if (ENABLE_REDIS_ADAPTER) {
    const count = await presenceIncr(userId);

    if (count === 1) {
      // First connection → user just came online
      await addOnlineUser(userId);
      const onlineUsers = await getOnlineUsers();
      io.emit("getOnlineUsers", onlineUsers);
    }
    // count > 1 → additional tab/device; user was already online, no broadcast needed
  } else {
    // Legacy in-memory mode (used for baseline benchmark only)
    legacySocketMap[userId] = socket.id;
    io.emit("getOnlineUsers", Object.keys(legacySocketMap));
  }

  // ── Benchmark direct WebSocket routing ────────────────────────────────────
  // Used exclusively by the load runner (benchmarking/lib/load-runner.js).
  // Bypasses the HTTP REST layer; messages are emitted directly socket-to-socket.
  // This makes it possible to measure pure event-loop + Redis relay throughput.
  socket.on("benchmarkMessage", ({ receiverId, text, sentAt }) => {
    io.to(receiverId).emit("newMessage", { text, sentAt, senderId: userId });
  });

  socket.on("disconnect", async () => {
    console.log(`[Socket.io] - Disconnected userId=${userId}  socketId=${socket.id}`);

    if (ENABLE_REDIS_ADAPTER) {
      const count = await presenceDecr(userId);

      if (count === 0) {
        // All tabs/devices closed → user is now truly offline
        await removeOnlineUser(userId);
        const onlineUsers = await getOnlineUsers();
        io.emit("getOnlineUsers", onlineUsers);
      }
      // count > 0 → other tabs are still active → do NOT broadcast offline
    } else {
      // Legacy in-memory mode
      delete legacySocketMap[userId];
      io.emit("getOnlineUsers", Object.keys(legacySocketMap));
    }
  });
});

// getReceiverSocketId is only used in tests; real delivery uses io.to(userId)
export function getReceiverSocketId(userId) {
  return legacySocketMap[userId];
}

export { io };
