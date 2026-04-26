import MetricCard from "../components/MetricCard.jsx";

export default function AuditLogPage({ activeUser, activityFeed, queueCount }) {
  if (activeUser.role !== "ADMIN") {
    return <p className="empty-state">Only Admin can view the audit trail from this screen.</p>;
  }

  const conflictCount = activityFeed.filter((record) => record.conflict_flag).length;
  const lateEntryCount = activityFeed.filter((record) => record.entered_late).length;

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--inventory">
        <p className="eyebrow">Audit trail</p>
        <h2>See who captured what, and when</h2>
        <p>Nothing disappears. Late entries, conflicts, and system alerts all remain visible for review.</p>
      </div>

      <div className="metric-grid">
        <MetricCard label="Recent records" value={activityFeed.length} type="plain" accent="slate" />
        <MetricCard label="Pending sync" value={queueCount} type="plain" accent="amber" />
        <MetricCard label="Late entries" value={lateEntryCount} type="plain" accent="terracotta" />
        <MetricCard label="Conflicts" value={conflictCount} type="plain" accent="green" />
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Latest activity</h3>
          <span>Most recent first</span>
        </div>
        <div className="activity-list">
          {activityFeed.slice(0, 18).map((record) => (
            <article key={record.id} className="activity-card">
              <div className="activity-card__topline">
                <strong>{record.summary}</strong>
                <span>{String(record.date_time).slice(0, 16).replace("T", " ")}</span>
              </div>
              <p className="activity-card__meta">
                {record.actor_name} • {record.actor_role} • {record.action_type.replaceAll("_", " ")}
              </p>
              <p>{record.detail}</p>
              <div className="report-card__meals">
                <span>Status: {record.status}</span>
                {record.entered_late && <span>Entered late</span>}
                {record.conflict_flag && <span>Conflict flagged</span>}
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
