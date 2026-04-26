import { useEffect, useMemo, useState } from "react";
import DashboardPage from "./pages/DashboardPage.jsx";
import IssueStockPage from "./pages/IssueStockPage.jsx";
import LeftoversPage from "./pages/LeftoversPage.jsx";
import InventoryPage from "./pages/InventoryPage.jsx";
import StockCountPage from "./pages/StockCountPage.jsx";
import ReportsPage from "./pages/ReportsPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import BackfillImportPage from "./pages/BackfillImportPage.jsx";
import StudentCountPage from "./pages/StudentCountPage.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SyncCenterPage from "./pages/SyncCenterPage.jsx";
import { ROLE_ACCESS, USERS } from "../data/demoData.js";
import { formatAuthMode } from "./lib/authClient.js";
import {
  clearCurrentSession,
  flushSyncQueue,
  getCurrentSession,
  getStoredUsers,
  loadAppSnapshot,
  loginWithPin,
  importLocalBackupDocument,
  requestBackgroundSync,
  saveAppSettings,
  saveEntriesLocally,
  saveEntryLocally,
  seedKitchenDb,
  syncUsersFromApi,
} from "./lib/offlineStore.js";
import { DEFAULT_APP_SETTINGS } from "./lib/appSettings.js";

const DEFAULT_PAGE = {
  STOREKEEPER: "dashboard",
  COOK: "dashboard",
  ACCOUNTANT: "dashboard",
  PRINCIPAL: "dashboard",
  ADMIN: "dashboard",
};

function joinWarnings(warnings = []) {
  return warnings
    .map((warning) => warning.message || warning)
    .filter(Boolean)
    .join(" ");
}

