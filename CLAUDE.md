# CLAUDE.md — Dust Bunnies Cleaning Admin Dashboard

## Project Overview

A React + Vite SPA for managing cleaning business operations. It includes an admin dashboard, a customer-facing enquiry form, quote generation, staff portal, scheduling, marketing tools, and Supabase-backed persistence. Deployed on Vercel with serverless API functions.

## Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build → dist/
npm run preview   # Preview the production build locally
```

No test runner is configured. There is no lint script — avoid adding one unless asked.

## Environment Variables

Copy `.env.example` to `.env` and fill in real values before running locally.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server/API only) |
| `VITE_EMAILJS_*` | EmailJS credentials for sending emails |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps embed key |
| `VITE_CLEANER_PIN` | 4-digit PIN for the cleaner portal |
| `OPENAI_API_KEY` | OpenAI key used in Vercel serverless functions |
| `ALLOWED_ORIGINS` | CORS allowlist for API routes |

`VITE_*` variables are bundled into the client. Non-prefixed variables are only available in Vercel Functions (under `api/`).

## Architecture

### Frontend (`src/`)

| Path | Description |
|---|---|
| `main.jsx` | App entry point, React Router setup |
| `Dashboard.jsx` | Main admin dashboard |
| `CustomerForm.jsx` | Public customer enquiry form |
| `QuotePreview.jsx` | Printable/PDF quote page |
| `CleanerPortal.jsx` | PIN-gated staff portal |
| `components/` | Shared UI components |
| `enquiries/` | Enquiry inbox and workflow |
| `quotes/` | Quote generation and management |
| `scheduling/` | Job scheduling |
| `clients/` | Client management |
| `finance/` | Payroll and financial tools |
| `marketing/` | AI-assisted marketing content |
| `settings/` | Business settings and pricing |
| `auth/` | Authentication logic |
| `hooks/` | Custom React hooks |
| `utils/` | Utility functions |
| `lib/` | Third-party library wrappers |
| `config/` | App-level configuration |

### Backend (`api/`)

Vercel serverless functions. Each file under `api/` maps to a `/api/*` route. They use the Supabase service role key and OpenAI for AI features (marketing text/images).

### Routing

`vercel.json` rewrites all non-API routes to `/` so React Router handles client-side navigation. API routes are passed through directly.

## Key Routes

| Route | Description |
|---|---|
| `/` | Admin dashboard (inbox, quotes, pricing) |
| `/form` | Customer-facing enquiry form |
| `/quote/:id` | Branded quote preview (printable) |
| `/cleaner` | Cleaner/staff portal (PIN protected) |

## Tech Stack

- **React 18** with React Router v6
- **Vite 5** build tooling
- **Supabase** — database and auth
- **EmailJS** — client-side email sending
- **jsPDF** — PDF quote generation
- **OpenAI** — AI marketing content (server-side only)
- **Vercel** — hosting and serverless functions

## Security Notes

- `vercel.json` sets strict security headers (CSP, HSTS, X-Frame-Options).
- The CSP `connect-src` allows only Supabase, EmailJS, and Google Maps endpoints — update it if new external services are added.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` or `OPENAI_API_KEY` in client-side code. Keep them in non-`VITE_`-prefixed env vars used only in `api/` functions.
- `ALLOWED_ORIGINS` must be set correctly in production to prevent cross-origin abuse of API functions.
