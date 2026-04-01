import express from "express";
import cors from "cors";
import morgan from "morgan";

// Import routes
import authRoutes from "./routes/authRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import openaiRoutes from "./routes/openaiRoutes.js";
import materialLoadRoutes from "./routes/materialLoadRoutes.js";
// import ragRoutes from "./routes/ragRoutes.js";  // RAG detached

const app = express();

// Middleware
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

// Health check (useful now + later in deployment)
app.get("/health", (_req, res) => {
  res.json({ ok: true, name: "digital-learning-platform", ts: Date.now() });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/student", studentRoutes);
app.use("/api/openai", openaiRoutes);
app.use("/api/material-load", materialLoadRoutes);
// app.use("/api/rag", ragRoutes);  // RAG detached

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

export default app;
