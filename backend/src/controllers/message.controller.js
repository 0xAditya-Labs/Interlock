// backend/src/controllers/message.controller.js
// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE CONTROLLER
//
// Enhancements over the monolithic baseline:
//
//  1. REDIS CACHE (Cache-Aside pattern) on getMessages:
//     • Cache key: chat:<smaller_id>:<larger_id>  (always deterministic)
//     • TTL: 1 hour
//     • On sendMessage: the cache entry is invalidated so the next read
//       fetches fresh data from MongoDB and re-populates the cache.
//
//  2. BENCHMARK_MODE bypass:
//     • When BENCHMARK_MODE=true, sendMessage skips MongoDB writes AND
//       Cloudinary uploads. Messages are passed directly through the WebSocket
//       layer, isolating pure event-loop and Redis pub/sub performance.
//
// ─────────────────────────────────────────────────────────────────────────────

import User from "../models/user.model.js";
import Message from "../models/message.model.js";
import cloudinary from "../lib/cloudinary.js";
import { io } from "../lib/socket.js";
import {
  getCachedMessages,
  setCachedMessages,
  invalidateChatCache,
} from "../lib/redis.js";

const BENCHMARK_MODE = process.env.BENCHMARK_MODE === "true";

if (BENCHMARK_MODE) {
  console.log("[Controller] BENCHMARK_MODE=true — MongoDB writes and Cloudinary are bypassed.");
}

// ─── GET /api/messages/users ─────────────────────────────────────────────────
export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({ _id: { $ne: loggedInUserId } }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── GET /api/messages/:id ────────────────────────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id.toString();

    // 1. Try Redis cache first
    const cached = await getCachedMessages(myId, userToChatId);
    if (cached) {
      return res.status(200).json(cached);
    }

    // 2. Cache miss — query MongoDB
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    });

    // 3. Populate cache for next time
    await setCachedMessages(myId, userToChatId, messages);

    res.status(200).json(messages);
  } catch (error) {
    console.log("Error in getMessages controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── POST /api/messages/:id ───────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { text, image } = req.body;
    const { id: receiverId } = req.params;
    const senderId = req.user._id.toString();

    // ── BENCHMARK_MODE fast path ────────────────────────────────────────────
    if (BENCHMARK_MODE) {
      // Build a lightweight in-memory message object (no DB, no Cloudinary).
      const benchmarkMessage = {
        _id: `bench_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        senderId,
        receiverId,
        text: text || "",
        image: null,
        createdAt: new Date().toISOString(),
      };

      // Route via Socket.io (and Redis adapter if distributed)
      io.to(receiverId).emit("newMessage", benchmarkMessage);

      return res.status(201).json(benchmarkMessage);
    }

    // ── Production path ─────────────────────────────────────────────────────
    let imageUrl;
    if (image) {
      const uploadResponse = await cloudinary.uploader.upload(image);
      imageUrl = uploadResponse.secure_url;
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
      image: imageUrl,
    });

    await newMessage.save();

    // Invalidate the Redis cache for this conversation so the next
    // getMessages call fetches fresh data including this message.
    await invalidateChatCache(senderId, receiverId);

    // Emit to the receiver's userId room (location-transparent across cluster)
    io.to(receiverId).emit("newMessage", newMessage);

    res.status(201).json(newMessage);
  } catch (error) {
    console.log("Error in sendMessage controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
