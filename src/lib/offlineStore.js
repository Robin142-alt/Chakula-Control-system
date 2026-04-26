import { openDB } from "idb";
import { DEMO_DATA, USERS } from "../../data/demoData.js";
import {
  buildDailySummaries,
  buildPrincipalSnapshot,
  dedupeAlerts,
  detectAnomaliesFromRecords,
  normalizeMealType,
  normalizeRole,
  roundValue,
  safeNumber,
  sortAlerts,
} from "../../data/logic.js";

const DB_NAME = "chakula-control-local";
const DB_VERSION = 1;
const STORE_NAMES = [
  "meta",
  "inventory_items",
  "issue_logs",
  "leftover_logs",
  "stock_counts",
  "student_counts",
  "expected_usage",
  "alerts",
  "sync_queue",
];

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
}

function sortByDateTime(records) {
  return [...records].sort((left, right) => String(left.date_time).localeCompare(String(right.date_time)));
}

function buildInventorySnapshot(dataset) {
  const latestCounts = new Map();

  dataset.stock_counts
    .slice()
    .sort((left, right) => String(left.date_time).localeCompare(String(right.date_time)))
    .forEach((count) => {
      latestCounts.set(count.item_id, count);
    });

  return dataset.inventory_items.map((item) => {
    const latestCount = latestCounts.get(item.id);
    const issuesAfterCount = dataset.issue_logs
      .filter((issue) => issue.item_id === item.id && (!latestCount || issue.date_time > latestCount.date_time))
      .reduce((total, issue) => total + safeNumber(issue.quantity), 0);
    const current_stock =
      latestCount?.counted_quantity !== undefined
        ? roundValue(safeNumber(latestCount.counted_quantity) - issuesAfterCount)
        : roundValue(safeNumber(item.current_stock) - issuesAfterCount);

    return {
      ...item,
      current_stock,
      status:
        current_stock <= safeNumber(item.reorder_level)
          ? "Low"
          : current_stock <= safeNumber(item.reorder_level) * 1.5
            ? "Watch"
            : "Healthy",
    };
  });
}

function createLocalWarnings(record) {
  const warnings = [];

  if (!record.item_id && !record.raw_input_text) {
    warnings.push("Item missing. Saved for later review.");
  }
  if (record.quantity === null || record.quantity === undefined || record.quantity === "") {
    warnings.push("Quantity missing. Saved with 0 for calculations.");
  }
  if (!record.meal_type) {
    warnings.push("Meal type missing. Saved anyway.");
  }
  if (safeNumber(record.quantity) > 80) {
    warnings.push("Large quantity recorded. Review when convenient.");
  }

  return warnings;
}

export async function openKitchenDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: "id" });
          if (storeName === "sync_queue") {
            store.createIndex("created_at", "created_at");
          }
        }
      });
    },
  });
}

export async function seedKitchenDb() {
  const db = await openKitchenDb();
  const seeded = await db.get("meta", "seeded");
  if (seeded) {
    return;
  }

  const inventorySnapshot = buildInventorySnapshot(DEMO_DATA);
  const tx = db.transaction(STORE_NAMES, "readwrite");

  await tx.objectStore("meta").put({ id: "seeded", value: true });
  await tx.objectStore("meta").put({ id: "last_sync_at", value: null });
  await tx.objectStore("meta").put({ id: "active_user_id", value: 1 });

  for (const user of USERS) {
    await tx.objectStore("meta").put({ id: `user:${user.id}`, value: user });
  }
  for (const item of DEMO_DATA.inventory_items) {
    await tx.objectStore("inventory_items").put(item);
  }
  for (const row of DEMO_DATA.issue_logs) {
    await tx.objectStore("issue_logs").put({ ...row, sync_status: "seeded" });
  }
  for (const row of DEMO_DATA.leftover_logs) {
    await tx.objectStore("leftover_logs").put({ ...row, sync_status: "seeded" });
  }
  for (const row of DEMO_DATA.stock_counts) {
    await tx.objectStore("stock_counts").put({ ...row, sync_status: "seeded" });
  }
  for (const row of DEMO_DATA.student_counts) {
    await tx.objectStore("student_counts").put(row);
  }
  for (const row of DEMO_DATA.expected_usage) {
    await tx.objectStore("expected_usage").put(row);
  }

  const alerts = detectAnomaliesFromRecords({
    ...DEMO_DATA,
    inventory_items: inventorySnapshot,
  }).map((alert, index) => ({
    ...alert,
    id: 9800 + index,
  }));

  for (const row of alerts) {
    await tx.objectStore("alerts").put(row);
  }

  await tx.done;
}

export async function getActiveUser() {
  const db = await openKitchenDb();
  const stored = await db.get("meta", "active_user_id");
  const userId = stored?.value || 1;
  return USERS.find((user) => user.id === userId) || USERS[0];
}

export async function setActiveUser(userId) {
  const db = await openKitchenDb();
  await db.put("meta", { id: "active_user_id", value: Number(userId) });
}

