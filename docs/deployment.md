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
   - `PORT=3000`
   - `VITE_API_BASE_URL=https://<your-railway-domain>/api`
3. Use these build and start commands:
   - Build: `npm install && npm run build`
   - Start: `npm start`
4. Set the health check path to `/api/health`.
5. After the first deploy, run the schema and seed commands once from a Railway shell:
   - `npm run db:migrate`
   - `npm run db:seed`
6. Run the production smoke test locally before promoting the service:
   - `npm run smoke:prod`

## Railway config in this repo

Use [railway.toml](../railway.toml) for the default service settings.

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

## Vercel guidance

Vercel is a good fit for the frontend, but this repo's current always-on Express server is more naturally deployed on Railway, Render, or Fly.io.

If you still want a Vercel workflow, use one of these two options:

1. Split deployment:
   - Frontend on Vercel
   - API on Railway
   - Set `VITE_API_BASE_URL` to the Railway API URL

2. Refactor deployment:
   - Convert the Express API into Vercel serverless routes
   - Keep the React app on Vercel

For CI/CD on Vercel, the recommended command pattern is:

```bash
vercel pull --yes --environment=production --token=$VERCEL_TOKEN
vercel build --prod --token=$VERCEL_TOKEN
vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN
```

That aligns with the current Vercel deployment guidance for prebuilt CI pipelines.

## Production checklist

- Confirm Neon connection string is set in `DATABASE_URL`
- Run `npm run db:migrate`
- Seed only if you want demo data: `npm run db:seed`
- Run `npm test`
- Run `npm run smoke:prod`
- Verify `/api/health`
- Verify offline install on one low-end Android device
- Verify service worker caches the app shell after first load

See the fuller checklist in [production-launch-checklist.md](production-launch-checklist.md).
