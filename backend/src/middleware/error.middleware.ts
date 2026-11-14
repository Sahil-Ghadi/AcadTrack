import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { DatabaseError } from "pg";

/**
 * Central error handler. Mount LAST in app.ts with app.use(errorHandler).
 *
 * Maps known error types to appropriate HTTP status codes:
 *   - ZodError            -> 400 (validation)
 *   - pg 23505            -> 409 (unique violation)
 *   - pg 23503            -> 409 (foreign key violation)
 *   - pg 23514            -> 400 (check constraint)
 *   - pg P0001            -> 409/422 (trigger RAISE EXCEPTION)
 *   - Everything else     -> 500
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // --- Custom error with status code ---
  if (typeof err === "object" && err !== null && ("status" in err || "statusCode" in err)) {
    const status = Number((err as any).status || (err as any).statusCode);
    const message = (err as any).message || "An error occurred";
    res.status(status).json({ message });
    return;
  }

  // --- Zod validation errors ---
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Validation error",
      errors: err.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
    });
    return;
  }

  // --- PostgreSQL errors ---
  if (err instanceof DatabaseError) {
    switch (err.code) {
      // Unique violation (e.g. duplicate email, timetable clash)
      case "23505": {
        // Extract a friendly description from the constraint name
        const detail = err.detail || "A record with that value already exists";
        res.status(409).json({ message: "Conflict: duplicate entry", detail });
        return;
      }
      // Foreign key violation
      case "23503": {
        const detail = err.detail || "Referenced record does not exist";
        res.status(409).json({ message: "Conflict: invalid reference", detail });
        return;
      }
      // Check constraint violation
      case "23514": {
        const detail = err.detail || err.message;
        res.status(400).json({ message: "Validation error", detail });
        return;
      }
      // RAISE EXCEPTION from triggers (P0001 = raise_exception)
      case "P0001": {
        // The trigger's message is in err.message, e.g.
        // "Attendance for lecture 5 is locked and cannot be changed"
        // "IT1 marks (25) exceed the maximum of 20"
        const isLock = err.message.toLowerCase().includes("locked");
        const status = isLock ? 409 : 422;
        res.status(status).json({ message: err.message });
        return;
      }
    }
  }

  // --- Catch-all: don't leak internals ---
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
}

