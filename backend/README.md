# Electrotech backend

Standalone Express API for the Electrotech quote form.

## Commands

- Install: `npm install`
- Development: `npm run dev`
- Type check: `npm run typecheck`
- Build: `npm run build`
- Production start: `npm run start`
- Tests: `npm test`

The production process reads `PORT` and listens on `0.0.0.0`. The local fallback is port `3001`.

## Environment

Copy `.env.example` to an ignored local environment file or provide the values through the hosting platform. `FRONTEND_ORIGIN` is required when `NODE_ENV=production`; it must be the exact HTTPS origin of the Vercel frontend. Supabase variables remain optional at startup so the health endpoint stays available, but `POST /api/quote` returns HTTP 503 until both Supabase values are configured.

## Proxy handling

Belmo documents one regional edge load balancer between the client and the application container. Express therefore trusts exactly one proxy hop (`app.set("trust proxy", 1)`) before using `req.ip` for the existing database-backed rate limiter. It does not trust arbitrary proxy chains.
