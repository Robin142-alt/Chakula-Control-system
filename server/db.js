import "dotenv/config";
import pg from "pg";

const { Pool } = pg;
export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

const ssl =
  process.env.DATABASE_URL && process.env.DATABASE_URL.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : false;

export const pool = hasDatabaseUrl
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl,
    })
  : null;

export async function queryDb(queryText, params = []) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return pool.query(queryText, params);
}

export async function pingDatabase() {
  if (!pool) {
    return {
      ok: false,
      error: "DATABASE_URL is not configured.",
      latency_ms: null,
      current_time: null,
    };
  }

  const startedAt = Date.now();

  try {
    const result = await pool.query("SELECT NOW() AS current_time");
    return {
      ok: true,
      error: null,
      latency_ms: Date.now() - startedAt,
      current_time: result.rows[0]?.current_time ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      latency_ms: Date.now() - startedAt,
      current_time: null,
    };
  }
}

export async function withTransaction(callback) {
  if (!pool) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
