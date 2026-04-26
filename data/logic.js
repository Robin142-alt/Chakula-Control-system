const SEVERITY_RANK = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Nairobi",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatDateInNairobi(dateValue) {
  const parts = DATE_FORMATTER.formatToParts(dateValue);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

export function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function roundValue(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((safeNumber(value) + Number.EPSILON) * factor) / factor;
}

export function normalizeRole(role) {
  return String(role || "").trim().toUpperCase();
}

export function normalizeMealType(mealType) {
  return String(mealType || "").trim().toUpperCase() || null;
}

export function toDateKey(dateValue) {
  if (!dateValue) {
    return null;
  }

  if (dateValue instanceof Date) {
    return formatDateInNairobi(dateValue);
  }

  const rawValue = String(dateValue);
  if (/^\d{4}-\d{2}-\d{2}/.test(rawValue)) {
    return rawValue.slice(0, 10);
  }

  const parsed = new Date(rawValue);
  if (!Number.isNaN(parsed.getTime())) {
    return formatDateInNairobi(parsed);
  }

  return rawValue.slice(0, 10);
}

export function calculateConsumption(issuedQuantity, leftoverQuantity) {
  return roundValue(Math.max(safeNumber(issuedQuantity) - safeNumber(leftoverQuantity), 0));
}

export function calculateVariance(actualValue, expectedValue) {
  return roundValue(safeNumber(actualValue) - safeNumber(expectedValue));
}

export function calculateLeftoverPercentage(issuedQuantity, leftoverQuantity) {
  const issued = safeNumber(issuedQuantity);
  if (!issued) {
    return 0;
  }

  return roundValue((safeNumber(leftoverQuantity) / issued) * 100);
}

export function calculateCost(quantity, unitCost) {
  return roundValue(safeNumber(quantity) * safeNumber(unitCost));
}

function createMapById(records) {
  return new Map(records.map((record) => [record.id, record]));
}

function buildGroupedTotals(records, quantityField = "quantity") {
  const grouped = new Map();

  records.forEach((record) => {
    const key = [
      toDateKey(record.date_time || record.usage_date || record.count_date),
      normalizeMealType(record.meal_type) || "ALL",
      record.item_id ?? "unknown",
    ].join("|");

    grouped.set(key, safeNumber(grouped.get(key)) + safeNumber(record[quantityField]));
  });

  return grouped;
}

export function sortAlerts(alerts) {
  return [...alerts].sort((left, right) => {
    const leftSeverity = SEVERITY_RANK[left.severity] || 0;
    const rightSeverity = SEVERITY_RANK[right.severity] || 0;

    if (leftSeverity !== rightSeverity) {
      return rightSeverity - leftSeverity;
    }

    return safeNumber(new Date(right.date_time).getTime()) - safeNumber(new Date(left.date_time).getTime());
  });
}

