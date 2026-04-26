import { useMemo, useState } from "react";
import { fromDateTimeInputValue, toDateTimeInputValue } from "../lib/format.js";

const QUICK_COUNTS = [140, 150, 160, 170, 180, 200];

export default function StudentCountPage({ activeUser, studentCounts, onSubmit, feedback }) {
  const latestCount = useMemo(
    () => [...studentCounts].sort((left, right) => String(right.date_time).localeCompare(String(left.date_time)))[0] || null,
    [studentCounts],
  );
  const [studentCount, setStudentCount] = useState(String(Math.round(Number(latestCount?.student_count || 160))));
  const [rawInputText, setRawInputText] = useState(latestCount?.raw_input_text || "students present after roll call");
  const [notes, setNotes] = useState("");
  const [enteredLate, setEnteredLate] = useState(false);
  const [manualDateTime, setManualDateTime] = useState(toDateTimeInputValue());

  if (activeUser.role !== "STOREKEEPER") {
    return <p className="empty-state">Only the storekeeper can capture daily student count here.</p>;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const dateTime = enteredLate ? fromDateTimeInputValue(manualDateTime) : new Date().toISOString();
    await onSubmit({
      student_count: studentCount === "" ? null : Number(studentCount),
      meal_type: "ALL",
      raw_input_text: rawInputText,
      notes,
      date_time: dateTime,
      count_date: dateTime.slice(0, 10),
      entered_late: enteredLate,
      created_by: activeUser.id,
    });
    setNotes("");
  };

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--slate">
        <p className="eyebrow">Student count</p>
        <h2>Record the day’s headcount fast</h2>
        <p>Cost per student stays useful only when the headcount stays current, even if it comes later from paper.</p>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <h3>Common counts</h3>
          <span>{latestCount ? `Last saved ${latestCount.student_count}` : "Daily total"}</span>
        </div>
        <div className="chip-grid">
          {QUICK_COUNTS.map((value) => (
            <button
              key={value}
              type="button"
              className={`chip ${String(studentCount) === String(value) ? "chip--active" : ""}`}
              onClick={() => setStudentCount(String(value))}
            >
              {value}
            </button>
          ))}
        </div>

        <label className="field">
          <span>Student count</span>
          <input value={studentCount} onChange={(event) => setStudentCount(event.target.value)} inputMode="numeric" />
        </label>

        <label className="field">
          <span>Raw note from roll call</span>
          <input
            value={rawInputText}
            onChange={(event) => setRawInputText(event.target.value)}
            placeholder="e.g. 161 students present after roll call"
          />
        </label>

        <label className="field">
          <span>Optional note</span>
          <textarea value={notes} rows="2" onChange={(event) => setNotes(event.target.value)} />
        </label>

        <label className="switch-field">
          <input type="checkbox" checked={enteredLate} onChange={() => setEnteredLate((value) => !value)} />
          <span>Backfill from earlier paper entry</span>
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

        <button className="primary-button primary-button--slate" type="submit">
          Save student count
        </button>
        {feedback && <p className="feedback-line">{feedback}</p>}
      </form>
    </section>
  );
}
