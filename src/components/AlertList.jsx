export default function AlertList({ alerts, emptyMessage = "No alerts right now." }) {
  if (!alerts.length) {
    return <p className="empty-state">{emptyMessage}</p>;
  }

  return (
    <div className="alert-stack">
      {alerts.map((alert) => (
        <article key={`${alert.alert_type}-${alert.id}-${alert.date_time}`} className={`alert-card alert-card--${String(alert.severity).toLowerCase()}`}>
          <div className="alert-card__topline">
            <span>{alert.severity}</span>
            <span>{String(alert.date_time).slice(0, 10)}</span>
          </div>
          <strong>{alert.title}</strong>
          <p>{alert.message}</p>
        </article>
      ))}
    </div>
  );
}

