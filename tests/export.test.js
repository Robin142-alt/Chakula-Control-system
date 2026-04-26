import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_DATA } from "../data/demoData.js";
import { buildInventorySnapshot } from "../data/derivedData.js";
import { buildDailySummaries, detectAnomaliesFromRecords } from "../data/logic.js";
import {
  buildAlertExportRows,
  buildCsv,
  buildDailySummaryExportRows,
  buildPrincipalBriefHtml,
} from "../src/lib/export.js";

function buildDemoSummaryState() {
  const inventorySnapshot = buildInventorySnapshot(DEMO_DATA);
  const alerts = detectAnomaliesFromRecords({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
  });
  const summaries = buildDailySummaries({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
    alerts,
  });

  return {
    alerts,
    summaries,
    latestSummary: summaries[summaries.length - 1],
  };
}

test("csv export escapes commas and quotes safely", () => {
  const csv = buildCsv(
    ["title", "message"],
    [
      {
        title: 'Beans, rice, and "oil"',
        message: "Saved from paper note",
      },
    ],
  );

  assert.equal(csv, 'title,message\n"Beans, rice, and ""oil""",Saved from paper note');
});

test("daily summary export flattens all seven days into meal rows", () => {
  const { summaries } = buildDemoSummaryState();
  const rows = buildDailySummaryExportRows(summaries);

  assert.equal(rows.length, 21);
  assert.equal(rows[0].date, "2026-04-20");
  assert.equal(rows[0].meal_type, "BREAKFAST");
  assert.ok("variance_kes" in rows[0]);
});

test("alert export keeps likely issue and next-check context", () => {
  const { alerts } = buildDemoSummaryState();
  const rows = buildAlertExportRows(alerts);

  assert.ok(rows.length >= 1);
  assert.ok(rows.some((row) => row.issue_assessment === "POSSIBLE_THEFT"));
  assert.ok(rows.some((row) => row.action_hint.length > 10));
});

test("principal brief html stays school-friendly and limited to top alerts", () => {
  const { alerts, latestSummary } = buildDemoSummaryState();
  const html = buildPrincipalBriefHtml({
    settings: {
      school_name: "Demo Boarding School",
      kitchen_name: "Main Kitchen",
      alert_contact: "Admin Achieng",
    },
    summary: latestSummary,
    alerts,
    generatedAt: "2026-04-26T18:30:00.000Z",
  });

  const listItems = html.match(/<li>/g) || [];

  assert.ok(html.includes("Demo Boarding School"));
  assert.ok(html.includes("Main Kitchen daily principal brief"));
  assert.ok(html.includes("Top alerts"));
  assert.ok(listItems.length <= 3);
});
