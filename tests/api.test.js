import test, { after, before } from "node:test";
import assert from "node:assert/strict";

process.env.APP_DATA_MODE = "demo";
process.env.PORT = "3015";

const { default: app } = await import("../server/app.js");

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
});

async function loginAs(user_id, pin) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id, pin }),
  });
  const body = await response.json();
  return { response, body };
}

test("health endpoint returns demo mode status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data_mode, "demo");
  assert.equal(body.demo_inventory_count, 4);
  assert.equal(body.runtime.ready, true);
});

test("auth users endpoint returns sanitized shared-device accounts", async () => {
  const response = await fetch(`${baseUrl}/api/auth/users`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.users.length, 5);
  assert.ok(body.users.every((user) => !("pin_hash" in user)));
  assert.equal(body.users[0].pin_label, "Kitchen PIN");
});

test("login returns a session token for a valid PIN", async () => {
  const { response, body } = await loginAs(1, "2048");

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.session.user.role, "STOREKEEPER");
  assert.ok(body.session.token);
  assert.equal(body.session.auth_mode, "online-token");
});

test("session endpoint accepts the issued bearer token", async () => {
  const login = await loginAs(2, "1122");
  const response = await fetch(`${baseUrl}/api/auth/session`, {
    headers: {
      Authorization: `Bearer ${login.body.session.token}`,
    },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.session.user.role, "COOK");
  assert.equal(body.session.auth_mode, "online-token");
});

test("student-count write without auth is preserved for retry instead of rejected", async () => {
  const response = await fetch(`${baseUrl}/api/student-count`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      student_count: 163,
      meal_type: "ALL",
      raw_input_text: "163 students on roll call",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.saved, false);
  assert.equal(body.stored, true);
  assert.equal(body.storage_mode, "fallback_queue");
  assert.equal(body.retry_later, true);
  assert.ok(body.warnings.some((warning) => warning.code === "auth_required"));
});

test("read-only accountant attempts are stored as audit-only warnings", async () => {
  const login = await loginAs(3, "3344");
  const response = await fetch(`${baseUrl}/api/issue-stock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.body.session.token}`,
    },
    body: JSON.stringify({
      item_id: 101,
      quantity: 10,
      meal_type: "LUNCH",
      raw_input_text: "10 kg maize flour",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.saved, false);
  assert.equal(body.stored, true);
  assert.equal(body.storage_mode, "fallback_queue");
  assert.equal(body.retry_later, false);
  assert.ok(body.warnings.some((warning) => warning.code === "role_warning"));
});

test("authenticated issue writes in demo mode stay out of Neon and land in demo fallback storage", async () => {
  const login = await loginAs(1, "2048");
  const response = await fetch(`${baseUrl}/api/issue-stock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${login.body.session.token}`,
    },
    body: JSON.stringify({
      item_id: 101,
      quantity: 12,
      meal_type: "LUNCH",
      raw_input_text: "12 kg maize flour from demo run",
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.saved, true);
  assert.equal(body.stored, true);
  assert.equal(body.deferred, true);
  assert.equal(body.storage_mode, "demo_fallback");
  assert.ok(body.warnings.some((warning) => warning.code === "demo_mode_storage"));
});

test("readiness endpoint returns ready in demo mode", async () => {
  const response = await fetch(`${baseUrl}/api/readiness`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.runtime.ready, true);
  assert.equal(body.runtime.data_mode, "demo");
});

test("principal dashboard returns only essential metrics and max three alerts", async () => {
  const response = await fetch(`${baseUrl}/api/dashboard-summary?role=PRINCIPAL&date=2026-04-26`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.role, "PRINCIPAL");
  assert.equal(body.dashboard.todays_cost_kes, 11447.53);
  assert.equal(body.dashboard.cost_per_student_kes, 71.1);
  assert.ok(body.dashboard.alerts.length <= 3);
});

test("principal alerts endpoint stays limited to high-severity items", async () => {
  const response = await fetch(`${baseUrl}/api/alerts?role=PRINCIPAL`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.ok(body.alerts.length <= 3);
  assert.ok(body.alerts.every((alert) => alert.severity === "HIGH"));
  assert.ok(body.alerts.every((alert) => alert.issue_assessment));
});

test("reports endpoint returns the full seven-day simulation", async () => {
  const response = await fetch(`${baseUrl}/api/reports?startDate=2026-04-20&endDate=2026-04-26`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.reports.daily_summaries.length, 7);
  assert.equal(body.reports.report_insights.budgetRows.length, 7);
  assert.equal(body.reports.report_insights.latestPlan.length, 3);
  assert.equal(body.reports.report_insights.consumptionRows.length, 3);
  assert.ok(body.reports.generated_insights.length >= 3);
});
