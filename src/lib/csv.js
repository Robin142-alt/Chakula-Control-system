import { fromDateTimeInputValue } from "./format.js";

export const BACKFILL_TEMPLATE = `entry_type,item_name,quantity,meal_type,date_time,raw_input_text,notes
issue,Beans,17,LUNCH,2026-04-27T10:55,2 debes beans from paper bin card,Backfilled from paper
leftover,Beans,1.5,LUNCH,2026-04-27T14:20,small sufuria remained,Backfilled after service
stock_count,Beans,118,,2026-04-27T18:35,beans sacks lighter than bin card,Friday count
student_count,,162,ALL,2026-04-27T05:50,162 students on roll call,Morning boarding count`;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

export function parseCsvText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return { headers: [], rows: [], warnings: [] };
  }

  const lines = trimmed
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length);

  if (lines.length < 2) {
    return {
      headers: [],
      rows: [],
      warnings: ["Add a header row and at least one data row."],
    };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const rows = lines.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const record = { __row: rowIndex + 2 };
    headers.forEach((header, index) => {
      record[header] = values[index] ?? "";
    });
    record.__raw = line;
    return record;
  });

  return { headers, rows, warnings: [] };
}

function normalizeEntryType(value) {
  const normalized = String(value || "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const aliases = {
    issue_stock: "issue",
    issue_log: "issue",
    issues: "issue",
    leftovers: "leftover",
    leftover_log: "leftover",
    stockcount: "stock_count",
    count: "stock_count",
    studentcount: "student_count",
    students: "student_count",
  };

  return aliases[normalized] || normalized;
}

function normalizeBoolean(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return ["true", "1", "yes", "y"].includes(normalized);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function resolveItemId(rawRow, inventoryById, inventoryByName) {
  const directId = normalizeNumber(rawRow.item_id);
  if (directId && inventoryById.has(directId)) {
    return directId;
  }

  const byName = inventoryByName.get(String(rawRow.item_name || rawRow.item || "").trim().toLowerCase());
  return byName?.id || null;
}

function buildSharedPayload(rawRow, itemId, activeUser) {
  const rawDate = rawRow.date_time || rawRow.timestamp || rawRow.date || "";
  return {
    item_id: itemId,
    meal_type: String(rawRow.meal_type || rawRow.meal || "").trim().toUpperCase() || null,
    date_time: rawDate ? fromDateTimeInputValue(rawDate) : new Date().toISOString(),
    raw_input_text: rawRow.raw_input_text || rawRow.paper_note || rawRow.__raw || null,
    notes: rawRow.notes || rawRow.note || rawRow.comment || null,
    entered_late: normalizeBoolean(rawRow.entered_late, true),
    conflict_flag: normalizeBoolean(rawRow.conflict_flag, false),
    created_by: activeUser.id,
  };
}

export function normalizeBackfillRows(rows, { inventoryItems, activeUser }) {
  const inventoryById = new Map(inventoryItems.map((item) => [Number(item.id), item]));
  const inventoryByName = new Map(
    inventoryItems.map((item) => [String(item.name).trim().toLowerCase(), item]),
  );
  const entries = [];
  const warnings = [];
  const counts = {
    issue: 0,
    leftover: 0,
    stock_count: 0,
    student_count: 0,
  };
  const allowedByRole = {
    STOREKEEPER: new Set(["issue", "stock_count", "student_count"]),
    COOK: new Set(["leftover"]),
  };

  rows.forEach((rawRow) => {
    const entryType = normalizeEntryType(rawRow.entry_type);
    const allowedTypes = allowedByRole[activeUser.role] || new Set();
    if (!allowedTypes.has(entryType)) {
      warnings.push(`Row ${rawRow.__row}: ${entryType || "unknown"} is not allowed for ${activeUser.role.toLowerCase()}.`);
      return;
    }

    const itemId = resolveItemId(rawRow, inventoryById, inventoryByName);
    const sharedPayload = buildSharedPayload(rawRow, itemId, activeUser);

    if (entryType === "issue") {
      entries.push({
        storeName: "issue_logs",
        endpoint: "/issue-stock",
        payload: {
          ...sharedPayload,
          quantity: normalizeNumber(rawRow.quantity),
        },
      });
      counts.issue += 1;
      return;
    }

    if (entryType === "leftover") {
      entries.push({
        storeName: "leftover_logs",
        endpoint: "/log-leftover",
        payload: {
          ...sharedPayload,
          quantity: normalizeNumber(rawRow.quantity),
        },
      });
      counts.leftover += 1;
      return;
    }

    if (entryType === "stock_count") {
      entries.push({
        storeName: "stock_counts",
        endpoint: "/stock-count",
        payload: {
          ...sharedPayload,
          counted_quantity: normalizeNumber(rawRow.counted_quantity ?? rawRow.quantity),
          system_quantity: normalizeNumber(rawRow.system_quantity),
        },
      });
      counts.stock_count += 1;
      return;
    }

    if (entryType === "student_count") {
      entries.push({
        storeName: "student_counts",
        endpoint: "/student-count",
        payload: {
          ...sharedPayload,
          count_date: String(rawRow.count_date || "").trim() || sharedPayload.date_time.slice(0, 10),
          student_count: normalizeNumber(rawRow.student_count ?? rawRow.quantity),
          meal_type: sharedPayload.meal_type || "ALL",
        },
      });
      counts.student_count += 1;
      return;
    }

    warnings.push(`Row ${rawRow.__row}: unsupported entry_type "${rawRow.entry_type || ""}".`);
  });

  return {
    entries,
    warnings,
    counts,
  };
}

