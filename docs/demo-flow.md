# Demo Flow

## Goal

Show that the system works in messy school reality:

- late entries
- partial data
- unreliable internet
- simple role-specific screens
- meaningful cost and anomaly insight

## Best demo order

1. Open the Storekeeper dashboard.
2. Sign in as `Grace - Storekeeper` with PIN `2048`.
3. Show today's cost, waste estimate, and alerts.
4. Open `Issue stock` and point out:
   - item chips
   - meal chips
   - preset quantities
   - backfill mode
5. Open `Student count` and show how daily headcount keeps cost per student useful.
6. Open `Backfill CSV` and show one pasted paper row importing into the local queue.
7. Switch to the Cook role and open `Log leftovers`.
8. Show how little typing is required.
9. Switch to the Principal role and show:
   - today's cost
   - cost per student
   - top 3 high alerts only
10. Switch to the Admin role and open `Audit trail`.
11. Open `Device settings` and show how one shared phone can still feel local to the school.
12. End on Reports and explain the seven-day anomaly story through budget, expected usage, and actual consumption.
13. Use the report actions to export a CSV or print a principal brief for offline handoff.
14. Open `Sync center` and show one waiting record, retry attempts, conflict flag, backup download, and backup restore.

## Suggested talking points

- "This system saves locally first, so the kitchen can keep working even when the internet drops."
- "Each shared device can trust a PIN once online, then continue working offline."
- "We never block input. If someone writes '2 debes beans' we preserve that raw note and warn later."
- "Student count is captured separately so cost per student remains meaningful even on messy days."
- "The Principal sees only the essentials, not a complicated stock screen."
- "Admin can still trace late entries, conflicts, and alerts without touching the kitchen workflow."
- "Admin can rename the school, kitchen, and default student count on the device without needing a developer."
- "The system helps separate normal variance from duplicate issues, missing leftovers, and stock mismatches."
- "Each alert is translated into likely waste, recording error, or possible theft with a next check to do."
- "Reports are not just raw exports. They show budget tracking, expected usage, consumption, and anomaly decisions in plain language."
- "When the principal or accountant still wants paper, one tap prints a short brief or downloads the CSV."
- "If the network is bad for hours, staff can still see exactly what is waiting and carry a JSON backup off the phone."
- "If the device is replaced, the same backup can restore pending records onto the next phone without wiping local data."

## Screenshot set

- Storekeeper dashboard: [01-storekeeper-dashboard.png](screenshots/01-storekeeper-dashboard.png)
- Issue stock flow: [02-issue-stock.png](screenshots/02-issue-stock.png)
- Backfill import flow: [03-backfill-import.png](screenshots/03-backfill-import.png)
- Cook leftovers flow: [04-cook-leftovers.png](screenshots/04-cook-leftovers.png)
- Principal summary: [05-principal-view.png](screenshots/05-principal-view.png)
- Student count capture: [06-student-count.png](screenshots/06-student-count.png)
- Admin audit trail: [07-admin-audit.png](screenshots/07-admin-audit.png)
- Admin device settings: [08-admin-settings.png](screenshots/08-admin-settings.png)
- Reports modules: [09-reports-modules.png](screenshots/09-reports-modules.png)
- Sync center: [10-sync-center.png](screenshots/10-sync-center.png)

## Demo commands

Local presentation with live demo data:

```bash
npm install
npm run db:migrate
npm run db:seed
npm run build
npm start
```

Local presentation with built-in demo mode only:

```bash
$env:APP_DATA_MODE='demo'
npm start
```

Demo sign-in details are in [demo-credentials.md](demo-credentials.md).
