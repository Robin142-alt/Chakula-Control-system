import { useEffect, useMemo, useState } from "react";

export default function LoginPage({ users, onLogin, isOnline, feedback }) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id || "");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedUser = useMemo(
    () => users.find((user) => Number(user.id) === Number(selectedUserId)) || users[0] || null,
    [selectedUserId, users],
  );

  useEffect(() => {
    if (!users.length) {
      return;
    }

    const currentExists = users.some((user) => Number(user.id) === Number(selectedUserId));
    if (!currentExists) {
      setSelectedUserId(users[0].id);
    }
  }, [selectedUserId, users]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onLogin({
        userId: Number(selectedUserId),
        pin,
      });
      setPin("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-card">
        <p className="eyebrow">Shared device sign-in</p>
        <h1>Chakula Control</h1>
        <p className="login-copy">
          Sign in with a simple PIN. If the network drops, this device can still use the last trusted PIN proof.
        </p>

        <div className="status-strip">
          <span className={`status-pill status-pill--${isOnline ? "online" : "offline"}`}>
            {isOnline ? "Online" : "Offline"}
          </span>
          <span className="status-note">
            {isOnline ? "Live login and sync available" : "Offline login works after one trusted sign-in"}
          </span>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Account</span>
            <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.display_name}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>PIN</span>
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={`Enter ${selectedUser?.pin_label || "PIN"}`}
              value={pin}
              onChange={(event) => setPin(event.target.value)}
            />
          </label>

          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {feedback && <div className="feedback-banner feedback-banner--tight">{feedback}</div>}
      </section>
    </div>
  );
}
