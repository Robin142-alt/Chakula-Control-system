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

test("health endpoint returns demo mode status", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data_mode, "demo");
  assert.equal(body.demo_inventory_count, 4);
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
});

test("reports endpoint returns the full seven-day simulation", async () => {
  const response = await fetch(`${baseUrl}/api/reports?startDate=2026-04-20&endDate=2026-04-26`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.reports.daily_summaries.length, 7);
  assert.ok(body.reports.generated_insights.length >= 3);
});

