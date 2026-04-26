import "dotenv/config";
import cors from "cors";
import express from "express";
import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getDemoDataset } from "../data/derivedData.js";
import { DEMO_DATA, ROLE_ACCESS, USERS } from "../data/demoData.js";
import {
  buildCostTrackingRows,
  buildDailySummaries,
  buildPrincipalSnapshot,
  calculateCost,
  dedupeAlerts,
  detectAnomaliesFromRecords,
  normalizeMealType,
  normalizeRole,
  roundValue,
  safeNumber,
  sortAlerts,
  toDateKey,
} from "../data/logic.js";
import { pool, withTransaction } from "./db.js";

const app = express();
const fallbackPath = resolve(process.cwd(), "data", "server-ingest-fallback.jsonl");
const dataMode = process.env.APP_DATA_MODE === "demo" ? "demo" : "database";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

function defaultWarnings() {
  return [];
}

function addWarning(warnings, code, message, severity = "medium") {
  warnings.push({ code, message, severity });
}

function isInputRoleAllowed(endpoint, actorRole) {
  const role = normalizeRole(actorRole);
  if (endpoint === "issue-stock" || endpoint === "stock-count") {
    return role === "STOREKEEPER";
  }
  if (endpoint === "log-leftover") {
    return role === "COOK";
  }
  return false;
}

function inferUserRole(actorUserId, actorRole) {
  if (actorRole) {
    return normalizeRole(actorRole);
  }

  return USERS.find((user) => user.id === Number(actorUserId))?.role || "UNKNOWN";
}

function subtractDays(dateKey, dayCount) {
  const date = new Date(`${dateKey}T00:00:00+03:00`);
  date.setDate(date.getDate() - dayCount);
  return date.toISOString().slice(0, 10);
}

function buildCommonWarnings(payload) {
  const warnings = defaultWarnings();

  if (!payload.item_id && !payload.raw_input_text) {
    addWarning(warnings, "missing_item", "Item was not clear, so the raw payload was preserved for follow-up.");
  }
  if (payload.quantity === null || payload.quantity === undefined || payload.quantity === "") {
    addWarning(warnings, "missing_quantity", "Quantity was missing, so it was saved with 0 for calculations.");
  }
  if (!payload.meal_type) {
    addWarning(warnings, "missing_meal_type", "Meal type was missing and should be reviewed later.");
  }
  if (!payload.date_time) {
    addWarning(warnings, "missing_date_time", "Timestamp was missing, so the server used the current time.");
  }
  if (safeNumber(payload.quantity) < 0) {
    addWarning(warnings, "negative_quantity", "Negative quantity was saved and marked for review.");
  }
  if (safeNumber(payload.quantity) > 80) {
    addWarning(warnings, "suspicious_quantity", "Quantity is higher than usual for one meal.");
  }

  return warnings;
}

async function appendFallback(endpoint, payload, warnings, errorMessage) {
  const line = JSON.stringify({
    endpoint,
    payload,
    warnings,
    error_message: errorMessage,
    saved_at: new Date().toISOString(),
  });
  await appendFile(fallbackPath, `${line}\n`, "utf8");
}

async function insertActivityLog(client, {
  actor_user_id,
  actor_role,
  action_type,
  target_table,
  target_id,
  status,
  payload,
  warnings,
  raw_input_text,
  notes,
  created_by,
  entered_late = false,
  conflict_flag = false,
  date_time,
}) {
  await client.query(
    `INSERT INTO activity_logs (
      actor_user_id, actor_role, action_type, target_table, target_id, status,
      payload, warnings, date_time, raw_input_text, notes, created_by, entered_late, conflict_flag
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14)`,
    [
      actor_user_id ?? null,
      actor_role ?? null,
      action_type,
      target_table,
      target_id ?? null,
      status,
      JSON.stringify(payload || {}),
      JSON.stringify(warnings || []),
      date_time || new Date().toISOString(),
      raw_input_text || null,
      notes || null,
      created_by ?? actor_user_id ?? null,
      entered_late,
      conflict_flag,
    ],
  );
}

async function getInventoryItems(client) {
  const result = await client.query("SELECT * FROM inventory_items ORDER BY id");
  return result.rows;
}

