/**
 * Parse BPP_PG_CONN and create a shared pg Pool.
 * Format: host:port:database:user:password  (password may be empty)
 */
import pg from "pg";

const { Pool } = pg;

/** @type {import("pg").Pool | null} */
let pool = null;

/**
 * @returns {import("pg").PoolConfig}
 */
export function parsePgConn(conn = process.env.BPP_PG_CONN || "") {
  if (!conn) {
    const user = process.env.USER || process.env.LOGNAME || "postgres";
    return { host: "/tmp", port: 5432, database: "acoustics", user, password: "" };
  }
  const parts = conn.split(":");
  if (parts.length < 4) {
    throw new Error(`Invalid BPP_PG_CONN (expected host:port:db:user:password): ${conn}`);
  }
  const [host, portStr, database, user, ...rest] = parts;
  const password = rest.join(":"); // allow ':' in password
  return {
    host: host || "/tmp",
    port: Number(portStr) || 5432,
    database: database || "acoustics",
    user: user || process.env.USER || "postgres",
    password,
  };
}

export function getPool() {
  if (!pool) {
    pool = new Pool(parsePgConn());
  }
  return pool;
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
