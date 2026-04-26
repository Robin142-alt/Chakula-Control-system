import { useMemo, useState } from "react";
import MetricCard from "../components/MetricCard.jsx";
import {
  buildLocalBackupDocument,
  buildSyncQueueSummary,
  downloadTextFile,
} from "../lib/export.js";
import { formatMealLabel } from "../lib/format.js";

const STORE_LABELS = {
  issue_logs: "Issue stock",
  leftover_logs: "Leftover log",
  stock_counts: "Stock count",
  student_counts: "Student count",
};

function getItemName(itemMap, queueItem) {
  const payload = queueItem.payload || {};
  if (payload.item_name_snapshot) {
    return payload.item_name_snapshot;
  }

  return itemMap.get(Number(payload.item_id))?.name || "No matched item";
}

export default function SyncCenterPage({
  activeUser,
  inventoryItems,
  queueItems,
  issueLogs,
  leftoverLogs,
  stockCounts,
  studentCounts,
  alerts,
  summaries,
  settings,
  isOnline,
  syncing,
  onSyncNow,
  feedback,
}) {
  const [localMessage, setLocalMessage] = useState("");
  const itemMap = useMemo(
    () => new Map((inventoryItems || []).map((item) => [Number(item.id), item])),
    [inventoryItems],
  );
  const summary = useMemo(() => buildSyncQueueSummary(queueItems || []), [queueItems]);

  if (!["STOREKEEPER", "COOK", "ADMIN"].includes(activeUser.role)) {
    return <p className="empty-state">This sync center is for staff who capture or supervise local device records.</p>;
  }

  const handleBackupDownload = () => {
    const documentText = buildLocalBackupDocument({
      settings,
      queueItems,
      issueLogs,
      leftoverLogs,
      stockCounts,
      studentCounts,
      alerts,
      summaries,
    });
    downloadTextFile(
      `chakula-local-backup-${new Date().toISOString().slice(0, 10)}.json`,
      documentText,
      "application/json;charset=utf-8",
    );
    setLocalMessage("Local backup downloaded. This can be carried on flash disk or shared later.");
  };

  const typeEntries = Object.entries(summary.type_counts || {});

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--inventory">
        <p className="eyebrow">Sync center</p>
        <h2>Keep offline records visible and safe</h2>
        <p>Every capture stays on this device first. Use this screen to retry sync and carry a backup when the network is unreliable.</p>
      </div>

      <div className="metric-grid">
        <MetricCard label="Pending records" value={summary.pending_count} type="plain" accent="slate" />
        <MetricCard label="Needs retry" value={summary.retry_count} type="plain" accent="amber" />
        <MetricCard label="Conflict flags" value={summary.conflict_count} type="plain" accent="terracotta" />
        <MetricCard
          label="Oldest pending"
          value={summary.oldest_pending_at ? String(summary.oldest_pending_at).slice(0, 10) : "None"}
          type="plain"
        />
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Actions</h3>
          <span>{isOnline ? "Ready to sync" : "Offline safe mode"}</span>
        </div>
        <div className="action-grid">
          <button className="primary-button" type="button" onClick={onSyncNow} disabled={syncing}>
            {syncing ? "Syncing now..." : "Sync pending records"}
          </button>
          <button className="secondary-button" type="button" onClick={handleBackupDownload}>
            Download local backup
          </button>
        </div>
        {(localMessage || feedback) && <p className="feedback-line">{localMessage || feedback}</p>}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Queue mix</h3>
          <span>What is waiting on this phone</span>
        </div>
        {typeEntries.length ? (
          <div className="metric-grid metric-grid--import">
            {typeEntries.map(([storeName, count]) => (
              <article key={storeName} className="metric-card metric-card--green">
                <p className="metric-card__label">{STORE_LABELS[storeName] || storeName}</p>
                <strong className="metric-card__value">{count}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">No local records are waiting to sync right now.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Pending records</h3>
          <span>Oldest first</span>
        </div>
        <div className="report-list">
          {(queueItems || []).length ? (
            queueItems.map((queueItem) => {
              const payload = queueItem.payload || {};
              const itemName = getItemName(itemMap, queueItem);

              return (
                <article key={queueItem.id} className="report-card">
                  <div className="report-card__topline">
                    <strong>{STORE_LABELS[queueItem.store_name] || queueItem.store_name}</strong>
                    <span>{String(queueItem.created_at || "").slice(0, 10)}</span>
                  </div>
                  <p>Item: {queueItem.store_name === "student_counts" ? "Daily headcount" : itemName}</p>
                  <p>Meal: {formatMealLabel(payload.meal_type || "ALL")}</p>
                  <p>Captured for: {String(payload.date_time || "").slice(0, 16).replace("T", " ") || "No timestamp"}</p>
                  <p>Attempts: {Number(queueItem.attempts || 0)}</p>
                  {payload.entered_late && <p>Marked as late entry from paper.</p>}
                  {queueItem.conflict_flag && <p className="warning-line">Conflict flag set. Last-write-wins will still sync this record.</p>}
                  {queueItem.last_error && <p className="warning-line">Last sync note: {queueItem.last_error}</p>}
                  {payload.raw_input_text && <p className="inventory-card__note">Raw note: {payload.raw_input_text}</p>}
                </article>
              );
            })
          ) : (
            <p className="empty-state">Nothing is stuck in the local queue.</p>
          )}
        </div>
      </section>
    </section>
  );
}