async function fetchDataset(dateFrom, dateTo) {
  if (dataMode === "demo") {
    return getDemoDataset(dateFrom, dateTo);
  }

  const filters = [];
  const params = [];
  if (dateFrom) {
    params.push(dateFrom);
    filters.push(`date_time::date >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dateTo);
    filters.push(`date_time::date <= $${params.length}::date`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const [issues, leftovers, counts, expected, students, inventory, storedAlerts] = await Promise.all([
    pool.query(`SELECT * FROM issue_logs ${whereClause} ORDER BY date_time`, params),
    pool.query(`SELECT * FROM leftover_logs ${whereClause} ORDER BY date_time`, params),
    pool.query(`SELECT * FROM stock_counts ${whereClause} ORDER BY date_time`, params),
    pool.query(`SELECT * FROM expected_usage ${whereClause} ORDER BY date_time`, params),
    pool.query(`SELECT * FROM student_counts ${whereClause} ORDER BY date_time`, params),
    pool.query("SELECT * FROM inventory_items ORDER BY id"),
    pool.query(`SELECT * FROM alerts ${whereClause} ORDER BY date_time DESC`, params),
  ]);

  return {
    issues: issues.rows,
    leftovers: leftovers.rows,
    stock_counts: counts.rows,
    expected_usage: expected.rows,
    student_counts: students.rows,
    inventory_items: inventory.rows,
    alerts: storedAlerts.rows,
  };
}

async function rebuildCostTrackingForDate(client, dateKey) {
  const [issues, leftovers, expected, inventory] = await Promise.all([
    client.query("SELECT * FROM issue_logs WHERE date_time::date = $1::date ORDER BY date_time", [dateKey]),
    client.query("SELECT * FROM leftover_logs WHERE date_time::date = $1::date ORDER BY date_time", [dateKey]),
    client.query("SELECT * FROM expected_usage WHERE usage_date = $1::date ORDER BY date_time", [dateKey]),
    client.query("SELECT * FROM inventory_items ORDER BY id"),
  ]);

  const rows = buildCostTrackingRows({
    issues: issues.rows,
    leftovers: leftovers.rows,
    expected_usage: expected.rows,
    inventory_items: inventory.rows,
  });

  await client.query("DELETE FROM cost_tracking WHERE report_date = $1::date", [dateKey]);
  for (const row of rows) {
    await client.query(
      `INSERT INTO cost_tracking (
        report_date, date_time, meal_type, item_id, quantity_used, unit_cost_kes,
        total_cost_kes, budget_kes, variance_kes, raw_input_text, source,
        created_by, entered_late, conflict_flag
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.report_date,
        row.date_time,
        row.meal_type,
        row.item_id,
        row.quantity_used,
        row.unit_cost_kes,
        row.total_cost_kes,
        row.budget_kes,
        row.variance_kes,
        row.raw_input_text,
        row.source,
        row.created_by,
        row.entered_late,
        row.conflict_flag,
      ],
    );
  }
}

