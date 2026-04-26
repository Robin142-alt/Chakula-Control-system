import test from "node:test";
import assert from "node:assert/strict";
import { DEMO_DATA } from "../data/demoData.js";
import { buildInventorySnapshot } from "../data/derivedData.js";
import { buildDailySummaries, detectAnomaliesFromRecords } from "../data/logic.js";
import {
  buildAlertExportRows,
  buildCsv,
  buildDailySummaryExportRows,
  buildLocalBackupDocument,
  buildPrincipalBriefHtml,
  buildSyncQueueSummary,
  parseLocalBackupText,
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

test("sync queue summary counts pending, retries, and conflicts", () => {
  const summary = buildSyncQueueSummary([
    {
      id: "queue-1",
      store_name: "issue_logs",
      created_at: "2026-04-26T08:00:00.000Z",
      attempts: 0,
      conflict_flag: false,
    },
    {
      id: "queue-2",
      store_name: "stock_counts",
      created_at: "2026-04-25T08:00:00.000Z",
      attempts: 2,
      conflict_flag: true,
      last_error: "offline",
    },
  ]);

  assert.equal(summary.pending_count, 2);
  assert.equal(summary.retry_count, 1);
  assert.equal(summary.conflict_count, 1);
  assert.equal(summary.oldest_pending_at, "2026-04-25T08:00:00.000Z");
  assert.equal(summary.type_counts.issue_logs, 1);
  assert.equal(summary.type_counts.stock_counts, 1);
});

test("local backup document includes queue summary and settings", () => {
  const backup = JSON.parse(buildLocalBackupDocument({
    settings: {
      school_name: "Demo Boarding School",
    },
    queueItems: [
      {
        id: "queue-1",
        store_name: "issue_logs",
        created_at: "2026-04-26T08:00:00.000Z",
      },
    ],
    issueLogs: [{ id: 1 }],
    leftoverLogs: [],
    stockCounts: [],
    studentCounts: [],
    alerts: [],
    summaries: [],
  }));

  assert.equal(backup.app_name, "Chakula Control");
  assert.equal(backup.settings.school_name, "Demo Boarding School");
  assert.equal(backup.sync_queue_summary.pending_count, 1);
  assert.equal(backup.local_records.issue_logs.length, 1);
});

test("backup parser rejects invalid json and warns on empty files", () => {
  const invalid = parseLocalBackupText("{not json}");
  const empty = parseLocalBackupText("");

  assert.equal(invalid.success, false);
  assert.ok(invalid.warnings[0].includes("valid JSON"));
  assert.equal(empty.success, false);
  assert.ok(empty.warnings[0].includes("Choose a backup JSON file"));
});

test("backup parser normalizes queue-only restore data", () => {
  const parsed = parseLocalBackupText(JSON.stringify({
    app_name: "Chakula Control",
    schema_version: 1,
    sync_queue: [
      {
        id: "queue-1",
        store_name: "issue_logs",
      },
    ],
  }));

  assert.equal(parsed.success, true);
  assert.equal(parsed.backup.sync_queue.length, 1);
  assert.equal(parsed.warnings.length, 0);
});
