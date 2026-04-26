import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const port = 3016;
const baseUrl = `http://127.0.0.1:${port}`;
const screenshotsDir = resolve(process.cwd(), "docs", "screenshots");

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // wait and retry
    }

    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error(`Server did not start within ${timeoutMs}ms`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function loginAs(page, userId, pin) {
  await page.getByLabel("Account").selectOption(String(userId));
  await page.getByLabel("PIN").fill(pin);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.getByRole("button", { name: /sign out/i }).waitFor({ timeout: 15000 });
}

async function signOut(page) {
  await page.getByRole("button", { name: /sign out/i }).click();
  await page.getByRole("button", { name: /^sign in$/i }).waitFor({ timeout: 15000 });
}

await mkdir(screenshotsDir, { recursive: true });

const serverProcess = spawn(
  process.execPath,
  ["server/index.js"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APP_DATA_MODE: "demo",
      PORT: String(port),
    },
    stdio: "ignore",
  },
);

try {
  await waitForServer(`${baseUrl}/api/health`);
  const browser = await launchBrowser();
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 1,
  });

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await loginAs(page, 1, "2048");
  await page.addStyleTag({
    content: `
      .bottom-nav { display: none !important; }
      .app-shell { padding-bottom: 1rem !important; }
    `,
  });
  await page.screenshot({ path: resolve(screenshotsDir, "01-storekeeper-dashboard.png"), fullPage: true });

  await page.getByRole("button", { name: "Issue stock", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "02-issue-stock.png"), fullPage: true });

  await signOut(page);
  await loginAs(page, 1, "2048");
  await page.getByRole("button", { name: /backfill csv/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "03-backfill-import.png"), fullPage: true });

  await signOut(page);
  await loginAs(page, 2, "1122");
  await page.getByRole("button", { name: /log leftovers/i }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "04-cook-leftovers.png"), fullPage: true });

  await signOut(page);
  await loginAs(page, 4, "4455");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "05-principal-view.png"), fullPage: true });

  await signOut(page);
  await loginAs(page, 1, "2048");
  await page.getByRole("button", { name: /student count/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "06-student-count.png"), fullPage: true });

  await signOut(page);
  await loginAs(page, 5, "7788");
  await page.getByRole("button", { name: /audit trail/i }).first().click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "07-admin-audit.png"), fullPage: true });

  await browser.close();
  console.log(`Saved demo screenshots to ${screenshotsDir}`);
} finally {
  serverProcess.kill("SIGTERM");
}