async function maybeSaveDirectAlert(client, alert) {
  const existing = await client.query(
    `SELECT id FROM alerts
     WHERE alert_type = $1
       AND COALESCE(item_id, -1) = COALESCE($2, -1)
       AND COALESCE(meal_type, '') = COALESCE($3, '')
       AND date_time::date = $4::date
     LIMIT 1`,
    [alert.alert_type, alert.item_id ?? null, alert.meal_type ?? null, toDateKey(alert.date_time)],
  );

  if (existing.rows.length) {
    return;
  }

  await client.query(
    `INSERT INTO alerts (
      alert_type, severity, title, message, item_id, meal_type, status,
      source_record_type, source_record_id, date_time, raw_input_text, notes,
      created_by, entered_late, conflict_flag
    ) VALUES ($1,$2,$3,$4,$5,$6,'OPEN',$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      alert.alert_type,
      alert.severity,
      alert.title,
      alert.message,
      alert.item_id ?? null,
      alert.meal_type ?? null,
      alert.source_record_type ?? null,
      alert.source_record_id ?? null,
      alert.date_time,
      "System-generated alert",
      alert.message,
      5,
      false,
      false,
    ],
  );
}

async function handleReadOnlyAttempt(endpoint, payload, warnings) {
  await withTransaction(async (client) => {
    await insertActivityLog(client, {
      actor_user_id: payload.created_by ?? payload.actor_user_id ?? null,
      actor_role: inferUserRole(payload.created_by ?? payload.actor_user_id, payload.actor_role),
      action_type: endpoint.toUpperCase(),
      target_table: "activity_logs",
      target_id: null,
      status: "role_warning",
      payload,
      warnings,
      raw_input_text: payload.raw_input_text,
      notes: "Read-only role attempted data entry",
      created_by: payload.created_by ?? payload.actor_user_id ?? null,
      entered_late: Boolean(payload.entered_late),
      conflict_flag: false,
      date_time: payload.date_time,
    });
  });
}

app.post("/api/issue-stock", async (req, res) => {
  const payload = {
    item_id: req.body.item_id ?? null,
    quantity: req.body.quantity ?? null,
    meal_type: normalizeMealType(req.body.meal_type),
    date_time: req.body.date_time || new Date().toISOString(),
    raw_input_text: req.body.raw_input_text || null,
    notes: req.body.notes || null,
    created_by: req.body.created_by ?? req.body.actor_user_id ?? null,
    entered_late: Boolean(req.body.entered_late),
    conflict_flag: Boolean(req.body.conflict_flag),
  };
  const actorRole = inferUserRole(payload.created_by, req.body.actor_role);
  const warnings = buildCommonWarnings(payload);

  if (!isInputRoleAllowed("issue-stock", actorRole)) {
    addWarning(warnings, "role_warning", "Only the storekeeper can issue stock. The attempt was saved in the audit trail.");
    await handleReadOnlyAttempt("issue-stock", { ...payload, actor_role: actorRole }, warnings);
    return res.json({ success: true, warnings });
  }

  try {
    await withTransaction(async (client) => {
      const inventoryItems = await getInventoryItems(client);
      const item = inventoryItems.find((record) => record.id === Number(payload.item_id));
      const quantity = safeNumber(payload.quantity);
      if (!item) {
        addWarning(warnings, "unknown_item", "Item was not found in inventory. Raw text was still saved.");
      }

      const insertResult = await client.query(
        `INSERT INTO issue_logs (
          item_id, item_name_snapshot, quantity, unit, raw_input_text, meal_type,
          date_time, expected_students, notes, created_by, entered_late, conflict_flag
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *`,
        [
          payload.item_id,
          item?.name || req.body.item_name_snapshot || "Unmatched item",
          quantity,
          item?.unit || req.body.unit || null,
          payload.raw_input_text,
          payload.meal_type,
          payload.date_time,
          req.body.expected_students ?? null,
          payload.notes,
          payload.created_by,
          payload.entered_late,
          payload.conflict_flag,
        ],
      );

      const saved = insertResult.rows[0];
      const unitCost = safeNumber(item?.unit_cost_kes);
      await client.query(
        `INSERT INTO stock_transactions (
          item_id, transaction_type, quantity, unit, unit_cost_kes, total_cost_kes,
          reference_type, reference_id, meal_type, date_time, raw_input_text,
          notes, source_channel, created_by, entered_late, conflict_flag
        ) VALUES ($1,'ISSUE',$2,$3,$4,$5,'issue_logs',$6,$7,$8,$9,$10,'mobile',$11,$12,$13)`,
        [
          payload.item_id,
          -Math.abs(quantity),
          item?.unit || null,
          unitCost,
          -Math.abs(calculateCost(quantity, unitCost)),
          saved.id,
          payload.meal_type,
          payload.date_time,
          payload.raw_input_text,
          payload.notes,
          payload.created_by,
          payload.entered_late,
          payload.conflict_flag,
        ],
      );

      if (item) {
        await client.query(
          "UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) - $1 WHERE id = $2",
          [quantity, item.id],
        );
      }

      const duplicateCheck = await client.query(
        `SELECT COUNT(*)::int AS duplicate_count
         FROM issue_logs
         WHERE COALESCE(item_id, -1) = COALESCE($1, -1)
           AND COALESCE(meal_type, '') = COALESCE($2, '')
           AND date_time::date = $3::date`,
        [payload.item_id, payload.meal_type, toDateKey(payload.date_time)],
      );

      if (duplicateCheck.rows[0]?.duplicate_count > 1) {
        addWarning(warnings, "duplicate_issue", "This item appears to have been issued more than once for the same meal.");
        await maybeSaveDirectAlert(client, {
          alert_type: "duplicate_issue",
          severity: "HIGH",
          title: `${item?.name || "Item"} issued twice`,
          message: `${item?.name || "Item"} was issued more than once for ${payload.meal_type?.toLowerCase()} on ${toDateKey(payload.date_time)}.`,
          item_id: payload.item_id,
          meal_type: payload.meal_type,
          date_time: payload.date_time,
          source_record_type: "issue_logs",
          source_record_id: saved.id,
        });
      }

      await rebuildCostTrackingForDate(client, toDateKey(payload.date_time));
      await insertActivityLog(client, {
        actor_user_id: payload.created_by,
        actor_role: actorRole,
        action_type: "ISSUE_STOCK",
        target_table: "issue_logs",
        target_id: saved.id,
        status: "saved",
        payload: req.body,
        warnings,
        raw_input_text: payload.raw_input_text,
        notes: payload.notes,
        created_by: payload.created_by,
        entered_late: payload.entered_late,
        conflict_flag: payload.conflict_flag,
        date_time: payload.date_time,
      });
    });

    return res.json({ success: true, warnings });
  } catch (error) {
    addWarning(warnings, "server_storage_deferred", "Database save failed, so the payload was written to the server fallback queue.");
    await appendFallback("issue-stock", req.body, warnings, error.message);
    return res.json({ success: true, warnings });
  }
});

app.post("/api/log-leftover", async (req, res) => {
  const payload = {
    item_id: req.body.item_id ?? null,
    quantity: req.body.quantity ?? null,
    meal_type: normalizeMealType(req.body.meal_type),
    date_time: req.body.date_time || new Date().toISOString(),
    raw_input_text: req.body.raw_input_text || null,
    notes: req.body.notes || null,
    created_by: req.body.created_by ?? req.body.actor_user_id ?? null,
    entered_late: Boolean(req.body.entered_late),
    conflict_flag: Boolean(req.body.conflict_flag),
  };
  const actorRole = inferUserRole(payload.created_by, req.body.actor_role);
  const warnings = buildCommonWarnings(payload);

  if (!isInputRoleAllowed("log-leftover", actorRole)) {
    addWarning(warnings, "role_warning", "Only the cook can log leftovers. The attempt was saved in the audit trail.");
    await handleReadOnlyAttempt("log-leftover", { ...payload, actor_role: actorRole }, warnings);
    return res.json({ success: true, warnings });
  }

  try {
    await withTransaction(async (client) => {
      const inventoryItems = await getInventoryItems(client);
      const item = inventoryItems.find((record) => record.id === Number(payload.item_id));
      const quantity = safeNumber(payload.quantity);
      if (!item) {
        addWarning(warnings, "unknown_item", "Item was not found in inventory. Raw text was still saved.");
      }

      const insertResult = await client.query(
        `INSERT INTO leftover_logs (
          item_id, item_name_snapshot, quantity, unit, raw_input_text, meal_type,
          date_time, notes, created_by, entered_late, conflict_flag
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *`,
        [
          payload.item_id,
          item?.name || req.body.item_name_snapshot || "Unmatched item",
          quantity,
          item?.unit || req.body.unit || null,
          payload.raw_input_text,
          payload.meal_type,
          payload.date_time,
          payload.notes,
          payload.created_by,
          payload.entered_late,
          payload.conflict_flag,
        ],
      );
      const saved = insertResult.rows[0];

      await client.query(
        `INSERT INTO stock_transactions (
          item_id, transaction_type, quantity, unit, unit_cost_kes, total_cost_kes,
          reference_type, reference_id, meal_type, date_time, raw_input_text,
          notes, source_channel, created_by, entered_late, conflict_flag
        ) VALUES ($1,'LEFTOVER_LOG',$2,$3,$4,$5,'leftover_logs',$6,$7,$8,$9,$10,'mobile',$11,$12,$13)`,
        [
          payload.item_id,
          quantity,
          item?.unit || null,
          safeNumber(item?.unit_cost_kes),
          calculateCost(quantity, item?.unit_cost_kes),
          saved.id,
          payload.meal_type,
          payload.date_time,
          payload.raw_input_text,
          payload.notes,
          payload.created_by,
          payload.entered_late,
          payload.conflict_flag,
        ],
      );

      await rebuildCostTrackingForDate(client, toDateKey(payload.date_time));
      await insertActivityLog(client, {
        actor_user_id: payload.created_by,
        actor_role: actorRole,
        action_type: "LOG_LEFTOVER",
        target_table: "leftover_logs",
        target_id: saved.id,
        status: "saved",
        payload: req.body,
        warnings,
        raw_input_text: payload.raw_input_text,
        notes: payload.notes,
        created_by: payload.created_by,
        entered_late: payload.entered_late,
        conflict_flag: payload.conflict_flag,
        date_time: payload.date_time,
      });
    });

    return res.json({ success: true, warnings });
  } catch (error) {
    addWarning(warnings, "server_storage_deferred", "Database save failed, so the payload was written to the server fallback queue.");
    await appendFallback("log-leftover", req.body, warnings, error.message);
    return res.json({ success: true, warnings });
  }
});

app.post("/api/stock-count", async (req, res) => {
  const payload = {
    item_id: req.body.item_id ?? null,
    counted_quantity: req.body.counted_quantity ?? req.body.quantity ?? null,
    system_quantity: req.body.system_quantity ?? null,
    meal_type: normalizeMealType(req.body.meal_type),
    date_time: req.body.date_time || new Date().toISOString(),
    raw_input_text: req.body.raw_input_text || null,
    notes: req.body.notes || null,
    created_by: req.body.created_by ?? req.body.actor_user_id ?? null,
    entered_late: Boolean(req.body.entered_late),
    conflict_flag: Boolean(req.body.conflict_flag),
  };
  const actorRole = inferUserRole(payload.created_by, req.body.actor_role);
  const warnings = buildCommonWarnings(payload);

  if (!isInputRoleAllowed("stock-count", actorRole)) {
    addWarning(warnings, "role_warning", "Only the storekeeper can perform stock counts. The attempt was saved in the audit trail.");
    await handleReadOnlyAttempt("stock-count", { ...payload, actor_role: actorRole }, warnings);
    return res.json({ success: true, warnings });
  }

  try {
    await withTransaction(async (client) => {
      const inventoryItems = await getInventoryItems(client);
      const item = inventoryItems.find((record) => record.id === Number(payload.item_id));
      const countedQuantity = safeNumber(payload.counted_quantity);
      const systemQuantity = payload.system_quantity === null || payload.system_quantity === undefined
        ? safeNumber(item?.current_stock)
        : safeNumber(payload.system_quantity);
      const varianceQuantity = roundValue(countedQuantity - systemQuantity);

      const insertResult = await client.query(
        `INSERT INTO stock_counts (
          item_id, counted_quantity, system_quantity, variance_quantity, unit,
          raw_input_text, meal_type, date_time, notes, created_by, entered_late, conflict_flag
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *`,
        [
          payload.item_id,
          countedQuantity,
          systemQuantity,
          varianceQuantity,
          item?.unit || req.body.unit || null,
          payload.raw_input_text,
          payload.meal_type,
          payload.date_time,
          payload.notes,
          payload.created_by,
          payload.entered_late,
          payload.conflict_flag,
        ],
      );
      const saved = insertResult.rows[0];

      await client.query(
        `INSERT INTO stock_transactions (
          item_id, transaction_type, quantity, unit, unit_cost_kes, total_cost_kes,
          reference_type, reference_id, meal_type, date_time, raw_input_text,
          notes, source_channel, created_by, entered_late, conflict_flag
        ) VALUES ($1,'STOCK_COUNT_RECON',$2,$3,$4,$5,'stock_counts',$6,$7,$8,$9,$10,'mobile',$11,$12,$13)`,
        [
          payload.item_id,
          varianceQuantity,
          item?.unit || null,
          safeNumber(item?.unit_cost_kes),
          calculateCost(varianceQuantity, item?.unit_cost_kes),
          saved.id,
          payload.meal_type,
          payload.date_time,
          payload.raw_input_text,
          payload.notes,
          payload.created_by,
          payload.entered_late,
          payload.conflict_flag,
        ],
      );

      if (item) {
        await client.query("UPDATE inventory_items SET current_stock = $1 WHERE id = $2", [
          countedQuantity,
          item.id,
        ]);
      }

      if (Math.abs(varianceQuantity) >= 1) {
        addWarning(warnings, "stock_mismatch", "Count differs from the system balance and needs review.");
        await maybeSaveDirectAlert(client, {
          alert_type: "stock_mismatch",
          severity: Math.abs(varianceQuantity) >= 5 ? "HIGH" : "MEDIUM",
          title: `${item?.name || "Stock"} variance detected`,
          message: `Counted ${countedQuantity} against system ${systemQuantity}.`,
          item_id: payload.item_id,
          meal_type: payload.meal_type,
          date_time: payload.date_time,
          source_record_type: "stock_counts",
          source_record_id: saved.id,
        });
      }

      await insertActivityLog(client, {
        actor_user_id: payload.created_by,
        actor_role: actorRole,
        action_type: "STOCK_COUNT",
        target_table: "stock_counts",
        target_id: saved.id,
        status: "saved",
        payload: req.body,
        warnings,
        raw_input_text: payload.raw_input_text,
        notes: payload.notes,
        created_by: payload.created_by,
        entered_late: payload.entered_late,
        conflict_flag: payload.conflict_flag,
        date_time: payload.date_time,
      });
    });

    return res.json({ success: true, warnings });
  } catch (error) {
    addWarning(warnings, "server_storage_deferred", "Database save failed, so the payload was written to the server fallback queue.");
    await appendFallback("stock-count", req.body, warnings, error.message);
    return res.json({ success: true, warnings });
  }
});

app.get("/api/dashboard-summary", async (req, res) => {
  const date = req.query.date || "2026-04-26";
  const role = normalizeRole(req.query.role || "STOREKEEPER");
  const dataset = await fetchDataset(subtractDays(date, 6), date);
  const derivedAlerts = detectAnomaliesFromRecords(dataset);
  const alerts = dedupeAlerts([...dataset.alerts, ...derivedAlerts]);
  const summaries = buildDailySummaries({ ...dataset, alerts });
  const summary = summaries.find((record) => record.date === date) || summaries[summaries.length - 1] || null;

  if (role === "PRINCIPAL") {
    return res.json({
      success: true,
      warnings: [],
      role,
      date,
      dashboard: buildPrincipalSnapshot(summary, alerts),
    });
  }

  return res.json({
    success: true,
    warnings: [],
    role,
    date,
    dashboard: {
      summary,
      quick_actions: ROLE_ACCESS[role] || [],
    },
  });
});

app.get("/api/alerts", async (req, res) => {
  const role = normalizeRole(req.query.role || "STOREKEEPER");
  const dataset = await fetchDataset(req.query.startDate || "2026-04-20", req.query.endDate || "2026-04-26");
  const derivedAlerts = detectAnomaliesFromRecords(dataset);
  const uniqueAlerts = dedupeAlerts([...dataset.alerts, ...derivedAlerts]);

  const filtered = role === "PRINCIPAL"
    ? uniqueAlerts.filter((alert) => alert.severity === "HIGH").slice(0, 3)
    : uniqueAlerts;

  return res.json({
    success: true,
    warnings: [],
    alerts: filtered,
  });
});

app.get("/api/reports", async (req, res) => {
  const startDate = req.query.startDate || "2026-04-20";
  const endDate = req.query.endDate || "2026-04-26";
  const dataset = await fetchDataset(startDate, endDate);
  const derivedAlerts = detectAnomaliesFromRecords(dataset);
  const alerts = sortAlerts([...dataset.alerts, ...derivedAlerts]);
  const summaries = buildDailySummaries({ ...dataset, alerts });
  const mealCosts = summaries.flatMap((summary) =>
    summary.meal_summaries.map((meal) => ({
      date: summary.date,
      meal_type: meal.meal_type,
      cost_kes: meal.cost_kes,
      waste_estimate_kes: meal.waste_estimate_kes,
    })),
  );

  return res.json({
    success: true,
    warnings: [],
    reports: {
      summary_range: { startDate, endDate },
      daily_summaries: summaries,
      meal_costs: mealCosts,
      alerts,
      generated_insights: [
        `Average daily cost: KES ${roundValue(
          summaries.reduce((total, summary) => total + safeNumber(summary.total_cost_kes), 0) /
            Math.max(summaries.length, 1),
        )}`,
        `Highest cost day: ${
          [...summaries].sort((left, right) => safeNumber(right.total_cost_kes) - safeNumber(left.total_cost_kes))[0]?.date || "n/a"
        }`,
        `Highest waste estimate: KES ${
          roundValue(
            [...summaries].sort(
              (left, right) => safeNumber(right.waste_estimate_kes) - safeNumber(left.waste_estimate_kes),
            )[0]?.waste_estimate_kes || 0,
          )
        }`,
      ],
    },
  });
});

app.get("/api/health", async (_req, res) => {
  if (dataMode === "demo") {
    return res.json({
      success: true,
      warnings: [],
      database_time: null,
      demo_inventory_count: DEMO_DATA.inventory_items.length,
      data_mode: "demo",
    });
  }

  const result = await pool.query("SELECT NOW() AS current_time");
  return res.json({
    success: true,
    warnings: [],
    database_time: result.rows[0]?.current_time,
    demo_inventory_count: DEMO_DATA.inventory_items.length,
    data_mode: "database",
  });
});

export default app;
