import { formatKes } from "../lib/format.js";

export default function MetricCard({ label, value, accent = "green", type = "currency" }) {
  const displayValue = type === "currency" ? formatKes(value) : value;

  return (
    <article className={`metric-card metric-card--${accent}`}>
      <p className="metric-card__label">{label}</p>
      <strong className="metric-card__value">{displayValue}</strong>
    </article>
  );
}

