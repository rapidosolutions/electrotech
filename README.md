# Electro Tech one-page website

Production-oriented one-page lead-generation site for Electro Tech — Electrical & Solar Solutions. It includes an accessible mobile menu, interactive solar-system flow, solar starting-point prefill, conditional quote form, Supabase persistence, database-backed rate limiting, SEO metadata and structured data.

## Requirements

- Node.js 22.13 or newer
- npm
- A Supabase project for live enquiries

## Local setup

1. Run `npm install`.
2. Copy `.env.example` to `.env.local` and add the required values.
3. Apply `supabase/migrations/202608140001_quote_enquiries.sql` in the Supabase SQL editor or CLI.
4. Run `npm run dev`.

The website still renders without Supabase credentials; form submissions then return a safe message directing visitors to WhatsApp.

## Environment variables

- `NEXT_PUBLIC_SITE_URL`: canonical production URL.
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL used only by the server route.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only insert and rate-limit key. Never expose it to browser code.
- `QUOTE_NOTIFICATION_EMAIL`: reserved notification destination.

## Validation and tests

- `npm run lint` checks TypeScript/React quality rules.
- `npm test` runs a production build and server-rendered HTML/security checks.
- `npm run build` creates the Cloudflare-compatible production output.

## Enquiries and security

`POST /api/quote` validates every payload with Zod, normalizes phone and email values, rejects a honeypot field, enforces input limits and inserts through the server-only service role. The SQL migration enables RLS, grants no browser read/update/delete policies, and includes a transactional database-backed 5-requests-per-30-minutes limiter keyed by a one-way hash of the request IP.

## Content updates

Business details, services, projects and technology names live in `lib/site-config.ts`. Replace representative project photos in `public/images` once verified Electro Tech photography is available; keep dimensions and descriptive alt text. Source/license records are in `docs/image-sources.md`.

## Belmo.io deployment

- Node runtime: 22+
- Build command: `npm run build`
- Start command: `npm run start`
- Add all production environment variables in the Belmo.io project settings.
- Set `NEXT_PUBLIC_SITE_URL` to the final HTTPS domain, apply the Supabase migration, and verify `/`, `/robots.txt`, `/sitemap.xml`, and one test enquiry.
- Roll back by redeploying the prior successful build. The migration is additive; do not drop enquiry tables during an application rollback.

The included Sites/vinext runtime also supports Cloudflare-compatible previews and publishing.
