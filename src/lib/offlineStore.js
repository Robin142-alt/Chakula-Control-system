import { openDB } from "idb";
import { buildInventorySnapshot } from "../../data/derivedData.js";
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
} from "../../data/logic.js";
import { hashPinBrowser } from "./authClient.js";

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
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

  if (typeof window === "undefined" || !/^https?:\/\//i.test(configuredBaseUrl)) {
    return configuredBaseUrl;
  }

  try {
    const configuredUrl = new URL(configuredBaseUrl);
    const currentUrl = new URL(window.location.origin);
    const configuredIsLocal = ["localhost", "127.0.0.1"].includes(configuredUrl.hostname);
    const currentIsLocal = ["localhost", "127.0.0.1"].includes(currentUrl.hostname);

    if (configuredIsLocal && currentIsLocal && configuredUrl.port !== currentUrl.port) {
      return `${window.location.origin}/api`;
    }
  } catch {
    return configuredBaseUrl;
  }

  return configuredBaseUrl;
}

function sortByDateTime(records) {
  return [...records].sort((left, right) => String(left.date_time).localeCompare(String(right.date_time)));
}

function createLocalId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `local-${crypto.randomUUID()}`;
  }

  return `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createLocalWarnings(record, storeName) {
  const warnings = [];
  const isStudentCount = storeName === "student_counts";

  if (!isStudentCount && !record.item_id && !record.raw_input_text) {
    warnings.push("Item missing. Saved for later review.");
  }
  if (
    isStudentCount
      ? record.student_count === null || record.student_count === undefined || record.student_count === ""
      : record.quantity === null || record.quantity === undefined || record.quantity === ""
  ) {
    warnings.push(
      isStudentCount
        ? "Student count missing. Saved with 0 for calculations."
        : "Quantity missing. Saved with 0 for calculations.",
    );
  }
  if (!record.meal_type) {
    warnings.push("Meal type missing. Saved anyway.");
  }
  if (isStudentCount && safeNumber(record.student_count) > 3000) {
    warnings.push("Student count looks unusually high. Review when convenient.");
  }
  if (!isStudentCount && safeNumber(record.quantity) > 80) {
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
  await tx.objectStore("meta").put({ id: "current_session", value: null });

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

async function getUsersFromMeta(db) {
  const metaRows = await db.getAll("meta");
  return metaRows
    .filter((row) => String(row.id).startsWith("user:"))
    .map((row) => row.value)
    .sort((left, right) => Number(left.id) - Number(right.id));
}

async function getStoredUserById(db, userId) {
  const row = await db.get("meta", `user:${Number(userId)}`);
  return row?.value || null;
}

async function upsertStoredUser(db, user) {
  await db.put("meta", {
    id: `user:${Number(user.id)}`,
    value: user,
  });
}

function toPublicUser(user) {
  if (!user) {
    return null;
  }

  const { pin_hash, ...publicUser } = user;
  return publicUser;
}

export async function getStoredUsers() {
  await seedKitchenDb();
  const db = await openKitchenDb();
  return getUsersFromMeta(db);
}

export async function syncUsersFromApi() {
  await seedKitchenDb();
  if (!navigator.onLine) {
    return getStoredUsers();
  }

  const db = await openKitchenDb();
  const localUsers = await getUsersFromMeta(db);
  const localById = new Map(localUsers.map((user) => [Number(user.id), user]));

  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/users`);
    if (!response.ok) {
      return localUsers;
    }

    const body = await response.json();
    const tx = db.transaction("meta", "readwrite");
    for (const user of body.users || []) {
      const existing = localById.get(Number(user.id)) || {};
      await tx.objectStore("meta").put({
        id: `user:${Number(user.id)}`,
        value: {
          ...existing,
          ...user,
          pin_hash: existing.pin_hash || null,
        },
      });
    }
    await tx.done;
    return getUsersFromMeta(db);
  } catch {
    return localUsers;
  }
}

export async function getCurrentSession() {
  await seedKitchenDb();
  const db = await openKitchenDb();
  const stored = await db.get("meta", "current_session");
  return stored?.value || null;
}

async function persistSession(session) {
  const db = await openKitchenDb();
  const tx = db.transaction("meta", "readwrite");
  await tx.objectStore("meta").put({ id: "current_session", value: session });
  await tx.objectStore("meta").put({ id: "active_user_id", value: Number(session.user.id) });

  const existingUser = await tx.objectStore("meta").get(`user:${Number(session.user.id)}`);
  await tx.objectStore("meta").put({
    id: `user:${Number(session.user.id)}`,
    value: {
      ...(existingUser?.value || {}),
      ...session.user,
      pin_hash: session.pin_hash || existingUser?.value?.pin_hash || null,
      last_login_at: session.authenticated_at,
    },
  });
  await tx.done;
}

export async function clearCurrentSession() {
  const db = await openKitchenDb();
  await db.put("meta", { id: "current_session", value: null });
}

