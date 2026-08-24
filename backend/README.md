# Electrotech backend

Standalone Express API for the Electrotech quote form and Solar Bill Analyzer.

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

Apply `supabase/migrations/202608140001_quote_enquiries.sql` to the target Supabase project before enabling live quote submissions.

The Solar Bill Analyzer additionally requires `GEMINI_API_KEY` and a stable `GEMINI_MODEL` identifier (the example uses `gemini-2.5-flash`). Gemini extracts non-PII bill fields only; all sizing and recommendations run through deterministic application code. Apply `supabase/migrations/202608240001_api_action_rate_limits.sql` before enabling analyzer traffic. Uploaded bills and analyzer results are never persisted by this API.

Analyzer routes:

- `POST /api/solar-analyzer/extract`: one in-memory PDF/JPEG/PNG bill, maximum 10 MB.
- `POST /api/solar-analyzer/calculate`: verified non-PII consumption and location JSON.

## Proxy handling

Belmo documents one regional edge load balancer between the client and the application container. Express therefore trusts exactly one proxy hop (`app.set("trust proxy", 1)`) before using `req.ip` for the existing database-backed rate limiter. It does not trust arbitrary proxy chains.
