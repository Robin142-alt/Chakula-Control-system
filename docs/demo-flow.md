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
2. Show today's cost, waste estimate, and alerts.
3. Open `Issue stock` and point out:
   - item chips
   - meal chips
   - preset quantities
   - backfill mode
4. Switch to the Cook role and open `Log leftovers`.
5. Show how little typing is required.
6. Switch to the Principal role and show:
   - today's cost
   - cost per student
   - top 3 high alerts only
7. End on Reports and explain the seven-day anomaly story.

## Suggested talking points

- "This system saves locally first, so the kitchen can keep working even when the internet drops."
- "We never block input. If someone writes '2 debes beans' we preserve that raw note and warn later."
- "The Principal sees only the essentials, not a complicated stock screen."
- "The system helps separate normal variance from duplicate issues, missing leftovers, and stock mismatches."

## Screenshot set

- Storekeeper dashboard: [01-storekeeper-dashboard.png](screenshots/01-storekeeper-dashboard.png)
- Issue stock flow: [02-issue-stock.png](screenshots/02-issue-stock.png)
- Cook leftovers flow: [03-cook-leftovers.png](screenshots/03-cook-leftovers.png)
- Principal summary: [04-principal-view.png](screenshots/04-principal-view.png)

## Demo commands

Local presentation with live demo data:

```bash
npm install
npm run build
npm start
```

Local presentation with built-in demo mode only:

```bash
$env:APP_DATA_MODE='demo'
npm start
```
