import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pool } from "../server/db.js";
import { DEMO_DATA } from "../data/demoData.js";
import {
  buildCostTrackingRows,
  buildDailySummaries,
  buildPrincipalSnapshot,
  detectAnomaliesFromRecords,
  roundValue,
} from "../data/logic.js";

function serialize(value) {
  if (value === undefined) {
    return null;
  }

  return value;
}

async function insertMany(client, tableName, rows) {
  if (!rows.length) {
    return;
  }

  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((column) => serialize(row[column]));
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    await client.query(sql, values);
  }
}

function buildTransactionRows() {
  let idCounter = 6001;
  const openingStockRows = DEMO_DATA.inventory_items.map((item) => ({
    id: idCounter++,
    item_id: item.id,
    transaction_type: "OPENING_BALANCE",
    quantity: item.current_stock,
    unit: item.unit,
    unit_cost_kes: item.unit_cost_kes,
    total_cost_kes: roundValue(item.current_stock * item.unit_cost_kes),
    reference_type: "inventory_items",
    reference_id: item.id,
    meal_type: null,
    date_time: "2026-04-19T06:00:00+03:00",
    raw_input_text: item.raw_input_text,
    notes: "Opening balance for demo setup",
    source_channel: "seed",
    created_by: 5,
    entered_late: false,
    conflict_flag: false,
  }));

  const issueRows = DEMO_DATA.issue_logs.map((issue) => ({
    id: idCounter++,
    item_id: issue.item_id,
    transaction_type: "ISSUE",
    quantity: -Math.abs(issue.quantity || 0),
    unit: issue.unit,
    unit_cost_kes: DEMO_DATA.inventory_items.find((item) => item.id === issue.item_id)?.unit_cost_kes || 0,
    total_cost_kes: roundValue(
      -(Math.abs(issue.quantity || 0) * (DEMO_DATA.inventory_items.find((item) => item.id === issue.item_id)?.unit_cost_kes || 0)),
    ),
    reference_type: "issue_logs",
    reference_id: issue.id,
    meal_type: issue.meal_type,
    date_time: issue.date_time,
    raw_input_text: issue.raw_input_text,
    notes: issue.notes,
    source_channel: "mobile_seed",
    created_by: issue.created_by,
    entered_late: issue.entered_late,
    conflict_flag: issue.conflict_flag,
  }));

  const leftoverRows = DEMO_DATA.leftover_logs.map((leftover) => ({
    id: idCounter++,
    item_id: leftover.item_id,
    transaction_type: "LEFTOVER_LOG",
    quantity: leftover.quantity,
    unit: leftover.unit,
    unit_cost_kes: DEMO_DATA.inventory_items.find((item) => item.id === leftover.item_id)?.unit_cost_kes || 0,
    total_cost_kes: roundValue(
      (leftover.quantity || 0) * (DEMO_DATA.inventory_items.find((item) => item.id === leftover.item_id)?.unit_cost_kes || 0),
    ),
    reference_type: "leftover_logs",
    reference_id: leftover.id,
    meal_type: leftover.meal_type,
    date_time: leftover.date_time,
    raw_input_text: leftover.raw_input_text,
    notes: leftover.notes,
    source_channel: "mobile_seed",
    created_by: leftover.created_by,
    entered_late: leftover.entered_late,
    conflict_flag: leftover.conflict_flag,
  }));

  const countRows = DEMO_DATA.stock_counts.map((count) => ({
    id: idCounter++,
    item_id: count.item_id,
    transaction_type: "STOCK_COUNT_RECON",
    quantity: count.variance_quantity,
    unit: count.unit,
    unit_cost_kes: DEMO_DATA.inventory_items.find((item) => item.id === count.item_id)?.unit_cost_kes || 0,
    total_cost_kes: roundValue(
      (count.variance_quantity || 0) * (DEMO_DATA.inventory_items.find((item) => item.id === count.item_id)?.unit_cost_kes || 0),
    ),
    reference_type: "stock_counts",
    reference_id: count.id,
    meal_type: count.meal_type,
    date_time: count.date_time,
    raw_input_text: count.raw_input_text,
    notes: count.notes,
    source_channel: "count_seed",
    created_by: count.created_by,
    entered_late: count.entered_late,
    conflict_flag: count.conflict_flag,
  }));

  return [...openingStockRows, ...issueRows, ...leftoverRows, ...countRows];
}

