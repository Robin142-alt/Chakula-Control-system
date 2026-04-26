import { spawn } from "node:child_process";

const port = 3020;
const baseUrl = `http://127.0.0.1:${port}`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url, timeoutMs = 30000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }

    await wait(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const child = spawn(process.execPath, ["server/index.js"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    APP_DATA_MODE: "demo",
    PORT: String(port),
  },
  stdio: "ignore",
});

try {
  await waitForServer(`${baseUrl}/api/health`);

  const [rootResponse, healthResponse, readinessResponse, dashboardResponse] = await Promise.all([
    fetch(baseUrl),
    fetch(`${baseUrl}/api/health`),
    fetch(`${baseUrl}/api/readiness`),
    fetch(`${baseUrl}/api/dashboard-summary?role=PRINCIPAL&date=2026-04-26`),
  ]);

  const rootHtml = await rootResponse.text();
  const health = await healthResponse.json();
  const readiness = await readinessResponse.json();
  const dashboard = await dashboardResponse.json();

  assert(rootResponse.ok, "Root HTML did not load.");
  assert(rootHtml.includes("Chakula Control"), "Root HTML missing app title.");
  assert(health.success === true, "Health endpoint did not return success.");
  assert(health.data_mode === "demo", "Health endpoint did not report demo mode.");
  assert(readiness.success === true, "Readiness endpoint did not return success.");
  assert(dashboard.success === true, "Dashboard endpoint did not return success.");
  assert(dashboard.dashboard?.todays_cost_kes === 11447.53, "Dashboard total cost drifted from expected demo output.");
  assert(dashboard.dashboard?.alerts?.length === 3, "Principal dashboard should show exactly three high alerts.");

  console.log("Production smoke test passed.");
} finally {
  child.kill("SIGTERM");
}
