import "dotenv/config";
import { hasDatabaseUrl, pingDatabase } from "./db.js";

export function evaluateRuntimeStatus({
  dataMode,
  hasDatabaseUrlConfigured,
  databasePing = null,
  port = Number(process.env.PORT || 3001),
  nodeEnv = process.env.NODE_ENV || "development",
}) {
  const warnings = [];
  let ready = true;

  const requiresDatabase = dataMode === "database";
  const database = {
    required: requiresDatabase,
    configured: hasDatabaseUrlConfigured,
    reachable: databasePing?.ok ?? null,
    latency_ms: databasePing?.latency_ms ?? null,
    current_time: databasePing?.current_time ?? null,
    error: databasePing?.error ?? null,
  };

  if (requiresDatabase && !hasDatabaseUrlConfigured) {
    ready = false;
    warnings.push({
      code: "missing_database_url",
      message: "DATABASE_URL is missing while APP_DATA_MODE=database.",
      severity: "high",
    });
  }

  if (requiresDatabase && databasePing && !databasePing.ok) {
    ready = false;
    warnings.push({
      code: "database_unreachable",
      message: "Database connectivity check failed.",
      severity: "high",
    });
  }

  return {
    ready,
    data_mode: dataMode,
    node_env: nodeEnv,
    port,
    database,
    warnings,
  };
}

export async function getRuntimeStatus({
  includeDatabasePing = false,
  dataMode = process.env.APP_DATA_MODE === "demo" ? "demo" : "database",
} = {}) {
  const databasePing =
    includeDatabasePing && dataMode === "database"
      ? await pingDatabase()
      : null;

  return evaluateRuntimeStatus({
    dataMode,
    hasDatabaseUrlConfigured: hasDatabaseUrl,
    databasePing,
  });
}
