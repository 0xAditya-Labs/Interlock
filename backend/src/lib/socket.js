import { Server } from "socket.io";
import http from "http";
import express from "express";
import { Redis } from "ioredis";
import { createAdapter } from "@socket.io/redis-adapter";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"],
  },
});

// Phase 1: Dual-Mode Adapter Architecture
const ENABLE_REDIS_ADAPTER = process.env.ENABLE_REDIS_ADAPTER !== "false";

if (ENABLE_REDIS_ADAPTER) {
  const pubClient = new Redis();
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));
  console.log("[Socket.io] Using Redis Adapter");
} else {
  console.log("[Socket.io] Using default in-memory adapter (Legacy Baseline Mode)");
}

export function getReceiverSocketId(userId) {
  return userSocketMap[userId];
}

// used to store online users
const userSocketMap = {}; // {userId: socketId}

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    // Join a room uniquely identified by the user's ID for location-transparent routing
    socket.join(userId);
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { io, app, server };
