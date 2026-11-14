import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET not defined");
}
const JWT_SECRET: string = secret;

/**
 * Verifies the JWT from the Authorization header and attaches req.user.
 * Returns 401 if the token is missing, malformed, or expired.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Authentication required" });
    return;
  }

  const token = header.slice(7); // strip "Bearer "
  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      id: number;
      role: "college_admin" | "dept_admin" | "faculty" | "student";
      collegeId: number;
      departmentId: number | null;
    };

    req.user = {
      id: payload.id,
      role: payload.role,
      collegeId: payload.collegeId,
      departmentId: payload.departmentId,
    };

    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

/**
 * Returns middleware that checks whether req.user.role is one of the
 * allowed roles. Must be used AFTER authenticate.
 */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}

