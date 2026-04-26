import { useMemo, useState } from "react";
import { MEAL_ORDER } from "../../data/demoData.js";
import { formatMealLabel, fromDateTimeInputValue, toDateTimeInputValue } from "../lib/format.js";

const QUICK_QTY = [5, 10, 15, 20, 25, 30];

export default function IssueStockPage({ activeUser, inventoryItems, onSubmit, feedback }) {
  const [selectedItemId, setSelectedItemId] = useState(inventoryItems[0]?.id || null);
  const [mealType, setMealType] = useState("LUNCH");
  const [quantity, setQuantity] = useState("20");
  const [rawInputText, setRawInputText] = useState("");
  const [notes, setNotes] = useState("");
  const [enteredLate, setEnteredLate] = useState(false);
  const [manualDateTime, setManualDateTime] = useState(toDateTimeInputValue());

  const selectedItem = useMemo(
    () => inventoryItems.find((item) => item.id === Number(selectedItemId)),
    [inventoryItems, selectedItemId],
  );

  if (activeUser.role !== "STOREKEEPER") {
    return <p className="empty-state">Only the storekeeper can issue stock from this screen.</p>;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      item_id: selectedItemId ? Number(selectedItemId) : null,
      quantity: quantity === "" ? null : Number(quantity),
      meal_type: mealType,
      raw_input_text: rawInputText || `${quantity || "?"} ${selectedItem?.unit || "units"} ${selectedItem?.name || "item"}`,
      notes,
      date_time: enteredLate ? fromDateTimeInputValue(manualDateTime) : new Date().toISOString(),
      entered_late: enteredLate,
      created_by: activeUser.id,
    });
    setRawInputText("");
    setNotes("");
  };

  return (
    <section className="page-grid">
      <div className="hero-card">
        <p className="eyebrow">Storekeeper</p>
        <h2>Issue stock fast</h2>
        <p>Nothing is blocked. If details are missing, the system saves first and warns later.</p>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <h3>Choose item</h3>
          <span>Tap instead of typing</span>
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

        <div className="panel__header">
          <h3>Meal</h3>
        </div>
        <div className="chip-grid">
          {MEAL_ORDER.map((meal) => (
            <button
              key={meal}
              type="button"
              className={`chip ${mealType === meal ? "chip--active" : ""}`}
              onClick={() => setMealType(meal)}
            >
              {formatMealLabel(meal)}
            </button>
          ))}
        </div>

        <div className="panel__header">
          <h3>Quantity</h3>
          <span>{selectedItem?.unit || "units"}</span>
        </div>
        <div className="chip-grid">
          {QUICK_QTY.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip ${String(quantity) === String(value) ? "chip--active" : ""}`}
              onClick={() => setQuantity(String(value))}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Custom quantity</span>
          <input value={quantity} onChange={(event) => setQuantity(event.target.value)} inputMode="decimal" />
        </label>

        <label className="field">
          <span>Raw note from paper</span>
          <input
            placeholder="e.g. 2 debes beans"
            value={rawInputText}
            onChange={(event) => setRawInputText(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Optional note</span>
          <textarea
            rows="2"
            placeholder="Reason or context"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <label className="switch-field">
          <input type="checkbox" checked={enteredLate} onChange={() => setEnteredLate((value) => !value)} />
          <span>Backfill from earlier entry</span>
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
          Save issue
        </button>
        {feedback && <p className="feedback-line">{feedback}</p>}
      </form>
    </section>
  );
}

