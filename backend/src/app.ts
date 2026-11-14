import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";
import institutionRoutes from "./routes/institution.routes";
import { errorHandler } from "./middleware/error.middleware";

const app = express();

// Restrict CORS to the frontend dev server
app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

// Health check (no auth needed)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "acadtrack-api",
    time: new Date().toISOString(),
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/institution", institutionRoutes);

// Central error handler (must be last)
app.use(errorHandler);

export default app;
