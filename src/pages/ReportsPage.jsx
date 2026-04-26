import AlertList from "../components/AlertList.jsx";
import { formatKes, formatMealLabel } from "../lib/format.js";

export default function ReportsPage({ summaries, alerts }) {
  const highestCostDay = [...summaries].sort((left, right) => right.total_cost_kes - left.total_cost_kes)[0];

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--reports">
        <p className="eyebrow">Reports</p>
        <h2>Simple insights, not raw tables</h2>
        <p>
          Highest cost day: <strong>{highestCostDay?.date || "n/a"}</strong>
        </p>
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
              <p>Cost per student: {formatKes(summary.cost_per_student_kes)}</p>
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
          <h3>Alert history</h3>
          <span>Most important first</span>
        </div>
        <AlertList alerts={alerts.slice(0, 8)} />
      </section>
    </section>
  );
}

