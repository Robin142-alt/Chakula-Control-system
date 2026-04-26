# Chakula Control System

Offline-first Smart Kitchen Accountability System built for low-resource boarding school environments where entries are late, data is incomplete, internet is unreliable, and shared devices are the norm.

## What this includes

- React PWA, mobile first, with IndexedDB as the primary write path
- Express API connected to PostgreSQL on Neon through `DATABASE_URL`
- Background sync queue with local-first save behavior
- Tolerant data capture that never blocks input and returns warnings instead of validation errors
- Shared-device PIN login with online tokens and offline proof after one trusted sign-in
- Role-shaped dashboards for Storekeeper, Cook, Accountant, Principal, and Admin
- Dedicated daily student count capture for cost-per-student accuracy
- Admin audit trail view built from local-first activity records
- Admin shared-device settings for school name, kitchen name, default headcount, and alert contact
- CSV backfill import for paper records and late entry cleanup
- Downloadable backfill CSV template and sample reset for faster paper cleanup
- Sync center for pending queue visibility, conflict review, retry awareness, and local backup download
- Backup restore flow that re-adds pending records to a replacement phone without wiping current local data
- Alerts translated into likely `WASTE`, `ERROR`, or `POSSIBLE_THEFT`
- Reports that make `Consumption`, `Expected Usage`, `Budget Tracking`, and `Anomalies` explicit instead of hiding them in raw tables
- Offline-friendly exports for daily summaries, alert review, and a printable principal brief
- Seven-day Kenyan demo dataset with realistic items, KES pricing, anomalies, and cost outputs

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create the database schema:

```bash
npm run db:migrate
```

3. Load demo data into Neon:

```bash
npm run db:seed
```

4. Start the API:

```bash
npm start
```

5. Start the React app in development:

```bash
npm run dev:web
```

6. Build the production frontend:

```bash
npm run build
```

## Demo sign-in

The system uses a shared-device PIN login for the demo:

- Grace - Storekeeper: `2048`
- Peter - Cook: `1122`
- Mary - Accountant: `3344`
- Mr. Kibet - Principal: `4455`
- Admin Achieng: `7788`

These credentials are demo-only and should be replaced before any real deployment.

## Testing

Run the logic and API test suite:

```bash
npm test
```

Generate coverage with Node's built-in coverage runner:

```bash
npm run test:coverage
```

## Demo assets

Generate the mobile screenshots used in the presentation docs:

```bash
npm run demo:screenshots
```

If Playwright cannot find Microsoft Edge on your machine, install Chromium once:

```bash
npx playwright install chromium
```

Run a production-style smoke test against the built app in demo mode:

```bash
npm run smoke:prod
```

Check liveness and readiness against a running server:

```bash
npm run runtime:check -- http://127.0.0.1:3000
```

## Environment

Use `.env.example` as the template. The real local `.env` uses:

- `DATABASE_URL`
- `PORT`
- `VITE_API_BASE_URL`
- `SESSION_SECRET`
- `SESSION_TTL_HOURS`
- `ALLOWED_ORIGINS`
- `APP_DATA_MODE`

Credentials are not hardcoded in source files.

For an API and UI walkthrough without a live database, you can also run with:

- `APP_DATA_MODE=demo`

In `APP_DATA_MODE=demo`, authenticated writes are preserved in the local queue and server fallback log instead of writing into Neon.

## Core files

- SQL schema: [db/schema.sql](db/schema.sql)
- Demo data: [data/demoData.js](data/demoData.js)
- Derived dataset helpers: [data/derivedData.js](data/derivedData.js)
- Core logic: [data/logic.js](data/logic.js)
- Backend API: [server/app.js](server/app.js)
- Local-first storage and sync: [src/lib/offlineStore.js](src/lib/offlineStore.js)
- Frontend app shell: [src/App.jsx](src/App.jsx)
- Admin settings screen: [src/pages/SettingsPage.jsx](src/pages/SettingsPage.jsx)
- Sync center screen: [src/pages/SyncCenterPage.jsx](src/pages/SyncCenterPage.jsx)
- Export and print helpers: [src/lib/export.js](src/lib/export.js)
- Simulated output: [docs/simulated-dashboard-output.json](docs/simulated-dashboard-output.json)
- Deployment notes: [docs/deployment.md](docs/deployment.md)
- Demo credentials: [docs/demo-credentials.md](docs/demo-credentials.md)
- Production checklist: [docs/production-launch-checklist.md](docs/production-launch-checklist.md)
- Demo flow: [docs/demo-flow.md](docs/demo-flow.md)
- Pitch script: [docs/pitch-script.md](docs/pitch-script.md)
- Final validation: [docs/final-validation.md](docs/final-validation.md)

## Required API routes

- `POST /api/issue-stock`
- `POST /api/log-leftover`
- `POST /api/stock-count`
- `POST /api/student-count`
- `POST /api/auth/login`
- `GET /api/dashboard-summary`
- `GET /api/alerts`
- `GET /api/reports`
- `GET /api/health`
- `GET /api/readiness`
- `GET /api/auth/users`
- `GET /api/auth/session`

All write endpoints return:

```json
{
  "success": true,
  "warnings": []
}
```

## Offline-first behavior

- Save locally first in IndexedDB
- Queue writes in `sync_queue`
- Retry when connection returns
- Register background sync when supported
- Mark conflicts with `conflict_flag = true`
- Keep last-write-wins behavior for stock counts

## Demo simulation highlights

- Date range: `2026-04-20` to `2026-04-26`
- Inventory: maize flour, beans, rice, cooking oil
- Realistic KES pricing and school-scale quantities
- Included anomalies:
  - Duplicate lunch beans issue
  - Missing leftovers on multiple meals
  - High consumption day
  - Low consumption day
  - Friday stock mismatch
  - Normal day on `2026-04-26`

## Notes

- The npm scripts use direct Node execution for Vite because this workspace path contains `&`, which breaks the default Windows shim in some environments.
- CI is configured in `.github/workflows/ci.yml` to run `npm test` and `npm run build` on pushes and pull requests.
