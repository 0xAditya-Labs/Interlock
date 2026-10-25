// backend/src/index.js
// ─────────────────────────────────────────────────────────────────────────────
// Backend entry point.
//
// BENCHMARK_MODE=true  → skips MongoDB connection entirely so the load-test
//                         measures only WebSocket + Redis throughput.
// BENCHMARK_MODE=false → normal production / development mode.
// ─────────────────────────────────────────────────────────────────────────────

import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";

import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import { app, server } from "./lib/socket.js";

dotenv.config();

const PORT = process.env.PORT || 5001;
const __dirname = path.resolve();
const BENCHMARK_MODE = process.env.BENCHMARK_MODE === "true";

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS || "http://localhost:5173")
      .split(",")
      .map((s) => s.trim()),
    credentials: true,
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Health endpoint (used by the benchmark runner to verify the server is up)
app.get("/healthz", (_req, res) => res.json({ ok: true, port: PORT, benchmarkMode: BENCHMARK_MODE }));

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  });
}

server.listen(PORT, async () => {
  console.log(`[Server] Listening on PORT: ${PORT}`);

  if (BENCHMARK_MODE) {
    console.log("[Server] BENCHMARK_MODE=true — skipping MongoDB connection.");
  } else {
    await connectDB();
  }
});
