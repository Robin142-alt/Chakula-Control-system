import MetricCard from "../components/MetricCard.jsx";
import AlertList from "../components/AlertList.jsx";
import { formatKes, formatMealLabel } from "../lib/format.js";

export default function DashboardPage({
  activeUser,
  latestSummary,
  principalSnapshot,
  alerts,
  queueCount,
  onNavigate,
}) {
  if (!latestSummary) {
    return <p className="empty-state">Loading the local kitchen records...</p>;
  }

  if (activeUser.role === "PRINCIPAL") {
    return (
      <section className="page-grid">
        <div className="hero-card">
          <p className="eyebrow">Principal view</p>
          <h2>Today at a glance</h2>
          <p>Only the essentials are shown here.</p>
        </div>
        <div className="metric-grid">
          <MetricCard label="Today's Cost" value={principalSnapshot.todays_cost_kes} />
          <MetricCard label="Cost per Student" value={principalSnapshot.cost_per_student_kes} accent="amber" />
        </div>
        <section className="panel">
          <div className="panel__header">
            <h3>Top alerts</h3>
            <span>{principalSnapshot.alerts.length} shown</span>
          </div>
          <AlertList alerts={principalSnapshot.alerts} emptyMessage="No high alerts today." />
        </section>
      </section>
    );
  }

  return (
    <section className="page-grid">
      <div className="hero-card">
        <p className="eyebrow">{activeUser.role.toLowerCase()}</p>
        <h2>Kitchen control for shared devices</h2>
        <p>
          Local queue: <strong>{queueCount}</strong> pending sync item{queueCount === 1 ? "" : "s"}.
        </p>
      </div>

      <div className="metric-grid">
        <MetricCard label="Today's Cost" value={latestSummary.total_cost_kes} />
        <MetricCard label="Cost per Student" value={latestSummary.cost_per_student_kes} accent="amber" />
        <MetricCard label="Waste Estimate" value={latestSummary.waste_estimate_kes} accent="terracotta" />
        <MetricCard label="Open Alerts" value={alerts.length} type="plain" accent="slate" />
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Quick actions</h3>
          <span>One screen, minimal typing</span>
        </div>
        <div className="quick-action-grid">
          {activeUser.role === "STOREKEEPER" && (
            <>
              <button className="quick-action" type="button" onClick={() => onNavigate("issue-stock")}>
                Issue stock
              </button>
              <button className="quick-action" type="button" onClick={() => onNavigate("student-count")}>
                Student count
              </button>
              <button className="quick-action" type="button" onClick={() => onNavigate("stock-count")}>
                Stock count
              </button>
              <button className="quick-action quick-action--secondary" type="button" onClick={() => onNavigate("backfill-import")}>
                Backfill CSV
              </button>
              <button className="quick-action quick-action--secondary" type="button" onClick={() => onNavigate("sync-center")}>
                Sync center
              </button>
            </>
          )}
          {activeUser.role === "COOK" && (
            <>
              <button className="quick-action" type="button" onClick={() => onNavigate("log-leftovers")}>
                Log leftovers
              </button>
              <button className="quick-action quick-action--secondary" type="button" onClick={() => onNavigate("backfill-import")}>
                Backfill CSV
              </button>
              <button className="quick-action quick-action--secondary" type="button" onClick={() => onNavigate("sync-center")}>
                Sync center
              </button>
            </>
          )}
          {activeUser.role === "ADMIN" && (
            <>
              <button className="quick-action" type="button" onClick={() => onNavigate("audit-log")}>
                Audit trail
              </button>
              <button className="quick-action quick-action--secondary" type="button" onClick={() => onNavigate("settings")}>
                Device settings
              </button>
              <button className="quick-action quick-action--secondary" type="button" onClick={() => onNavigate("sync-center")}>
                Sync center
              </button>
            </>
          )}
          <button className="quick-action quick-action--secondary" type="button" onClick={() => onNavigate("reports")}>
            View reports
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Meal costs</h3>
          <span>{latestSummary.date}</span>
        </div>
        <div className="meal-grid">
          {latestSummary.meal_summaries.map((meal) => (
            <article key={meal.meal_type} className="meal-card">
              <div>
                <p className="eyebrow">{formatMealLabel(meal.meal_type)}</p>
                <strong>{formatKes(meal.cost_kes)}</strong>
              </div>
              <p>Expected {formatKes(meal.expected_cost_kes)}</p>
              <p>Variance {formatKes(meal.variance_kes)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Priority alerts</h3>
          <span>Most recent first</span>
        </div>
        <AlertList alerts={alerts.slice(0, 5)} />
      </section>
    </section>
  );
}
