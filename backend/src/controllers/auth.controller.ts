import type { Request, Response } from "express";
import { loginSchema } from "../validators/auth.validator";
import * as authService from "../services/auth.service";

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Invalid input",
      errors: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  const result = await authService.login(parsed.data.email, parsed.data.password);
  if (!result) {
    res.status(401).json({ message: "Invalid email or password" });
    return;
  }

  res.json(result);
}

/**
 * GET /api/auth/me — returns the current user's profile.
 * Requires authenticate middleware.
 */
export async function me(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  // Fetch fresh user data (don't rely on stale JWT claims)
  const user = await authService.getUserById(req.user.id);
  if (!user) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  res.json({ user });
}
