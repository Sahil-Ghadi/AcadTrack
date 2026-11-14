import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, me } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

// Rate-limit login: max 10 attempts per 15 minutes per IP (disabled in tests)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === "test" ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts, please try again later" },
});

router.post("/login", loginLimiter, login);
router.get("/me", authenticate, me);

export default router;
