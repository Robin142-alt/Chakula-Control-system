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

  await page.getByLabel("Active user").selectOption("2");
  await page.getByRole("button", { name: /log leftovers/i }).click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "03-cook-leftovers.png"), fullPage: true });

  await page.getByLabel("Active user").selectOption("4");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: resolve(screenshotsDir, "04-principal-view.png"), fullPage: true });

  await browser.close();
  console.log(`Saved demo screenshots to ${screenshotsDir}`);
} finally {
  serverProcess.kill("SIGTERM");
}