export default function App() {
  const [session, setSession] = useState(null);
  const [availableUsers, setAvailableUsers] = useState(USERS);
  const [activePage, setActivePage] = useState("dashboard");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [snapshot, setSnapshot] = useState({
    inventory_items: [],
    alerts: [],
    summaries: [],
    student_counts: [],
    latest_summary: null,
    principal_snapshot: { todays_cost_kes: 0, cost_per_student_kes: 0, alerts: [] },
    report_insights: null,
    activity_feed: [],
    sync_queue: [],
    settings: DEFAULT_APP_SETTINGS,
    queue_count: 0,
    last_sync_at: null,
  });

  const activeUser = session?.user || null;
  const allowedPages = useMemo(
    () => (activeUser ? ROLE_ACCESS[activeUser.role] || [DEFAULT_PAGE[activeUser.role]] : []),
    [activeUser],
  );

  const refreshAppState = async ({ syncRemoteUsers = navigator.onLine } = {}) => {
    await seedKitchenDb();
    if (syncRemoteUsers) {
      await syncUsersFromApi().catch(() => {});
    }

    const [storedSession, storedUsers, appSnapshot] = await Promise.all([
      getCurrentSession(),
      getStoredUsers(),
      loadAppSnapshot(),
    ]);

    setSession(storedSession);
    setAvailableUsers(storedUsers.length ? storedUsers : USERS);
    setSnapshot(appSnapshot);
  };

  const runSync = async () => {
    if (!navigator.onLine) {
      return;
    }

    setSyncing(true);
    try {
      const result = await flushSyncQueue();
      await refreshAppState({ syncRemoteUsers: false });
      if (result.synced_count) {
        setFeedback(`Saved locally and synced ${result.synced_count} record${result.synced_count === 1 ? "" : "s"} to Neon.`);
      } else if (result.warnings.length) {
        setFeedback(joinWarnings(result.warnings));
      }
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    refreshAppState();
  }, []);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await refreshAppState({ syncRemoteUsers: true });
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
    if (activeUser && !allowedPages.includes(activePage)) {
      setActivePage(DEFAULT_PAGE[activeUser.role] || "dashboard");
    }
  }, [activePage, activeUser, allowedPages]);

  const handleLogin = async ({ userId, pin }) => {
    const result = await loginWithPin({ userId, pin });
    if (!result.success) {
      setFeedback(joinWarnings(result.warnings));
      return;
    }

    setFeedback(joinWarnings(result.warnings) || `Signed in as ${result.session.user.display_name}.`);
    await refreshAppState({ syncRemoteUsers: navigator.onLine });
    setActivePage(DEFAULT_PAGE[result.session.user.role] || "dashboard");
    if (navigator.onLine) {
      await runSync();
    }
  };

  const handleLogout = async () => {
    await clearCurrentSession();
    await refreshAppState({ syncRemoteUsers: false });
    setActivePage("dashboard");
    setFeedback("Signed out. Another staff member can sign in now.");
  };

  const handleSave = async (storeName, endpoint, payload, successMessage) => {
    const result = await saveEntryLocally(storeName, endpoint, payload, session);
    setFeedback(
      result.warnings.length
        ? `${successMessage} Warnings: ${result.warnings.join(" ")}`
        : `${successMessage} Saved on this device first.`,
    );
    await requestBackgroundSync().catch(() => {});
    await refreshAppState({ syncRemoteUsers: false });
    if (navigator.onLine) {
      runSync();
    }
  };

  const handleImport = async (entries) => {
    const results = await saveEntriesLocally(entries, session);
    const warnings = results.flatMap((result) => result.warnings || []);
    setFeedback(
      warnings.length
        ? `Imported ${results.length} row${results.length === 1 ? "" : "s"} locally. Warnings: ${warnings.join(" ")}`
        : `Imported ${results.length} row${results.length === 1 ? "" : "s"} into the local queue.`,
    );
    await requestBackgroundSync().catch(() => {});
    await refreshAppState({ syncRemoteUsers: false });
    if (navigator.onLine) {
      runSync();
    }

    return {
      importedCount: results.length,
    };
  };

  const handleSaveSettings = async (nextSettings) => {
    await saveAppSettings(nextSettings);
    setFeedback("Device settings saved locally.");
    await refreshAppState({ syncRemoteUsers: false });
  };

  const handleSyncNow = async () => {
    if (!navigator.onLine) {
      setFeedback("Still offline. Records remain safe on this device until the connection returns.");
      return;
    }

    await runSync();
  };

  const handleImportBackup = async (backup) => {
    const result = await importLocalBackupDocument(backup);
    const notes = [];
    if (result.imported_count) {
      notes.push(`Restored ${result.imported_count} pending record${result.imported_count === 1 ? "" : "s"} to this phone.`);
    }
    if (result.skipped_duplicates) {
      notes.push(`Skipped ${result.skipped_duplicates} record${result.skipped_duplicates === 1 ? "" : "s"} already present here.`);
    }
    if (result.applied_settings) {
      notes.push("Backup settings were applied because this phone was still on defaults.");
    }
    if (result.warnings.length) {
      notes.push(result.warnings.join(" "));
    }

    setFeedback(notes.join(" ") || "Backup restore finished.");
    await refreshAppState({ syncRemoteUsers: false });
    return result;
  };

  if (!activeUser) {
    return (
      <LoginPage
        users={availableUsers}
        onLogin={handleLogin}
        isOnline={isOnline}
        feedback={feedback}
        settings={snapshot.settings}
      />
    );
  }

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
          <p className="session-note">
            {snapshot.settings.school_name} / {snapshot.settings.kitchen_name}
          </p>
        </div>
        <div className="session-panel">
          <div>
            <p className="eyebrow">Signed in</p>
            <strong>{activeUser.display_name}</strong>
            <p className="session-note">{formatAuthMode(session.auth_mode)}</p>
          </div>
          <button className="secondary-button" type="button" onClick={handleLogout}>
            Sign out
          </button>
        </div>
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
        {activePage === "student-count" && (
          <StudentCountPage
            activeUser={activeUser}
            studentCounts={snapshot.student_counts}
            settings={snapshot.settings}
            onSubmit={(payload) => handleSave("student_counts", "/student-count", payload, "Student count saved.")}
            feedback={feedback}
          />
        )}
        {activePage === "stock-count" && (
          <StockCountPage
            {...pageProps}
            onSubmit={(payload) => handleSave("stock_counts", "/stock-count", payload, "Stock count saved.")}
            feedback={feedback}
          />
        )}
        {activePage === "backfill-import" && (
          <BackfillImportPage
            {...pageProps}
            onImport={handleImport}
            feedback={feedback}
          />
        )}
        {activePage === "reports" && (
          <ReportsPage
            summaries={snapshot.summaries}
            alerts={snapshot.alerts}
            reportInsights={snapshot.report_insights}
            settings={snapshot.settings}
          />
        )}
        {activePage === "audit-log" && (
          <AuditLogPage
            activeUser={activeUser}
            activityFeed={snapshot.activity_feed}
            queueCount={snapshot.queue_count}
          />
        )}
        {activePage === "settings" && (
          <SettingsPage
            activeUser={activeUser}
            settings={snapshot.settings}
            onSaveSettings={handleSaveSettings}
            feedback={feedback}
          />
        )}
        {activePage === "sync-center" && (
          <SyncCenterPage
            activeUser={activeUser}
            inventoryItems={snapshot.inventory_items}
            queueItems={snapshot.sync_queue}
            issueLogs={snapshot.issue_logs || []}
            leftoverLogs={snapshot.leftover_logs || []}
            stockCounts={snapshot.stock_counts || []}
            studentCounts={snapshot.student_counts || []}
            alerts={snapshot.alerts}
            summaries={snapshot.summaries}
            settings={snapshot.settings}
            isOnline={isOnline}
            syncing={syncing}
            onSyncNow={handleSyncNow}
            onImportBackup={handleImportBackup}
            feedback={feedback}
          />
        )}
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
