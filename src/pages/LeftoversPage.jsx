import { useState } from "react";
import { MEAL_ORDER } from "../../data/demoData.js";
import { formatMealLabel, fromDateTimeInputValue, toDateTimeInputValue } from "../lib/format.js";

const QUICK_QTY = [0, 0.5, 1, 2, 3];

export default function LeftoversPage({ activeUser, inventoryItems, onSubmit, feedback }) {
  const [selectedItemId, setSelectedItemId] = useState(102);
  const [mealType, setMealType] = useState("LUNCH");
  const [quantity, setQuantity] = useState("1");
  const [rawInputText, setRawInputText] = useState("small sufuria remained");
  const [notes, setNotes] = useState("");
  const [enteredLate, setEnteredLate] = useState(false);
  const [manualDateTime, setManualDateTime] = useState(toDateTimeInputValue());

  if (activeUser.role !== "COOK") {
    return <p className="empty-state">Only the cook can log leftovers from this screen.</p>;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSubmit({
      item_id: Number(selectedItemId),
      quantity: quantity === "" ? null : Number(quantity),
      meal_type: mealType,
      raw_input_text: rawInputText,
      notes,
      date_time: enteredLate ? fromDateTimeInputValue(manualDateTime) : new Date().toISOString(),
      entered_late: enteredLate,
      created_by: activeUser.id,
    });
  };

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--cook">
        <p className="eyebrow">Cook</p>
        <h2>Log leftovers in two taps</h2>
        <p>Pick the meal, tap the amount, and save. The phone can sync later.</p>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit}>
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
          <h3>Common items</h3>
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
          <h3>Leftover amount</h3>
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
          <span>Raw note</span>
          <input value={rawInputText} onChange={(event) => setRawInputText(event.target.value)} />
        </label>

        <label className="field">
          <span>Optional detail</span>
          <textarea value={notes} rows="2" onChange={(event) => setNotes(event.target.value)} />
        </label>

        <label className="switch-field">
          <input type="checkbox" checked={enteredLate} onChange={() => setEnteredLate((value) => !value)} />
          <span>Backfill earlier paper note</span>
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

        <button className="primary-button primary-button--cook" type="submit">
          Save leftover
        </button>
        {feedback && <p className="feedback-line">{feedback}</p>}
      </form>
    </section>
  );
}

