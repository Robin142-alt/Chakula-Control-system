# Production Launch Checklist

## Before first deploy

- Confirm `DATABASE_URL` is set
- Confirm `SESSION_SECRET` is set to a private value
- Confirm `APP_DATA_MODE=database` in production
- Run `npm ci`
- Run `npm test`
- Run `npm run build`
- Run `npm run smoke:prod`

## Database

- Run `npm run db:migrate`
- Run `npm run db:seed` only if you want demo data in the live database
- Verify `/api/health`
- Verify `/api/readiness`
- Run `npm run runtime:check -- https://<your-domain>` after first deploy

## Hosting

- Set `PORT` from platform defaults
- Set `VITE_API_BASE_URL` to your public API URL if frontend and API are split
- Set `ALLOWED_ORIGINS` when frontend and API are split
- Keep the health check on `/api/readiness`
- Watch first-start logs for:
  - app mode
  - port binding
  - Neon connection failures
  - default session secret warning
  - readiness failures due to missing `DATABASE_URL`

## Manual acceptance checks

- Root app loads on mobile
- Service worker installs after first load
- Offline indicator changes correctly
- Storekeeper can save an issue locally
- Cook can save a leftover locally
- Storekeeper can import late paper rows from CSV
- Shared-device PIN login works online, then offline on the same device
- Principal view shows:
  - today's cost
  - cost per student
  - max 3 high alerts

## Post-launch watchpoints

- `data/server-ingest-fallback.jsonl` should stay empty or near-empty
- Check for repeated `conflict_flag` records
- Monitor stock mismatch frequency
- Review missing-leftover alerts after first week
