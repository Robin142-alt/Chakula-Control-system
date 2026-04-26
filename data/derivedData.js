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

