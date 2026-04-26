# Deployment Guide

## Recommended path: Railway

The current architecture is best suited to a single Node.js service that serves both:

- the built React PWA from `dist/`
- the Express API from `server/index.js`

That makes Railway the fastest production path for this repo.

## Railway steps

1. Create a new Railway project and connect this GitHub repository.
2. Add environment variables:
   - `DATABASE_URL`
   - `SESSION_SECRET=<long-random-secret>`
   - `SESSION_TTL_HOURS=12`
   - `APP_DATA_MODE=database`
   - `PORT=3000`
   - `VITE_API_BASE_URL=https://<your-railway-domain>/api`
3. Use these build and start commands:
   - Build: `npm install && npm run build`
   - Start: `npm start`
4. Set the health check path to `/api/readiness`.
5. After the first deploy, run the schema and seed commands once from a Railway shell:
   - `npm run db:migrate`
   - `npm run db:seed`
6. Run the production smoke test locally before promoting the service:
   - `npm run smoke:prod`
7. After the app boots on Railway, verify readiness manually:
   - `/api/health` for liveness
   - `/api/readiness` for database-backed readiness

## Railway config in this repo

Use [railway.toml](../railway.toml) for the default service settings. It now points Railway health checks at `/api/readiness` so deploys wait for database-backed readiness before switching traffic.

## Optional demo mode without Neon

For a no-database walkthrough or stakeholder demo, set:

- `APP_DATA_MODE=demo`

This serves the app and API from the built-in seven-day dataset. It is useful for presentations, screenshots, and local QA when the live database is unavailable.

You can start this quickly with:

```bash
npm run build
npm run start:demo
```

## Docker path

This repo now includes:

- [Dockerfile](../Dockerfile)
- [.dockerignore](../.dockerignore)

Build and run locally:

```bash
docker build -t chakula-control .
docker run --rm -p 3000:3000 -e APP_DATA_MODE=demo chakula-control
```

## Split host: Vercel frontend + Railway API

This is the best split-host setup when you want Vercel previews for the PWA and Railway to keep running the Express API.

### Railway API service

Add these variables on Railway:

- `DATABASE_URL`
- `SESSION_SECRET`
- `SESSION_TTL_HOURS=12`
- `APP_DATA_MODE=database`
- `ALLOWED_ORIGINS=https://<your-vercel-domain>,https://<your-preview-domain>`
- `PORT=3000`

Set the Railway health check path to `/api/readiness`.

### Vercel frontend service

This repo now includes [vercel.json](../vercel.json) for a Vite SPA deployment with deep-link rewrites.

Add this variable on Vercel:

- `VITE_API_BASE_URL=https://<your-railway-domain>/api`

Then deploy with either the dashboard import flow or the Vercel CLI:

```bash
vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

### Split-host checks

- Open the Vercel URL and confirm the login screen loads.
- Sign in with a demo PIN and confirm `/api/auth/login` reaches Railway.
- Save one issue while online and confirm the browser returns immediate success.
- Open DevTools offline mode, save another issue, and confirm it stays in the local queue.
- Reconnect and confirm the queue drains.

## Production checklist

- Confirm Neon connection string is set in `DATABASE_URL`
- Confirm `SESSION_SECRET` is set to a private value
- Run `npm run db:migrate`
- Seed only if you want demo data: `npm run db:seed`
- Run `npm test`
- Run `npm run smoke:prod`
- Run `npm run runtime:check -- https://<your-domain>`
- Verify `/api/health`
- Verify `/api/readiness`
- Verify `/api/auth/users`
- Verify `/api/auth/login`
- Verify offline install on one low-end Android device
- Verify service worker caches the app shell after first load

See the fuller checklist in [production-launch-checklist.md](production-launch-checklist.md).
