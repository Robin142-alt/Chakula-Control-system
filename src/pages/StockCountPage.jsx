import { useMemo, useState } from "react";
import { fromDateTimeInputValue, toDateTimeInputValue } from "../lib/format.js";

const QUICK_COUNTS = [25, 50, 100, 150, 200];

export default function StockCountPage({ activeUser, inventoryItems, onSubmit, feedback }) {
  const [selectedItemId, setSelectedItemId] = useState(inventoryItems[0]?.id || null);
  const [countedQuantity, setCountedQuantity] = useState("100");
  const [rawInputText, setRawInputText] = useState("");
  const [notes, setNotes] = useState("");
  const [enteredLate, setEnteredLate] = useState(false);
  const [manualDateTime, setManualDateTime] = useState(toDateTimeInputValue());

  const selectedItem = useMemo(
    () => inventoryItems.find((item) => item.id === Number(selectedItemId)),
    [inventoryItems, selectedItemId],
  );

  if (activeUser.role !== "STOREKEEPER") {
    return <p className="empty-state">Only the storekeeper can perform stock counts from this screen.</p>;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      item_id: Number(selectedItemId),
      counted_quantity: countedQuantity === "" ? null : Number(countedQuantity),
      system_quantity: selectedItem?.current_stock ?? null,
      raw_input_text: rawInputText || `${countedQuantity || "?"} ${selectedItem?.unit || "units"} counted`,
      notes,
      date_time: enteredLate ? fromDateTimeInputValue(manualDateTime) : new Date().toISOString(),
      entered_late: enteredLate,
      created_by: activeUser.id,
    });
  };

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--count">
        <p className="eyebrow">Stock count</p>
        <h2>Capture the shelf reality</h2>
        <p>Last count wins for stock position, and conflicts are still flagged for audit.</p>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <h3>Select item</h3>
        </div>
        <div className="chip-grid">
          {inventoryItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`chip ${Number(selectedItemId) === item.id ? "chip--active" : ""}`}
              onClick={() => setSelectedItemId(item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="count-hint">
          <span>System balance</span>
          <strong>
            {selectedItem?.current_stock || 0} {selectedItem?.unit || ""}
          </strong>
        </div>

        <div className="chip-grid">
          {QUICK_COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip ${String(countedQuantity) === String(value) ? "chip--active" : ""}`}
              onClick={() => setCountedQuantity(String(value))}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Counted quantity</span>
          <input value={countedQuantity} onChange={(event) => setCountedQuantity(event.target.value)} inputMode="decimal" />
        </label>

        <label className="field">
          <span>Raw count note</span>
          <input value={rawInputText} onChange={(event) => setRawInputText(event.target.value)} placeholder="e.g. beans sacks lighter than book" />
        </label>

        <label className="field">
          <span>Optional note</span>
          <textarea value={notes} rows="2" onChange={(event) => setNotes(event.target.value)} />
        </label>

        <label className="switch-field">
          <input type="checkbox" checked={enteredLate} onChange={() => setEnteredLate((value) => !value)} />
          <span>Backfill count from earlier</span>
        </label>

        {enteredLate && (
          <label className="field">
            <span>Manual timestamp</span>
            <input
              type="datetime-local"
              value={manualDateTime}
              onChange={(event) => setManualDateTime(event.target.value)}
            />
          </label>
        )}

        <button className="primary-button" type="submit">
          Save count
        </button>
        {feedback && <p className="feedback-line">{feedback}</p>}
      </form>
    </section>
  );
}

