import test from "node:test";
import assert from "node:assert/strict";
import { evaluateRuntimeStatus } from "../server/runtime.js";

test("runtime status is ready in demo mode without a database URL", () => {
  const status = evaluateRuntimeStatus({
    dataMode: "demo",
    hasDatabaseUrlConfigured: false,
    databasePing: null,
    sessionSecretIsDefault: false,
    port: 3000,
    nodeEnv: "production",
  });

  assert.equal(status.ready, true);
  assert.equal(status.database.required, false);
  assert.equal(status.warnings.length, 0);
});

test("runtime status is not ready in database mode without a database URL", () => {
  const status = evaluateRuntimeStatus({
    dataMode: "database",
    hasDatabaseUrlConfigured: false,
    databasePing: null,
    sessionSecretIsDefault: false,
    port: 3000,
    nodeEnv: "production",
  });

  assert.equal(status.ready, false);
  assert.equal(status.database.required, true);
  assert.equal(status.warnings[0].code, "missing_database_url");
});

test("runtime status warns when using the default session secret", () => {
  const status = evaluateRuntimeStatus({
    dataMode: "database",
    hasDatabaseUrlConfigured: true,
    databasePing: { ok: true, latency_ms: 42, current_time: "2026-04-26T08:00:00.000Z", error: null },
    sessionSecretIsDefault: true,
    port: 3000,
    nodeEnv: "production",
  });

  assert.equal(status.ready, true);
  assert.equal(status.auth.session_secret_default, true);
  assert.ok(status.warnings.some((warning) => warning.code === "default_session_secret"));
});
