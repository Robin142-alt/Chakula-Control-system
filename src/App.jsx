import { useEffect, useMemo, useState } from "react";
import DashboardPage from "./pages/DashboardPage.jsx";
import IssueStockPage from "./pages/IssueStockPage.jsx";
import LeftoversPage from "./pages/LeftoversPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import StockCountPage from "./pages/StockCountPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import { ROLE_ACCESS, USERS } from "../data/demoData.js";
import {
  flushSyncQueue,
  getActiveUser,
  loadAppSnapshot,
  requestBackgroundSync,
  saveEntryLocally,
  seedKitchenDb,
  setActiveUser,
} from "./lib/offlineStore.js";

const DEFAULT_PAGE = {
  STOREKEEPER: "dashboard",
  COOK: "dashboard",
  ACCOUNTANT: "dashboard",
  PRINCIPAL: "dashboard",
  ADMIN: "dashboard",
};

export default function App() {
  const [activeUser, setCurrentUser] = useState(USERS[0]);
  const [activePage, setActivePage] = useState("dashboard");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [snapshot, setSnapshot] = useState({
    inventory_items: [],
    alerts: [],
    summaries: [],
    latest_summary: null,
    principal_snapshot: { todays_cost_kes: 0, cost_per_student_kes: 0, alerts: [] },
    queue_count: 0,
    last_sync_at: null,
  });

  const allowedPages = useMemo(() => ROLE_ACCESS[activeUser.role] || [DEFAULT_PAGE[activeUser.role]], [activeUser.role]);

  const refreshSnapshot = async () => {
    await seedKitchenDb();
    const [savedUser, appSnapshot] = await Promise.all([getActiveUser(), loadAppSnapshot()]);
    setCurrentUser(savedUser);
    setSnapshot(appSnapshot);
  };

  const runSync = async () => {
    if (!navigator.onLine) {
      return;
    }

    setSyncing(true);
    try {
      const result = await flushSyncQueue();
      await refreshSnapshot();
      if (result.synced_count) {
        setFeedback(`Saved locally and synced ${result.synced_count} record${result.synced_count === 1 ? "" : "s"} to Neon.`);
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    refreshSnapshot();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await runSync();
    };
    const handleOffline = () => setIsOnline(false);
    const handleServiceWorkerMessage = async (event) => {
      if (event.data?.type === "SYNC_REQUEST") {
        await runSync();
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    navigator.serviceWorker?.addEventListener("message", handleServiceWorkerMessage);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      navigator.serviceWorker?.removeEventListener("message", handleServiceWorkerMessage);
    };
  }, []);

  useEffect(() => {
    if (!allowedPages.includes(activePage)) {
      setActivePage(DEFAULT_PAGE[activeUser.role] || "dashboard");
    }
  }, [activePage, activeUser.role, allowedPages]);

  const handleUserChange = async (userId) => {
    await setActiveUser(userId);
    const user = USERS.find((entry) => entry.id === Number(userId)) || USERS[0];
    setCurrentUser(user);
    setActivePage(DEFAULT_PAGE[user.role] || "dashboard");
  };

  const handleSave = async (storeName, endpoint, payload, successMessage) => {
    const result = await saveEntryLocally(storeName, endpoint, payload);
    setFeedback(
      result.warnings.length
        ? `${successMessage} Warnings: ${result.warnings.join(" ")}`
        : `${successMessage} Saved on this device first.`,
    );
    await requestBackgroundSync().catch(() => {});
    await refreshSnapshot();
    if (navigator.onLine) {
      runSync();
    }
  };

  const pageProps = {
    activeUser,
    inventoryItems: snapshot.inventory_items,
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="app-title">Chakula Control</p>
          <h1>Smart Kitchen Accountability System</h1>
        </div>
        <label className="session-picker">
          <span>Active user</span>
          <select value={activeUser.id} onChange={(event) => handleUserChange(event.target.value)}>
            {USERS.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <section className="status-strip">
        <span className={`status-pill status-pill--${isOnline ? "online" : "offline"}`}>
          {isOnline ? "Online" : "Offline"}
        </span>
        <span className={`status-pill status-pill--${syncing ? "watch" : "healthy"}`}>
          {syncing ? "Syncing..." : `${snapshot.queue_count} pending`}
        </span>
        <span className="status-note">
          {snapshot.last_sync_at ? `Last sync ${new Date(snapshot.last_sync_at).toLocaleString()}` : "Waiting for first sync"}
        </span>
      </section>

      {feedback && <div className="feedback-banner">{feedback}</div>}

      <main className="app-main">
        {activePage === "dashboard" && (
          <DashboardPage
            activeUser={activeUser}
            latestSummary={snapshot.latest_summary}
            principalSnapshot={snapshot.principal_snapshot}
            alerts={snapshot.alerts}
            queueCount={snapshot.queue_count}
            onNavigate={setActivePage}
          />
        )}
        {activePage === "issue-stock" && (
          <IssueStockPage
            {...pageProps}
            onSubmit={(payload) => handleSave("issue_logs", "/issue-stock", payload, "Issue saved.")}
            feedback={feedback}
          />
        )}
        {activePage === "log-leftovers" && (
          <LeftoversPage
            {...pageProps}
            onSubmit={(payload) => handleSave("leftover_logs", "/log-leftover", payload, "Leftover saved.")}
            feedback={feedback}
          />
        )}
        {activePage === "inventory" && <InventoryPage inventoryItems={snapshot.inventory_items} />}
        {activePage === "stock-count" && (
          <StockCountPage
            {...pageProps}
            onSubmit={(payload) => handleSave("stock_counts", "/stock-count", payload, "Stock count saved.")}
            feedback={feedback}
          />
        )}
        {activePage === "reports" && <ReportsPage summaries={snapshot.summaries} alerts={snapshot.alerts} />}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {allowedPages.map((page) => (
          <button
            key={page}
            type="button"
            className={`bottom-nav__button ${activePage === page ? "bottom-nav__button--active" : ""}`}
            onClick={() => setActivePage(page)}
          >
            {page.replace("-", " ")}
          </button>
        ))}
      </nav>
    </div>
  );
}