export function dedupeAlerts(alerts) {
  const seen = new Set();
  return sortAlerts(alerts).filter((alert) => {
    const key = [
      alert.alert_type,
      alert.item_id ?? "none",
      alert.meal_type ?? "none",
      toDateKey(alert.date_time),
      alert.severity ?? "none",
    ].join("|");

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export function detectAnomaliesFromRecords({
  issues = [],
  issue_logs = [],
  leftovers = [],
  leftover_logs = [],
  stock_counts = [],
  expected_usage = [],
  inventory_items = [],
}) {
  const normalizedIssues = issues.length ? issues : issue_logs;
  const normalizedLeftovers = leftovers.length ? leftovers : leftover_logs;
  const alerts = [];
  const inventoryMap = createMapById(inventory_items);
  const duplicateGroups = new Map();
  const leftoverMeals = new Set(
    normalizedLeftovers.map((record) => `${toDateKey(record.date_time)}|${normalizeMealType(record.meal_type)}`),
  );
  const expectedTotals = buildGroupedTotals(expected_usage, "expected_quantity");
  const issueTotals = buildGroupedTotals(normalizedIssues, "quantity");
  const leftoverTotals = buildGroupedTotals(normalizedLeftovers, "quantity");

  normalizedIssues.forEach((record) => {
    const key = [
      toDateKey(record.date_time),
      normalizeMealType(record.meal_type),
      record.item_id ?? "unknown",
    ].join("|");

    const existing = duplicateGroups.get(key) || [];
    existing.push(record);
    duplicateGroups.set(key, existing);
  });

  duplicateGroups.forEach((records, key) => {
    if (records.length < 2) {
      return;
    }

    const [dateKey, mealType, itemId] = key.split("|");
    const item = inventoryMap.get(Number(itemId));
    alerts.push({
      alert_type: "duplicate_issue",
      severity: "HIGH",
      title: `${item?.name || "Item"} issued twice`,
      message: `${item?.name || "Item"} was issued ${records.length} times for ${mealType.toLowerCase()} on ${dateKey}.`,
      item_id: Number(itemId) || null,
      meal_type: mealType,
      date_time: records[records.length - 1].date_time,
      source_record_id: records[records.length - 1].id,
      source_record_type: "issue_logs",
    });
  });

  normalizedIssues.forEach((record) => {
    const mealKey = `${toDateKey(record.date_time)}|${normalizeMealType(record.meal_type)}`;
    if (leftoverMeals.has(mealKey)) {
      return;
    }

    if (alerts.some((alert) => alert.alert_type === "missing_leftover" && `${toDateKey(alert.date_time)}|${alert.meal_type}` === mealKey)) {
      return;
    }

    alerts.push({
      alert_type: "missing_leftover",
      severity: "MEDIUM",
      title: `No leftovers logged for ${record.meal_type?.toLowerCase()}`,
      message: `No leftovers were logged for ${record.meal_type?.toLowerCase()} on ${toDateKey(record.date_time)}.`,
      item_id: record.item_id ?? null,
      meal_type: normalizeMealType(record.meal_type),
      date_time: record.date_time,
      source_record_id: record.id,
      source_record_type: "issue_logs",
    });
  });

  stock_counts.forEach((record) => {
    const variance = safeNumber(record.variance_quantity);
    const systemQuantity = Math.abs(safeNumber(record.system_quantity));
    const variancePercent = systemQuantity ? Math.abs(variance) / systemQuantity : 0;

    if (Math.abs(variance) < 1) {
      return;
    }

    alerts.push({
      alert_type: "stock_mismatch",
      severity: Math.abs(variance) >= 5 || variancePercent >= 0.08 ? "HIGH" : "MEDIUM",
      title: `${inventoryMap.get(record.item_id)?.name || "Stock"} variance detected`,
      message: `Counted ${record.counted_quantity ?? 0} against system ${record.system_quantity ?? 0} for ${
        inventoryMap.get(record.item_id)?.name || "this item"
      }.`,
      item_id: record.item_id ?? null,
      meal_type: normalizeMealType(record.meal_type),
      date_time: record.date_time,
      source_record_id: record.id,
      source_record_type: "stock_counts",
    });
  });

  const dateMealPairs = new Set();
  normalizedIssues.forEach((record) => {
    dateMealPairs.add(`${toDateKey(record.date_time)}|${normalizeMealType(record.meal_type)}`);
  });

  dateMealPairs.forEach((pair) => {
    const [dateKey, mealType] = pair.split("|");
    const expectedCost = inventory_items.reduce((total, item) => {
      const key = [dateKey, mealType, item.id].join("|");
      return total + calculateCost(expectedTotals.get(key), item.unit_cost_kes);
    }, 0);
    const actualCost = inventory_items.reduce((total, item) => {
      const key = [dateKey, mealType, item.id].join("|");
      const issuedQuantity = issueTotals.get(key);
      const leftoverQuantity = leftoverTotals.get(key);
      return total + calculateCost(calculateConsumption(issuedQuantity, leftoverQuantity), item.unit_cost_kes);
    }, 0);

    if (!expectedCost) {
      return;
    }

    const ratio = actualCost / expectedCost;
    if (ratio > 1.18 || ratio < 0.82) {
      alerts.push({
        alert_type: "abnormal_consumption",
        severity: Math.abs(1 - ratio) > 0.2 ? "HIGH" : "LOW",
        title: `${mealType.toLowerCase()} consumption out of range`,
        message: `Actual cost was KES ${roundValue(actualCost)} against expected KES ${roundValue(expectedCost)} on ${dateKey}.`,
        item_id: null,
        meal_type: mealType,
        date_time: `${dateKey}T23:00:00+03:00`,
        source_record_id: null,
        source_record_type: "expected_usage",
      });
    }
  });

  return sortAlerts(alerts);
}

export function buildCostTrackingRows({
  issues = [],
  issue_logs = [],
  leftovers = [],
  leftover_logs = [],
  expected_usage = [],
  inventory_items = [],
}) {
  const normalizedIssues = issues.length ? issues : issue_logs;
  const normalizedLeftovers = leftovers.length ? leftovers : leftover_logs;
  const issueTotals = buildGroupedTotals(normalizedIssues, "quantity");
  const leftoverTotals = buildGroupedTotals(normalizedLeftovers, "quantity");
  const expectedTotals = buildGroupedTotals(expected_usage, "expected_quantity");
  const inventoryMap = createMapById(inventory_items);
  const keys = new Set([...issueTotals.keys(), ...expectedTotals.keys()]);
  let idCounter = 7001;

  return [...keys]
    .map((key) => {
      const [dateKey, mealType, itemId] = key.split("|");
      const numericItemId = Number(itemId);
      const item = inventoryMap.get(numericItemId);
      const issuedQuantity = issueTotals.get(key);
      const leftoverQuantity = leftoverTotals.get(key);
      const actualQuantity = calculateConsumption(issuedQuantity, leftoverQuantity);
      const expectedQuantity = safeNumber(expectedTotals.get(key));
      const unitCost = safeNumber(item?.unit_cost_kes);

      return {
        id: idCounter++,
        report_date: dateKey,
        date_time: `${dateKey}T23:15:00+03:00`,
        meal_type: mealType === "ALL" ? null : mealType,
        item_id: Number.isFinite(numericItemId) ? numericItemId : null,
        quantity_used: actualQuantity,
        unit_cost_kes: unitCost,
        total_cost_kes: calculateCost(actualQuantity, unitCost),
        budget_kes: calculateCost(expectedQuantity, unitCost),
        variance_kes: calculateVariance(
          calculateCost(actualQuantity, unitCost),
          calculateCost(expectedQuantity, unitCost),
        ),
        raw_input_text: "Derived from issue, leftover, and expected usage records",
        source: "system_generated",
        created_by: 5,
        entered_late: false,
        conflict_flag: false,
      };
    })
    .filter((row) => row.item_id);
}

export function buildDailySummaries({
  issues = [],
  issue_logs = [],
  leftovers = [],
  leftover_logs = [],
  expected_usage = [],
  student_counts = [],
  inventory_items = [],
  alerts = [],
}) {
  const normalizedIssues = issues.length ? issues : issue_logs;
  const normalizedLeftovers = leftovers.length ? leftovers : leftover_logs;
  const inventoryMap = createMapById(inventory_items);
  const issueTotals = buildGroupedTotals(normalizedIssues, "quantity");
  const leftoverTotals = buildGroupedTotals(normalizedLeftovers, "quantity");
  const expectedTotals = buildGroupedTotals(expected_usage, "expected_quantity");
  const studentMap = new Map(
    student_counts.map((record) => [toDateKey(record.count_date || record.date_time), safeNumber(record.student_count)]),
  );
  const dateKeys = new Set([
    ...normalizedIssues.map((record) => toDateKey(record.date_time)),
    ...expected_usage.map((record) => toDateKey(record.usage_date || record.date_time)),
    ...student_counts.map((record) => toDateKey(record.count_date || record.date_time)),
  ]);

  return [...dateKeys]
    .sort()
    .map((dateKey) => {
      const meal_summaries = ["BREAKFAST", "LUNCH", "DINNER"].map((mealType) => {
        const items = inventory_items.map((item) => {
          const key = [dateKey, mealType, item.id].join("|");
          const issued_quantity = safeNumber(issueTotals.get(key));
          const leftover_quantity = safeNumber(leftoverTotals.get(key));
          const expected_quantity = safeNumber(expectedTotals.get(key));
          const actual_quantity = calculateConsumption(issued_quantity, leftover_quantity);
          const actual_cost_kes = calculateCost(actual_quantity, item.unit_cost_kes);
          const expected_cost_kes = calculateCost(expected_quantity, item.unit_cost_kes);

          return {
            item_id: item.id,
            item_name: item.name,
            unit: item.unit,
            issued_quantity,
            leftover_quantity,
            actual_quantity,
            expected_quantity,
            leftover_percentage: calculateLeftoverPercentage(issued_quantity, leftover_quantity),
            actual_cost_kes,
            expected_cost_kes,
          };
        });

        const cost_kes = roundValue(items.reduce((total, item) => total + item.actual_cost_kes, 0));
        const expected_cost_kes = roundValue(items.reduce((total, item) => total + item.expected_cost_kes, 0));
        const waste_estimate_kes = roundValue(
          items.reduce((total, item) => total + calculateCost(item.leftover_quantity, inventoryMap.get(item.item_id)?.unit_cost_kes), 0),
        );

        return {
          meal_type: mealType,
          cost_kes,
          expected_cost_kes,
          variance_kes: calculateVariance(cost_kes, expected_cost_kes),
          waste_estimate_kes,
          items,
        };
      });

      const total_cost_kes = roundValue(meal_summaries.reduce((total, meal) => total + meal.cost_kes, 0));
      const waste_estimate_kes = roundValue(meal_summaries.reduce((total, meal) => total + meal.waste_estimate_kes, 0));
      const student_count = safeNumber(studentMap.get(dateKey));

      return {
        date: dateKey,
        student_count,
        total_cost_kes,
        total_expected_cost_kes: roundValue(
          meal_summaries.reduce((total, meal) => total + meal.expected_cost_kes, 0),
        ),
        cost_per_student_kes: student_count ? roundValue(total_cost_kes / student_count) : roundValue(total_cost_kes),
        waste_estimate_kes,
        meal_summaries,
        alerts: sortAlerts(alerts.filter((alert) => toDateKey(alert.date_time) === dateKey)),
      };
    });
}

export function buildPrincipalSnapshot(summary, alerts = summary?.alerts || []) {
  return {
    todays_cost_kes: summary?.total_cost_kes ?? 0,
    cost_per_student_kes: summary?.cost_per_student_kes ?? 0,
    alerts: sortAlerts(alerts).filter((alert) => alert.severity === "HIGH").slice(0, 3),
  };
}