function buildActivityLogs(alertRows) {
  let idCounter = 9001;
  const rows = [];
  for (const issue of DEMO_DATA.issue_logs) {
    rows.push({
      id: idCounter++,
      actor_user_id: issue.created_by,
      actor_role: "STOREKEEPER",
      action_type: "ISSUE_STOCK",
      target_table: "issue_logs",
      target_id: issue.id,
      status: "saved",
      payload: JSON.stringify(issue),
      warnings: JSON.stringify([]),
      date_time: issue.date_time,
      raw_input_text: issue.raw_input_text,
      notes: issue.notes,
      created_by: issue.created_by,
      entered_late: issue.entered_late,
      conflict_flag: issue.conflict_flag,
    });
  }
  for (const leftover of DEMO_DATA.leftover_logs) {
    rows.push({
      id: idCounter++,
      actor_user_id: leftover.created_by,
      actor_role: "COOK",
      action_type: "LOG_LEFTOVER",
      target_table: "leftover_logs",
      target_id: leftover.id,
      status: "saved",
      payload: JSON.stringify(leftover),
      warnings: JSON.stringify([]),
      date_time: leftover.date_time,
      raw_input_text: leftover.raw_input_text,
      notes: leftover.notes,
      created_by: leftover.created_by,
      entered_late: leftover.entered_late,
      conflict_flag: leftover.conflict_flag,
    });
  }
  for (const count of DEMO_DATA.stock_counts) {
    rows.push({
      id: idCounter++,
      actor_user_id: count.created_by,
      actor_role: "STOREKEEPER",
      action_type: "STOCK_COUNT",
      target_table: "stock_counts",
      target_id: count.id,
      status: "saved",
      payload: JSON.stringify(count),
      warnings: JSON.stringify([]),
      date_time: count.date_time,
      raw_input_text: count.raw_input_text,
      notes: count.notes,
      created_by: count.created_by,
      entered_late: count.entered_late,
      conflict_flag: count.conflict_flag,
    });
  }
  for (const alert of alertRows) {
    rows.push({
      id: idCounter++,
      actor_user_id: 5,
      actor_role: "ADMIN",
      action_type: "SYSTEM_ALERT",
      target_table: "alerts",
      target_id: alert.id,
      status: "generated",
      payload: JSON.stringify(alert),
      warnings: JSON.stringify([]),
      date_time: alert.date_time,
      raw_input_text: alert.raw_input_text,
      notes: alert.notes,
      created_by: 5,
      entered_late: false,
      conflict_flag: false,
    });
  }
  return rows;
}

function buildAlertRows() {
  let idCounter = 8001;
  const generatedAlerts = detectAnomaliesFromRecords(DEMO_DATA).map((alert) => ({
    id: idCounter++,
    alert_type: alert.alert_type,
    severity: alert.severity,
    title: alert.title,
    message: alert.message,
    item_id: alert.item_id,
    meal_type: alert.meal_type,
    status: "OPEN",
    source_record_type: alert.source_record_type,
    source_record_id: alert.source_record_id,
    date_time: alert.date_time,
    raw_input_text: "System-generated alert",
    notes: alert.message,
    created_by: 5,
    entered_late: false,
    conflict_flag: false,
  }));

  return generatedAlerts;
}

function buildInventorySnapshot() {
  const issueLogs = [...DEMO_DATA.issue_logs].sort((left, right) => String(left.date_time).localeCompare(String(right.date_time)));
  const latestCountsByItem = new Map();

  [...DEMO_DATA.stock_counts]
    .sort((left, right) => String(left.date_time).localeCompare(String(right.date_time)))
    .forEach((count) => {
      latestCountsByItem.set(count.item_id, count);
    });

  return DEMO_DATA.inventory_items.map((item) => {
    const latestCount = latestCountsByItem.get(item.id);
    const issuesAfterCount = issueLogs
      .filter((issue) => issue.item_id === item.id && (!latestCount || issue.date_time > latestCount.date_time))
      .reduce((total, issue) => total + (issue.quantity || 0), 0);

    return {
      ...item,
      current_stock: latestCount
        ? roundValue((latestCount.counted_quantity || 0) - issuesAfterCount)
        : roundValue((item.current_stock || 0) - issuesAfterCount),
    };
  });
}

const client = await pool.connect();

try {
  await client.query("BEGIN");
  await client.query("TRUNCATE activity_logs, cost_tracking, alerts, stock_counts, leftover_logs, issue_logs, stock_transactions, expected_usage, student_counts, inventory_items, users RESTART IDENTITY");

  const inventorySnapshot = buildInventorySnapshot();
  const alertRows = buildAlertRows();
  const costRows = buildCostTrackingRows({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
  });
  const activityRows = buildActivityLogs(alertRows);

  await insertMany(client, "users", DEMO_DATA.users);
  await insertMany(client, "inventory_items", inventorySnapshot);
  await insertMany(client, "student_counts", DEMO_DATA.student_counts);
  await insertMany(client, "expected_usage", DEMO_DATA.expected_usage);
  await insertMany(client, "issue_logs", DEMO_DATA.issue_logs);
  await insertMany(client, "leftover_logs", DEMO_DATA.leftover_logs);
  await insertMany(client, "stock_counts", DEMO_DATA.stock_counts);
  await insertMany(client, "stock_transactions", buildTransactionRows());
  await insertMany(client, "alerts", alertRows);
  await insertMany(client, "cost_tracking", costRows);
  await insertMany(client, "activity_logs", activityRows);

  await client.query("COMMIT");

  const summaries = buildDailySummaries({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
    alerts: alertRows,
  });
  const todaySummary = summaries.find((summary) => summary.date === "2026-04-26");
  const principalSnapshot = buildPrincipalSnapshot(todaySummary, alertRows);
  const output = {
    generated_at: new Date().toISOString(),
    seven_day_summary: summaries,
    simulated_dashboard_output: {
      date: "2026-04-26",
      todays_cost_label: `Today's Cost: KES ${roundValue(todaySummary?.total_cost_kes || 0)}`,
      cost_per_student_label: `Cost per Student: KES ${roundValue(todaySummary?.cost_per_student_kes || 0)}`,
      alerts: principalSnapshot.alerts.map((alert) => alert.title),
    },
  };

  const outputPath = resolve(process.cwd(), "docs", "simulated-dashboard-output.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2), "utf8");

  console.log("Demo data loaded into Neon and simulated output written to docs/simulated-dashboard-output.json");
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
