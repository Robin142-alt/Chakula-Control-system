import AlertList from "../components/AlertList.jsx";
import MetricCard from "../components/MetricCard.jsx";
import { formatKes, formatMealLabel } from "../lib/format.js";

export default function ReportsPage({ summaries, alerts, reportInsights }) {
  const highestCostDay = reportInsights?.highestCostDay;
  const highestWasteDay = reportInsights?.highestWasteDay;
  const highestCostPerStudentDay = reportInsights?.highestCostPerStudentDay;
  const watchlist = reportInsights?.mealWatchlist?.slice(0, 6) || [];

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
        <MetricCard label="High Alerts" value={reportInsights?.highAlertCount || 0} type="plain" accent="terracotta" />
        <MetricCard label="Missing Leftovers" value={reportInsights?.missingLeftoverCount || 0} type="plain" accent="slate" />
      </div>

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
          <h3>What needs attention</h3>
          <span>Expected vs actual</span>
        </div>
        <div className="report-list">
          {watchlist.map((meal) => (
            <article key={`${meal.date}-${meal.meal_type}`} className="report-card">
              <div className="report-card__topline">
                <strong>
                  {meal.date} • {formatMealLabel(meal.meal_type)}
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
