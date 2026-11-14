import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import pool from "../config/db";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET not defined");
}
const JWT_SECRET: string = secret;

const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

export async function login(email: string, password: string) {
  const { rows } = await pool.query(
    `SELECT id, college_id, department_id, email, password_hash, role
       FROM app_user
      WHERE email = $1 AND is_active = true`,
    [email.toLowerCase()],
  );

  const user = rows[0];
  if (!user) return null;

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) return null;

  const token = jwt.sign(
    {
      id: user.id,
      role: user.role,
      collegeId: user.college_id,
      departmentId: user.department_id,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      collegeId: user.college_id,
      departmentId: user.department_id,
    },
  };
}

/**
 * Fetch a user by ID (excludes password_hash). Used by GET /api/auth/me.
 */
export async function getUserById(userId: number) {
  const { rows } = await pool.query(
    `SELECT id, college_id, department_id, email, role, is_active, created_at
       FROM app_user
      WHERE id = $1 AND is_active = true`,
    [userId],
  );

  if (rows.length === 0) return null;

  const u = rows[0];
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    collegeId: u.college_id,
    departmentId: u.department_id,
    createdAt: u.created_at,
  };
}
