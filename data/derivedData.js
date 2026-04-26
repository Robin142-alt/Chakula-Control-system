import { DEMO_DATA } from "./demoData.js";
import { roundValue, safeNumber, toDateKey } from "./logic.js";

export function buildInventorySnapshot({
  inventory_items = [],
  issue_logs = [],
  stock_counts = [],
}) {
  const latestCounts = new Map();

  [...stock_counts]
    .sort((left, right) => String(left.date_time).localeCompare(String(right.date_time)))
    .forEach((count) => {
      latestCounts.set(count.item_id, count);
    });

  return inventory_items.map((item) => {
    const latestCount = latestCounts.get(item.id);
    const issuesAfterCount = issue_logs
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

export function filterRecordsByDateRange(records = [], startDate, endDate) {
  return records.filter((record) => {
    const dateKey = toDateKey(record.date_time || record.usage_date || record.count_date);
    if (!dateKey) {
      return false;
    }

    if (startDate && dateKey < startDate) {
      return false;
    }

    if (endDate && dateKey > endDate) {
      return false;
    }

    return true;
  });
}

export function getDemoDataset(startDate, endDate) {
  const inventorySnapshot = buildInventorySnapshot(DEMO_DATA);
  return {
    inventory_items: inventorySnapshot,
    issue_logs: filterRecordsByDateRange(DEMO_DATA.issue_logs, startDate, endDate),
    leftover_logs: filterRecordsByDateRange(DEMO_DATA.leftover_logs, startDate, endDate),
    stock_counts: filterRecordsByDateRange(DEMO_DATA.stock_counts, startDate, endDate),
    expected_usage: filterRecordsByDateRange(DEMO_DATA.expected_usage, startDate, endDate),
    student_counts: filterRecordsByDateRange(DEMO_DATA.student_counts, startDate, endDate),
    alerts: [],
  };
}

function buildUserMap(users = DEMO_DATA.users) {
  return new Map(users.map((user) => [Number(user.id), user]));
}

function findItemName(itemMap, record) {
  return (
    record.item_name_snapshot ||
    itemMap.get(Number(record.item_id))?.name ||
    "Unknown item"
  );
}

function buildActivityRecord({
  id,
  date_time,
  action_type,
  actor_user_id,
  actor_role,
  actor_name,
  target_table,
  status,
  summary,
  detail,
  entered_late = false,
  conflict_flag = false,
}) {
  return {
    id,
    date_time,
    action_type,
    actor_user_id,
    actor_role,
    actor_name,
    target_table,
    status,
    summary,
    detail,
    entered_late: Boolean(entered_late),
    conflict_flag: Boolean(conflict_flag),
  };
}

export function buildActivityFeed({
  issue_logs = [],
  leftover_logs = [],
  stock_counts = [],
  student_counts = [],
  alerts = [],
  inventory_items = [],
  users = DEMO_DATA.users,
}) {
  const userMap = buildUserMap(users);
  const itemMap = new Map(inventory_items.map((item) => [Number(item.id), item]));
  const records = [];

  issue_logs.forEach((record) => {
    const actor = userMap.get(Number(record.created_by));
    const itemName = findItemName(itemMap, record);
    records.push(buildActivityRecord({
      id: `issue-${record.id}`,
      date_time: record.date_time,
      action_type: "ISSUE_STOCK",
      actor_user_id: record.created_by ?? null,
      actor_role: actor?.role || "STOREKEEPER",
      actor_name: actor?.display_name || "Storekeeper",
      target_table: "issue_logs",
      status: record.sync_status || "saved",
      summary: `Issued ${safeNumber(record.quantity)} ${record.unit || "units"} of ${itemName}.`,
      detail: `${record.meal_type || "Meal"} issue on ${toDateKey(record.date_time)}.`,
      entered_late: record.entered_late,
      conflict_flag: record.conflict_flag,
    }));
  });

  leftover_logs.forEach((record) => {
    const actor = userMap.get(Number(record.created_by));
    const itemName = findItemName(itemMap, record);
    records.push(buildActivityRecord({
      id: `leftover-${record.id}`,
      date_time: record.date_time,
      action_type: "LOG_LEFTOVER",
      actor_user_id: record.created_by ?? null,
      actor_role: actor?.role || "COOK",
      actor_name: actor?.display_name || "Cook",
      target_table: "leftover_logs",
      status: record.sync_status || "saved",
      summary: `Logged ${safeNumber(record.quantity)} ${record.unit || "units"} leftover for ${itemName}.`,
      detail: `${record.meal_type || "Meal"} leftover on ${toDateKey(record.date_time)}.`,
      entered_late: record.entered_late,
      conflict_flag: record.conflict_flag,
    }));
  });

  stock_counts.forEach((record) => {
    const actor = userMap.get(Number(record.created_by));
    const itemName = findItemName(itemMap, record);
    records.push(buildActivityRecord({
      id: `count-${record.id}`,
      date_time: record.date_time,
      action_type: "STOCK_COUNT",
      actor_user_id: record.created_by ?? null,
      actor_role: actor?.role || "STOREKEEPER",
      actor_name: actor?.display_name || "Storekeeper",
      target_table: "stock_counts",
      status: record.sync_status || "saved",
      summary: `Counted ${itemName} at ${safeNumber(record.counted_quantity)} ${record.unit || "units"}.`,
      detail: `System was ${safeNumber(record.system_quantity)} ${record.unit || "units"}. Variance ${safeNumber(record.variance_quantity)}.`,
      entered_late: record.entered_late,
      conflict_flag: record.conflict_flag,
    }));
  });

  student_counts.forEach((record) => {
    const actor = userMap.get(Number(record.created_by));
    records.push(buildActivityRecord({
      id: `students-${record.id}`,
      date_time: record.date_time,
      action_type: "STUDENT_COUNT",
      actor_user_id: record.created_by ?? null,
      actor_role: actor?.role || "STOREKEEPER",
      actor_name: actor?.display_name || "Storekeeper",
      target_table: "student_counts",
      status: record.sync_status || "saved",
      summary: `Student count recorded at ${safeNumber(record.student_count)}.`,
      detail: `${record.meal_type || "ALL"} count for ${record.count_date || toDateKey(record.date_time)}.`,
      entered_late: record.entered_late,
      conflict_flag: record.conflict_flag,
    }));
  });

  alerts.forEach((record) => {
    records.push(buildActivityRecord({
      id: `alert-${record.id}`,
      date_time: record.date_time,
      action_type: "SYSTEM_ALERT",
      actor_user_id: null,
      actor_role: "SYSTEM",
      actor_name: "System",
      target_table: "alerts",
      status: record.severity || "OPEN",
      summary: record.title,
      detail: record.message,
      entered_late: record.entered_late,
      conflict_flag: record.conflict_flag,
    }));
  });

  return records.sort((left, right) => String(right.date_time).localeCompare(String(left.date_time)));
}

export function buildReportInsights(summaries = [], alerts = []) {
  const highestCostDay = [...summaries].sort((left, right) => safeNumber(right.total_cost_kes) - safeNumber(left.total_cost_kes))[0] || null;
  const highestWasteDay = [...summaries].sort((left, right) => safeNumber(right.waste_estimate_kes) - safeNumber(left.waste_estimate_kes))[0] || null;
  const highestCostPerStudentDay = [...summaries].sort(
    (left, right) => safeNumber(right.cost_per_student_kes) - safeNumber(left.cost_per_student_kes),
  )[0] || null;
  const latestSummary = summaries[summaries.length - 1] || null;

  const mealWatchlist = summaries
    .flatMap((summary) =>
      summary.meal_summaries.map((meal) => ({
        date: summary.date,
        student_count: summary.student_count,
        meal_type: meal.meal_type,
        cost_kes: meal.cost_kes,
        expected_cost_kes: meal.expected_cost_kes,
        variance_kes: meal.variance_kes,
        waste_estimate_kes: meal.waste_estimate_kes,
      })),
    )
    .sort((left, right) => Math.abs(safeNumber(right.variance_kes)) - Math.abs(safeNumber(left.variance_kes)));

  const averageDailyCost = summaries.length
    ? roundValue(
        summaries.reduce((total, summary) => total + safeNumber(summary.total_cost_kes), 0) / summaries.length,
      )
    : 0;
  const averageCostPerStudent = summaries.length
    ? roundValue(
        summaries.reduce((total, summary) => total + safeNumber(summary.cost_per_student_kes), 0) / summaries.length,
      )
    : 0;
  const budgetRows = summaries.map((summary) => {
    const variance_kes = roundValue(safeNumber(summary.total_cost_kes) - safeNumber(summary.total_expected_cost_kes));
    return {
      date: summary.date,
      actual_kes: summary.total_cost_kes,
      budget_kes: summary.total_expected_cost_kes,
      variance_kes,
      status:
        variance_kes > 200 ? "Over budget" : variance_kes < -200 ? "Under plan" : "Near plan",
    };
  });
  const latestPlan = latestSummary
    ? latestSummary.meal_summaries.map((meal) => ({
        date: latestSummary.date,
        student_count: latestSummary.student_count,
        meal_type: meal.meal_type,
        expected_cost_kes: meal.expected_cost_kes,
        actual_cost_kes: meal.cost_kes,
        variance_kes: meal.variance_kes,
      }))
    : [];
  const consumptionRows = latestSummary
    ? latestSummary.meal_summaries.map((meal) => {
        const total_issued_quantity = roundValue(
          meal.items.reduce((total, item) => total + safeNumber(item.issued_quantity), 0),
        );
        const total_actual_quantity = roundValue(
          meal.items.reduce((total, item) => total + safeNumber(item.actual_quantity), 0),
        );
        const total_expected_quantity = roundValue(
          meal.items.reduce((total, item) => total + safeNumber(item.expected_quantity), 0),
        );
        const total_leftover_quantity = roundValue(
          meal.items.reduce((total, item) => total + safeNumber(item.leftover_quantity), 0),
        );
        const topItem = [...meal.items].sort(
          (left, right) => safeNumber(right.actual_quantity) - safeNumber(left.actual_quantity),
        )[0] || null;

        return {
          date: latestSummary.date,
          meal_type: meal.meal_type,
          total_issued_quantity,
          total_actual_quantity,
          total_expected_quantity,
          total_leftover_quantity,
          leftover_percentage: total_issued_quantity
            ? roundValue((total_leftover_quantity / total_issued_quantity) * 100)
            : 0,
          top_item_name: topItem?.item_name || "No item",
          top_item_quantity: topItem?.actual_quantity || 0,
          top_item_unit: topItem?.unit || "units",
        };
      })
    : [];
  const issueAssessmentCounts = alerts.reduce((counts, alert) => {
    const key = alert.issue_assessment || "ERROR";
    return {
      ...counts,
      [key]: safeNumber(counts[key]) + 1,
    };
  }, {
    WASTE: 0,
    ERROR: 0,
    POSSIBLE_THEFT: 0,
  });

  return {
    highestCostDay,
    highestWasteDay,
    highestCostPerStudentDay,
    latestSummary,
    averageDailyCost,
    averageCostPerStudent,
    budgetRows,
    latestPlan,
    consumptionRows,
    mealWatchlist,
    highAlertCount: alerts.filter((alert) => alert.severity === "HIGH").length,
    missingLeftoverCount: alerts.filter((alert) => alert.alert_type === "missing_leftover").length,
    issueAssessmentCounts,
    anomalyDecisions: alerts.slice(0, 6),
  };
}