export async function loadAppSnapshot() {
  const db = await openKitchenDb();
  const [inventory_items, issue_logs, leftover_logs, stock_counts, student_counts, expected_usage, alerts, sync_queue, lastSync] =
    await Promise.all([
      db.getAll("inventory_items"),
      db.getAll("issue_logs"),
      db.getAll("leftover_logs"),
      db.getAll("stock_counts"),
      db.getAll("student_counts"),
      db.getAll("expected_usage"),
      db.getAll("alerts"),
      db.getAll("sync_queue"),
      db.get("meta", "last_sync_at"),
    ]);

  const inventorySnapshot = buildInventorySnapshot({
    inventory_items,
    issue_logs,
    stock_counts,
  });
  const derivedAlerts = detectAnomaliesFromRecords({
    inventory_items: inventorySnapshot,
    issue_logs,
    leftover_logs,
    stock_counts,
    expected_usage,
  }).map((alert, index) => ({
    ...alert,
    id: alert.id || 9900 + index,
  }));
  const uniqueAlerts = dedupeAlerts([...alerts, ...derivedAlerts]);

  const summaries = buildDailySummaries({
    inventory_items: inventorySnapshot,
    issue_logs: sortByDateTime(issue_logs),
    leftover_logs: sortByDateTime(leftover_logs),
    stock_counts: sortByDateTime(stock_counts),
    expected_usage,
    student_counts,
    alerts: uniqueAlerts,
  });
  const latestSummary = summaries[summaries.length - 1] || null;

  return {
    inventory_items: inventorySnapshot,
    issue_logs: sortByDateTime(issue_logs),
    leftover_logs: sortByDateTime(leftover_logs),
    stock_counts: sortByDateTime(stock_counts),
    student_counts,
    expected_usage,
    alerts: uniqueAlerts,
    summaries,
    latest_summary: latestSummary,
    principal_snapshot: buildPrincipalSnapshot(latestSummary, uniqueAlerts),
    queue_count: sync_queue.length,
    last_sync_at: lastSync?.value || null,
  };
}

export async function saveEntryLocally(storeName, endpoint, payload) {
  const db = await openKitchenDb();
  const now = new Date().toISOString();
  const numericQuantity =
    payload.quantity === undefined
      ? payload.counted_quantity === undefined
        ? null
        : safeNumber(payload.counted_quantity)
      : safeNumber(payload.quantity);
  const record = {
    id: payload.id || Date.now(),
    item_id: payload.item_id ?? null,
    quantity: payload.quantity === undefined ? numericQuantity : numericQuantity,
    counted_quantity: payload.counted_quantity ?? null,
    system_quantity: payload.system_quantity ?? null,
    variance_quantity:
      payload.counted_quantity !== undefined
        ? roundValue(safeNumber(payload.counted_quantity) - safeNumber(payload.system_quantity))
        : payload.variance_quantity ?? null,
    meal_type: normalizeMealType(payload.meal_type),
    date_time: payload.date_time || now,
    raw_input_text: payload.raw_input_text || null,
    notes: payload.notes || null,
    created_by: payload.created_by ?? null,
    entered_late: Boolean(payload.entered_late),
    conflict_flag: Boolean(payload.conflict_flag),
    sync_status: "pending",
  };

  const store = db.transaction([storeName, "sync_queue"], "readwrite");
  const existing = await store.objectStore(storeName).getAll();
  const conflict = existing.find((entry) => {
    const sameDate = String(entry.date_time || "").slice(0, 10) === String(record.date_time || "").slice(0, 10);
    return (
      entry.id !== record.id &&
      entry.item_id === record.item_id &&
      normalizeMealType(entry.meal_type) === normalizeMealType(record.meal_type) &&
      sameDate
    );
  });

  if (conflict) {
    record.conflict_flag = true;
    await store.objectStore(storeName).put({ ...conflict, conflict_flag: true });
  }

  await store.objectStore(storeName).put(record);
  await store.objectStore("sync_queue").put({
    id: `queue-${record.id}`,
    created_at: now,
    endpoint,
    store_name: storeName,
    payload: record,
    conflict_flag: record.conflict_flag,
    attempts: 0,
  });
  await store.done;

  return {
    warnings: createLocalWarnings(record),
    record,
  };
}

export async function flushSyncQueue() {
  const db = await openKitchenDb();
  const queueItems = await db.getAll("sync_queue");

  if (!navigator.onLine || !queueItems.length) {
    return { synced_count: 0, warnings: [] };
  }

  const warnings = [];
  let syncedCount = 0;

  for (const queueItem of queueItems.sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))) {
    try {
      const response = await fetch(`${getApiBaseUrl()}${queueItem.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...queueItem.payload,
          actor_role: normalizeRole(USERS.find((user) => user.id === queueItem.payload.created_by)?.role),
          conflict_flag: queueItem.conflict_flag,
        }),
      });
      const result = await response.json();
      warnings.push(...(result.warnings || []).map((warning) => warning.message || warning));
      const tx = db.transaction([queueItem.store_name, "sync_queue", "meta"], "readwrite");
      const latestRecord = await tx.objectStore(queueItem.store_name).get(queueItem.payload.id);
      if (latestRecord) {
        await tx.objectStore(queueItem.store_name).put({
          ...latestRecord,
          sync_status: "synced",
          conflict_flag: latestRecord.conflict_flag || queueItem.conflict_flag,
        });
      }
      await tx.objectStore("sync_queue").delete(queueItem.id);
      await tx.objectStore("meta").put({ id: "last_sync_at", value: new Date().toISOString() });
      await tx.done;
      syncedCount += 1;
    } catch (error) {
      const tx = db.transaction("sync_queue", "readwrite");
      await tx.objectStore("sync_queue").put({
        ...queueItem,
        attempts: safeNumber(queueItem.attempts) + 1,
        last_error: error.message,
      });
      await tx.done;
    }
  }

  return { synced_count: syncedCount, warnings };
}

export async function requestBackgroundSync() {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  if ("sync" in registration) {
    await registration.sync.register("kitchen-sync-queue");
  }
}
