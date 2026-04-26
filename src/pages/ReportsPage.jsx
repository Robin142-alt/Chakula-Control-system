import { useState } from "react";
import AlertList from "../components/AlertList.jsx";
import MetricCard from "../components/MetricCard.jsx";
import {
  buildAlertExportRows,
  buildCsv,
  buildDailySummaryExportRows,
  buildPrincipalBriefHtml,
  downloadTextFile,
  printHtmlDocument,
} from "../lib/export.js";
import { formatKes, formatMealLabel } from "../lib/format.js";

export default function ReportsPage({ summaries, alerts, reportInsights, settings }) {
  const [exportMessage, setExportMessage] = useState("");
  const highestCostDay = reportInsights?.highestCostDay;
  const highestWasteDay = reportInsights?.highestWasteDay;
  const highestCostPerStudentDay = reportInsights?.highestCostPerStudentDay;
  const latestSummary = reportInsights?.latestSummary || summaries[summaries.length - 1] || null;
  const watchlist = reportInsights?.mealWatchlist?.slice(0, 6) || [];
  const budgetRows = reportInsights?.budgetRows || [];
  const latestPlan = reportInsights?.latestPlan || [];
  const consumptionRows = reportInsights?.consumptionRows || [];
  const anomalyDecisions = reportInsights?.anomalyDecisions || [];
  const summaryDate = latestSummary?.date || "latest";

  const handleExportSummaries = () => {
    const rows = buildDailySummaryExportRows(summaries);
    const csv = buildCsv(
      [
        "date",
        "meal_type",
        "student_count",
        "total_cost_kes",
        "meal_cost_kes",
        "expected_cost_kes",
        "variance_kes",
        "waste_estimate_kes",
        "alert_count",
      ],
      rows,
    );
    downloadTextFile(`chakula-daily-summaries-${summaryDate}.csv`, csv, "text/csv;charset=utf-8");
    setExportMessage("Daily summary CSV downloaded for accountant follow-up.");
  };

  const handleExportAlerts = () => {
    const rows = buildAlertExportRows(alerts);
    const csv = buildCsv(
      [
        "date",
        "severity",
        "alert_type",
        "meal_type",
        "item_id",
        "title",
        "message",
        "issue_assessment",
        "action_hint",
      ],
      rows,
    );
    downloadTextFile(`chakula-alerts-${summaryDate}.csv`, csv, "text/csv;charset=utf-8");
    setExportMessage("Alerts CSV downloaded with likely issue labels.");
  };

  const handlePrintBrief = () => {
    const documentHtml = buildPrincipalBriefHtml({
      settings,
      summary: latestSummary,
      alerts,
    });
    const opened = printHtmlDocument(documentHtml);
    setExportMessage(
      opened
        ? "Principal brief opened for printing."
        : "Print window was blocked. Allow popups and try again.",
    );
  };

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--reports">
        <p className="eyebrow">Reports</p>
        <h2>Simple insights, not raw tables</h2>
        <p>
          Highest cost day: <strong>{highestCostDay?.date || "n/a"}</strong>
        </p>
      </div>

      <div className="metric-grid">
        <MetricCard label="Average Daily Cost" value={reportInsights?.averageDailyCost || 0} />
        <MetricCard label="Avg Cost per Student" value={reportInsights?.averageCostPerStudent || 0} accent="amber" />
        <MetricCard
          label="Possible Theft"
          value={reportInsights?.issueAssessmentCounts?.POSSIBLE_THEFT || 0}
          type="plain"
          accent="terracotta"
        />
        <MetricCard
          label="Waste Risks"
          value={reportInsights?.issueAssessmentCounts?.WASTE || 0}
          type="plain"
          accent="slate"
        />
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Exports and handoff</h3>
          <span>Offline-friendly</span>
        </div>
        <div className="action-grid">
          <button className="secondary-button" type="button" onClick={handleExportSummaries}>
            Export daily CSV
          </button>
          <button className="secondary-button" type="button" onClick={handleExportAlerts}>
            Export alerts CSV
          </button>
          <button className="primary-button primary-button--slate" type="button" onClick={handlePrintBrief}>
            Print principal brief
          </button>
        </div>
        {exportMessage && <p className="feedback-line">{exportMessage}</p>}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Budget tracking</h3>
          <span>Actual vs planned spend</span>
        </div>
        <div className="report-list">
          {budgetRows.map((row) => (
            <article key={row.date} className="report-card">
              <div className="report-card__topline">
                <strong>{row.date}</strong>
                <span>{row.status}</span>
              </div>
              <p>Actual: {formatKes(row.actual_kes)}</p>
              <p>Budget: {formatKes(row.budget_kes)}</p>
              <p>Variance: {formatKes(row.variance_kes)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Expected usage plan</h3>
          <span>{reportInsights?.latestSummary?.date || "Latest day"}</span>
        </div>
        <div className="report-list">
          {latestPlan.map((meal) => (
            <article key={meal.meal_type} className="report-card">
              <div className="report-card__topline">
                <strong>{formatMealLabel(meal.meal_type)}</strong>
                <span>{meal.student_count || 0} students</span>
              </div>
              <p>Expected cost: {formatKes(meal.expected_cost_kes)}</p>
              <p>Actual cost: {formatKes(meal.actual_cost_kes)}</p>
              <p>Variance: {formatKes(meal.variance_kes)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Consumption</h3>
          <span>Latest day by meal</span>
        </div>
        <div className="report-list">
          {consumptionRows.map((meal) => (
            <article key={meal.meal_type} className="report-card">
              <div className="report-card__topline">
                <strong>{formatMealLabel(meal.meal_type)}</strong>
                <span>{meal.leftover_percentage}% leftovers</span>
              </div>
              <p>Used: {meal.total_actual_quantity} units</p>
              <p>Expected: {meal.total_expected_quantity} units</p>
              <p>Leftovers: {meal.total_leftover_quantity} units</p>
              <p>
                Top item: {meal.top_item_name} ({meal.top_item_quantity} {meal.top_item_unit})
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Seven-day cost trend</h3>
          <span>Daily snapshot</span>
        </div>
        <div className="report-list">
          {summaries.map((summary) => (
            <article key={summary.date} className="report-card">
              <div className="report-card__topline">
                <strong>{summary.date}</strong>
                <span>{formatKes(summary.total_cost_kes)}</span>
              </div>
              <p>Students fed: {summary.student_count || 0}</p>
              <p>Cost per student: {formatKes(summary.cost_per_student_kes)}</p>
              <p>Expected total: {formatKes(summary.total_expected_cost_kes)}</p>
              <p>Variance: {formatKes(summary.total_cost_kes - summary.total_expected_cost_kes)}</p>
              <p>Waste estimate: {formatKes(summary.waste_estimate_kes)}</p>
              <div className="report-card__meals">
                {summary.meal_summaries.map((meal) => (
                  <span key={meal.meal_type}>
                    {formatMealLabel(meal.meal_type)} {formatKes(meal.cost_kes)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Anomaly decisions</h3>
          <span>Likely issue and next check</span>
        </div>
        <AlertList alerts={anomalyDecisions} emptyMessage="No anomaly decisions right now." />
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>What needs attention</h3>
          <span>Expected vs actual</span>
        </div>
        <div className="report-list">
          {watchlist.map((meal) => (
            <article key={`${meal.date}-${meal.meal_type}`} className="report-card">
              <div className="report-card__topline">
                <strong>
                  {meal.date} / {formatMealLabel(meal.meal_type)}
                </strong>
                <span>{formatKes(meal.variance_kes)}</span>
              </div>
              <p>Actual cost: {formatKes(meal.cost_kes)}</p>
              <p>Expected cost: {formatKes(meal.expected_cost_kes)}</p>
              <p>Waste estimate: {formatKes(meal.waste_estimate_kes)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Likely issue mix</h3>
          <span>School-friendly language</span>
        </div>
        <div className="report-list">
          <article className="report-card">
            <div className="report-card__topline">
              <strong>Possible theft</strong>
              <span>{reportInsights?.issueAssessmentCounts?.POSSIBLE_THEFT || 0}</span>
            </div>
            <p>Usually driven by serious stock mismatch after count.</p>
          </article>
          <article className="report-card">
            <div className="report-card__topline">
              <strong>Waste</strong>
              <span>{reportInsights?.issueAssessmentCounts?.WASTE || 0}</span>
            </div>
            <p>Usually driven by consumption above plan or unusual leftover cost.</p>
          </article>
          <article className="report-card">
            <div className="report-card__topline">
              <strong>Recording error</strong>
              <span>{reportInsights?.issueAssessmentCounts?.ERROR || 0}</span>
            </div>
            <p>Usually driven by missing leftovers, duplicate issues, or low consumption gaps.</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Weekly flags</h3>
          <span>Reality over theory</span>
        </div>
        <div className="report-list">
          <article className="report-card">
            <div className="report-card__topline">
              <strong>Highest waste day</strong>
              <span>{highestWasteDay?.date || "n/a"}</span>
            </div>
            <p>{formatKes(highestWasteDay?.waste_estimate_kes || 0)} estimated waste</p>
          </article>
          <article className="report-card">
            <div className="report-card__topline">
              <strong>Highest cost per student</strong>
              <span>{highestCostPerStudentDay?.date || "n/a"}</span>
            </div>
            <p>{formatKes(highestCostPerStudentDay?.cost_per_student_kes || 0)} per student</p>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Alert history</h3>
          <span>Most important first</span>
        </div>
        <AlertList alerts={alerts.slice(0, 8)} />
      </section>
    </section>
  );
}