export async function loginWithPin({ userId, pin }) {
  await seedKitchenDb();
  const db = await openKitchenDb();
  const normalizedPin = String(pin || "").trim();
  const pinHash = await hashPinBrowser(normalizedPin);
  const localUser = await getStoredUserById(db, userId);
  const localMatch = Boolean(localUser?.pin_hash && localUser.pin_hash === pinHash);

  if (navigator.onLine) {
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: Number(userId),
          pin: normalizedPin,
        }),
      });
      const body = await response.json();

      if (response.ok && body.success) {
        const session = {
          ...body.session,
          pin_hash: pinHash,
          authenticated_at: new Date().toISOString(),
        };
        await persistSession(session);
        return {
          success: true,
          warnings: body.warnings || [],
          session,
        };
      }

      if (!localMatch) {
        return {
          success: false,
          warnings: body.warnings || [{ message: "User or PIN did not match." }],
        };
      }
    } catch {
      // fall through to offline proof login
    }
  }

  if (!localMatch) {
    return {
      success: false,
      warnings: [{ message: "This device cannot verify that PIN offline yet. Connect once and try again." }],
    };
  }

  const session = {
    user: toPublicUser(localUser),
    token: null,
    expires_at: null,
    auth_mode: "offline-proof",
    pin_hash: pinHash,
    authenticated_at: new Date().toISOString(),
  };
  await persistSession(session);

  return {
    success: true,
    warnings: [{ message: "Signed in with offline proof. Sync will use stored proof until a live token is refreshed." }],
    session,
  };
}

function buildAuthContext(session) {
  if (!session?.user?.id) {
    return null;
  }

  return {
    user_id: Number(session.user.id),
    role: normalizeRole(session.user.role),
    token: session.token || null,
    pin_proof: session.pin_hash || null,
    auth_mode: session.auth_mode || "offline-proof",
  };
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

async function savePreparedEntryLocally(db, { storeName, endpoint, payload, authContext }) {
  const now = new Date().toISOString();
  const localId = payload.id || createLocalId();
  const numericQuantity =
    payload.quantity === undefined
      ? payload.counted_quantity === undefined
        ? null
        : safeNumber(payload.counted_quantity)
      : safeNumber(payload.quantity);
  const record = {
    id: localId,
    item_id: payload.item_id ?? null,
    quantity: payload.quantity === undefined ? numericQuantity : numericQuantity,
    student_count: payload.student_count ?? null,
    count_date: payload.count_date ?? null,
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
    auth_context: authContext,
    conflict_flag: record.conflict_flag,
    attempts: 0,
  });
  await store.done;

  return {
    warnings: createLocalWarnings(record, storeName),
    record,
  };
}

export async function saveEntryLocally(storeName, endpoint, payload, session) {
  if (!session?.user?.id) {
    throw new Error("A signed-in user is required before saving.");
  }

  const db = await openKitchenDb();
  return savePreparedEntryLocally(db, {
    storeName,
    endpoint,
    payload: {
      ...payload,
      created_by: payload.created_by ?? session.user.id,
    },
    authContext: buildAuthContext(session),
  });
}

export async function saveEntriesLocally(entries, session) {
  if (!session?.user?.id) {
    throw new Error("A signed-in user is required before importing.");
  }

  const results = [];
  const db = await openKitchenDb();
  for (const entry of entries) {
    const result = await savePreparedEntryLocally(db, {
      storeName: entry.storeName,
      endpoint: entry.endpoint,
      payload: {
        ...entry.payload,
        created_by: entry.payload.created_by ?? session.user.id,
      },
      authContext: buildAuthContext(session),
    });
    results.push(result);
  }

  return results;
}

export async function flushSyncQueue() {
  const db = await openKitchenDb();
  const queueItems = await db.getAll("sync_queue");
  const currentSession = await getCurrentSession();

  if (!navigator.onLine || !queueItems.length) {
    return { synced_count: 0, warnings: [] };
  }

  const warnings = [];
  let syncedCount = 0;

  for (const queueItem of queueItems.sort((left, right) => String(left.created_at).localeCompare(String(right.created_at)))) {
    try {
      const authContext = queueItem.auth_context || buildAuthContext(currentSession);
      const authHeaders = authContext?.token
        ? {
            Authorization: `Bearer ${authContext.token}`,
          }
        : {};
      const response = await fetch(`${getApiBaseUrl()}${queueItem.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({
          ...queueItem.payload,
          auth_context: authContext,
          conflict_flag: queueItem.conflict_flag,
        }),
      });
      const result = await response.json();
      warnings.push(...(result.warnings || []).map((warning) => warning.message || warning));
      if (!response.ok || (result.saved === false && result.retry_later)) {
        const tx = db.transaction("sync_queue", "readwrite");
        await tx.objectStore("sync_queue").put({
          ...queueItem,
          attempts: safeNumber(queueItem.attempts) + 1,
          last_error: result.warnings?.[0]?.message || `HTTP ${response.status}`,
        });
        await tx.done;
        continue;
      }

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
