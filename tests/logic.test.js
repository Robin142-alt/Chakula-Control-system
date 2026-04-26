import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_DATA } from "../data/demoData.js";
import { buildActivityFeed, buildInventorySnapshot, buildReportInsights } from "../data/derivedData.js";
import {
  buildDailySummaries,
  buildPrincipalSnapshot,
  calculateConsumption,
  calculateLeftoverPercentage,
  detectAnomaliesFromRecords,
} from "../data/logic.js";

test("core calculations use safe defaults", () => {
  assert.equal(calculateConsumption(12, 2), 10);
  assert.equal(calculateConsumption(null, null), 0);
  assert.equal(calculateLeftoverPercentage(20, 2), 10);
  assert.equal(calculateLeftoverPercentage(0, 2), 0);
});

test("demo dataset produces all required anomaly types", () => {
  const inventorySnapshot = buildInventorySnapshot(DEMO_DATA);
  const alerts = detectAnomaliesFromRecords({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
  });
  const alertTypes = new Set(alerts.map((alert) => alert.alert_type));

  assert.ok(alertTypes.has("duplicate_issue"));
  assert.ok(alertTypes.has("missing_leftover"));
  assert.ok(alertTypes.has("stock_mismatch"));
  assert.ok(alertTypes.has("abnormal_consumption"));
});

test("daily summaries collapse to the expected seven demo days", () => {
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

  assert.equal(summaries.length, 7);
  assert.equal(summaries[0].date, "2026-04-20");
  assert.equal(summaries[6].date, "2026-04-26");

  const today = summaries.find((summary) => summary.date === "2026-04-26");
  assert.ok(today);
  assert.equal(today.total_cost_kes, 11447.53);
  assert.equal(today.cost_per_student_kes, 71.1);
});

test("principal snapshot limits output to top three high alerts", () => {
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
  const today = summaries.find((summary) => summary.date === "2026-04-26");
  const snapshot = buildPrincipalSnapshot(today, alerts);

  assert.equal(snapshot.alerts.length, 3);
  assert.ok(snapshot.alerts.every((alert) => alert.severity === "HIGH"));
});

test("report insights highlight cost, waste, and missing leftover pressure points", () => {
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
  const insights = buildReportInsights(summaries, alerts);

  assert.equal(insights.highestCostDay?.date, "2026-04-23");
  assert.equal(insights.highestWasteDay?.date, "2026-04-23");
  assert.ok(insights.highAlertCount >= 1);
  assert.ok(insights.missingLeftoverCount >= 2);
  assert.ok(insights.mealWatchlist.length >= 1);
});

test("activity feed includes input actions and system alerts", () => {
  const inventorySnapshot = buildInventorySnapshot(DEMO_DATA);
  const alerts = detectAnomaliesFromRecords({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
  });
  const activityFeed = buildActivityFeed({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
    alerts,
  });

  assert.ok(activityFeed.some((record) => record.action_type === "ISSUE_STOCK"));
  assert.ok(activityFeed.some((record) => record.action_type === "STUDENT_COUNT"));
  assert.ok(activityFeed.some((record) => record.action_type === "SYSTEM_ALERT"));
  assert.equal(activityFeed[0].date_time >= activityFeed[1].date_time, true);
});
