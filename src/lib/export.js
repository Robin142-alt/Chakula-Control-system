import { formatKes, formatMealLabel } from "./format.js";

function escapeCsvValue(value) {
  const normalized = value === null || value === undefined ? "" : String(value);
  if (!/[",\n]/.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildCsv(headers, rows) {
  const normalizedHeaders = headers.map((header) => String(header));
  const lines = [
    normalizedHeaders.map(escapeCsvValue).join(","),
    ...rows.map((row) => normalizedHeaders.map((header) => escapeCsvValue(row?.[header])).join(",")),
  ];
  return lines.join("\n");
}

export function buildDailySummaryExportRows(summaries = []) {
  return summaries.flatMap((summary) =>
    summary.meal_summaries.map((meal) => ({
      date: summary.date,
      meal_type: meal.meal_type,
      student_count: summary.student_count ?? 0,
      total_cost_kes: summary.total_cost_kes ?? 0,
      meal_cost_kes: meal.cost_kes ?? 0,
      expected_cost_kes: meal.expected_cost_kes ?? 0,
      variance_kes: meal.variance_kes ?? 0,
      waste_estimate_kes: meal.waste_estimate_kes ?? 0,
      alert_count: summary.alerts?.length ?? 0,
    })),
  );
}

export function buildAlertExportRows(alerts = []) {
  return alerts.map((alert) => ({
    date: String(alert.date_time || "").slice(0, 10),
    severity: alert.severity || "",
    alert_type: alert.alert_type || "",
    meal_type: alert.meal_type || "",
    item_id: alert.item_id ?? "",
    title: alert.title || "",
    message: alert.message || "",
    issue_assessment: alert.issue_assessment || "",
    action_hint: alert.action_hint || "",
  }));
}

export function downloadTextFile(filename, text, mimeType = "text/plain;charset=utf-8") {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }

  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export function buildPrincipalBriefHtml({ settings, summary, alerts = [], generatedAt = new Date().toISOString() }) {
  const topAlerts = alerts
    .filter((alert) => String(alert.severity).toUpperCase() === "HIGH")
    .slice(0, 3);
  const mealRows = summary?.meal_summaries || [];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(settings?.school_name || "School")} Principal Brief</title>
    <style>
      body {
        font-family: "Segoe UI", Arial, sans-serif;
        margin: 24px;
        color: #1d2a24;
      }
      h1, h2, h3, p {
        margin: 0 0 12px;
      }
      .muted {
        color: #5d6b64;
      }
      .card {
        border: 1px solid #d8ddd6;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .metric {
        background: #f8f4ea;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 8px;
      }
      th, td {
        border-bottom: 1px solid #e6ebe4;
        padding: 8px 6px;
        text-align: left;
        font-size: 14px;
      }
      ul {
        padding-left: 18px;
        margin: 8px 0 0;
      }
      li {
        margin-bottom: 8px;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(settings?.school_name || "Demo Boarding School")}</h1>
    <p class="muted">${escapeHtml(settings?.kitchen_name || "Main Kitchen")} daily principal brief</p>
    <p class="muted">Generated ${escapeHtml(String(generatedAt).replace("T", " ").slice(0, 16))}</p>

    <div class="grid">
      <section class="card metric">
        <h2>Today's cost</h2>
        <p>${escapeHtml(formatKes(summary?.total_cost_kes || 0))}</p>
      </section>
      <section class="card metric">
        <h2>Cost per student</h2>
        <p>${escapeHtml(formatKes(summary?.cost_per_student_kes || 0))}</p>
      </section>
    </div>

    <section class="card">
      <h2>Meal costs</h2>
      <table>
        <thead>
          <tr>
            <th>Meal</th>
            <th>Actual</th>
            <th>Expected</th>
            <th>Variance</th>
          </tr>
        </thead>
        <tbody>
          ${mealRows
            .map(
              (meal) => `<tr>
            <td>${escapeHtml(formatMealLabel(meal.meal_type))}</td>
            <td>${escapeHtml(formatKes(meal.cost_kes || 0))}</td>
            <td>${escapeHtml(formatKes(meal.expected_cost_kes || 0))}</td>
            <td>${escapeHtml(formatKes(meal.variance_kes || 0))}</td>
          </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </section>

    <section class="card">
      <h2>Top alerts</h2>
      ${
        topAlerts.length
          ? `<ul>${topAlerts
              .map(
                (alert) => `<li><strong>${escapeHtml(alert.title)}</strong><br />${escapeHtml(alert.message)}</li>`,
              )
              .join("")}</ul>`
          : "<p>No high alerts today.</p>"
      }
    </section>

    <section class="card">
      <h3>Prepared by</h3>
      <p>${escapeHtml(settings?.alert_contact || "Kitchen admin")}</p>
    </section>
  </body>
</html>`;
}

export function printHtmlDocument(html) {
  if (typeof window === "undefined") {
    return false;
  }

  const printWindow = window.open("", "_blank", "noopener,noreferrer");
  if (!printWindow) {
    return false;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => {
    printWindow.print();
  }, 250);
  return true;
}
