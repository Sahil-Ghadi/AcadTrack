import dotenv from "dotenv";
dotenv.config();

import { Pool, types } from "pg";

// Parse PostgreSQL INT8 (bigint, OID 20) as JavaScript integer
types.setTypeParser(20, (val) => parseInt(val, 10));

// Parse PostgreSQL NUMERIC (OID 1700) as JavaScript float
types.setTypeParser(1700, (val) => parseFloat(val));

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

pool.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

export default pool;
