import { useEffect, useState } from "react";

export default function SettingsPage({ activeUser, settings, onSaveSettings, feedback }) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  if (activeUser.role !== "ADMIN") {
    return <p className="empty-state">Only Admin can change device settings here.</p>;
  }

  const updateField = (field, value) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await onSaveSettings({
      ...draft,
      default_student_count: Number(draft.default_student_count || 0),
    });
  };

  return (
    <section className="page-grid">
      <div className="hero-card hero-card--slate">
        <p className="eyebrow">Admin settings</p>
        <h2>Make this shared device fit your school</h2>
        <p>These settings save locally first so the app feels familiar even when the network is weak.</p>
      </div>

      <form className="panel form-panel" onSubmit={handleSubmit}>
        <div className="panel__header">
          <h3>School profile</h3>
          <span>Used across the app shell</span>
        </div>

        <label className="field">
          <span>School name</span>
          <input value={draft.school_name || ""} onChange={(event) => updateField("school_name", event.target.value)} />
        </label>

        <label className="field">
          <span>Kitchen name</span>
          <input value={draft.kitchen_name || ""} onChange={(event) => updateField("kitchen_name", event.target.value)} />
        </label>

        <label className="field">
          <span>Default student count</span>
          <input
            inputMode="numeric"
            value={draft.default_student_count ?? ""}
            onChange={(event) => updateField("default_student_count", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Alert contact</span>
          <input value={draft.alert_contact || ""} onChange={(event) => updateField("alert_contact", event.target.value)} />
        </label>

        <label className="field">
          <span>Shared-device note</span>
          <textarea rows="3" value={draft.notes || ""} onChange={(event) => updateField("notes", event.target.value)} />
        </label>

        <button className="primary-button primary-button--slate" type="submit">
          Save device settings
        </button>
        {feedback && <p className="feedback-line">{feedback}</p>}
      </form>
    </section>
  );
}
