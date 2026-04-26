import { useMemo, useState } from "react";
import { BACKFILL_TEMPLATE, normalizeBackfillRows, parseCsvText } from "../lib/csv.js";
import { downloadTextFile } from "../lib/export.js";

export default function BackfillImportPage({ activeUser, inventoryItems, onImport, feedback }) {
  const [csvText, setCsvText] = useState(BACKFILL_TEMPLATE);
  const [localMessage, setLocalMessage] = useState("");

  const parsed = useMemo(() => parseCsvText(csvText), [csvText]);
  const normalized = useMemo(
    () => normalizeBackfillRows(parsed.rows, { inventoryItems, activeUser }),
    [activeUser, inventoryItems, parsed.rows],
  );

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const nextText = await file.text();
    setCsvText(nextText);
  };

  const handleImport = async () => {
    if (!normalized.entries.length) {
      setLocalMessage("No valid backfill rows were found yet.");
      return;
    }

    const result = await onImport(normalized.entries);
    setLocalMessage(`Imported ${result.importedCount} row${result.importedCount === 1 ? "" : "s"} into the local queue.`);
  };

  const handleDownloadTemplate = () => {
    downloadTextFile("chakula-backfill-template.csv", BACKFILL_TEMPLATE, "text/csv;charset=utf-8");
    setLocalMessage("Backfill template downloaded for paper-to-CSV cleanup.");
  };

  const handleResetTemplate = () => {
    setCsvText(BACKFILL_TEMPLATE);
    setLocalMessage("Template restored.");
  };

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--reports">
        <p className="eyebrow">Backfill import</p>
        <h2>Turn paper records into usable data</h2>
        <p>
          Storekeeper imports issues, counts, and student counts. Cook imports leftovers. Every row is saved locally first.
        </p>
      </div>

      <section className="panel">
        <div className="panel__header">
          <h3>Upload or paste CSV</h3>
          <span>Late entries are marked automatically</span>
        </div>

        <label className="field">
          <span>CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFileChange} />
        </label>

        <label className="field">
          <span>CSV text</span>
          <textarea rows="12" value={csvText} onChange={(event) => setCsvText(event.target.value)} />
        </label>

        <div className="action-grid">
          <button className="primary-button" type="button" onClick={handleImport}>
            Import to local queue
          </button>
          <button className="secondary-button" type="button" onClick={handleDownloadTemplate}>
            Download template
          </button>
          <button className="secondary-button" type="button" onClick={handleResetTemplate}>
            Reset sample
          </button>
        </div>
        {(localMessage || feedback) && <p className="feedback-line">{localMessage || feedback}</p>}
      </section>

      <section className="panel">
        <div className="panel__header">
          <h3>Preview</h3>
          <span>{parsed.rows.length} row{parsed.rows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="metric-grid metric-grid--import">
          <article className="metric-card metric-card--green">
            <p className="metric-card__label">Issue rows</p>
            <strong className="metric-card__value">{normalized.counts.issue}</strong>
          </article>
          <article className="metric-card metric-card--amber">
            <p className="metric-card__label">Leftover rows</p>
            <strong className="metric-card__value">{normalized.counts.leftover}</strong>
          </article>
          <article className="metric-card metric-card--terracotta">
            <p className="metric-card__label">Count rows</p>
            <strong className="metric-card__value">{normalized.counts.stock_count}</strong>
          </article>
          <article className="metric-card metric-card--slate">
            <p className="metric-card__label">Student rows</p>
            <strong className="metric-card__value">{normalized.counts.student_count}</strong>
          </article>
        </div>

        <div className="warning-stack">
          {[...parsed.warnings, ...normalized.warnings].map((warning, index) => (
            <p key={`${warning}-${index}`} className="warning-line">{warning}</p>
          ))}
        </div>

        <div className="panel panel--nested">
          <div className="panel__header">
            <h3>Supported columns</h3>
            <span>Minimal required fields still work</span>
          </div>
          <p className="empty-state">
            `entry_type`, `item_name` or `item_id`, `quantity`, `meal_type`, `date_time`, `raw_input_text`, `notes`
          </p>
          <p className="empty-state">
            Student count rows can also use `student_count` and `count_date`.
          </p>
        </div>
      </section>
    </section>
  );
}
