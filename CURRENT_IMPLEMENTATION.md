# Trace Insight / TRACIFY — Current Implementation

This document describes what is implemented in the repository today.

## 1) Repository layout

```text
trace-insight/
├── src/                  # Frontend app (TanStack Start + React + Supabase)
├── server/               # Backend API (Express + MongoDB)
├── supabase/             # Supabase schema, seed SQL, and migrations
├── .github/workflows/    # CI pipeline
├── render.yaml           # Backend deploy config (Render, Docker)
└── vercel.json           # Frontend deploy config (Vercel)
```

## 2) Architecture in production terms

- The project is a **split frontend/backend system**.
- Frontend uses:
  - Supabase Auth + Supabase Postgres for core workspace records.
  - A separate Express API for attribution, complaint intake, alerts, and AI routes.
- Backend (`/server`) uses:
  - Express + TypeScript + Mongoose.
  - JWT auth, RBAC, validation, and security middleware.
  - GraphSense adapter with deterministic fallback provider.

## 3) Frontend implementation (`/src`)

### Core stack

- React 19 + TypeScript
- TanStack Router (file-based routes)
- TanStack Query
- Vite
- Tailwind + shadcn/ui components
- Zustand for UI state
- Supabase JS client

### Routing and app shell

- Root route and shell: `src/routes/__root.tsx`
- Authenticated layout: `src/routes/_authenticated.tsx`
- Main authenticated pages:
  - `/dashboard`
  - `/complaints` and `/complaints/$complaintId`
  - `/alerts`
  - `/attribution`
  - `/ai`
  - `/cases` and `/cases/$caseId`
  - `/investigations`
  - `/findings`
  - `/evidence`
  - `/reports`
  - `/settings`
- Auth screen: `/auth`

### Data access patterns

- Supabase-backed workspace queries/mutations: `src/lib/api/queries.ts`
  - `cases`, `investigations`, `findings`, `evidence`, `reports`, `profiles`, `roles`
- Intelligence-service API client: `src/lib/api/client.ts`
  - Handles base URL, envelope parsing, local token storage, id normalization
- Intelligence-service query/mutation layer: `src/lib/api/backend.ts`

### Auth model

- Frontend primary session auth: `src/hooks/useAuth.ts` (Supabase session)
- Separate backend session for intelligence service:
  - token in localStorage
  - managed by `useBackend` + `BackendGate`
  - auto-connect path exists for the seeded demo investigator account

### Domain contracts

- Shared frontend domain model in `src/lib/domain.ts`:
  - case status/priority
  - investigation statuses
  - severity and evidence types
  - record interfaces for core entities

### SSR/error handling

- Server entry wrapper: `src/server.ts`
  - catches catastrophic SSR failures
  - normalizes h3 swallowed errors to controlled HTML 500 response
- Start middleware: `src/start.ts`
  - request error middleware
  - CSRF middleware for server functions
  - Supabase auth attachment middleware

## 4) Backend implementation (`/server`)

### Core stack

- Node 20+
- Express 4
- TypeScript
- MongoDB via Mongoose
- Zod validation
- JWT + bcrypt

### Backend structure

```text
server/src/
├── app.ts                # Express app assembly + middleware
├── server.ts             # Bootstrap, DB connect, graceful shutdown
├── config/               # env validation + DB connection
├── controllers/          # HTTP handlers
├── routes/               # route registration
├── services/             # business and intelligence logic
├── models/               # mongoose schemas
├── middleware/           # auth/security/validate/error handlers
├── validators/           # zod schemas
└── utils/                # API envelope, logger, async wrappers, etc.
```

### Implemented API surfaces

Mounted under `/api`:

- `/health`, `/health/ready`
- `/auth`
- `/users`
- `/dashboard`
- `/intake`
- `/complaints`
- `/alerts`
- `/cases`
- `/investigations`
- `/intelligence`
- `/findings`
- `/evidence`
- `/reports`
- `/ai`

### Security and runtime hardening

- Helmet with strict CSP defaults in API context
- CORS allowlist with origin checks
- request id injection
- request logging + redaction support
- payload size limits
- request sanitization
- global rate limiting
- centralized error handling and controlled 4xx/5xx envelopes
- graceful shutdown behavior with readiness draining

### Intelligence and AI system implementation

- Blockchain provider abstraction in `services/blockchain`
  - GraphSense provider
  - synthetic deterministic provider fallback
- Investigation intelligence engine in `services/intelligence.service.ts`
- Complaint attribution pipeline in `services/attribution.service.ts`
- Typology/risk modelling in `services/typology.service.ts`
- AI routes in `/api/ai`:
  - status
  - route prediction
  - copilot answer
- ML scoring provider abstraction (`services/ml`)
  - remote provider optional
  - baseline provider fallback
- LLM provider abstraction (`services/llm/providers.ts`)
  - OpenAI / Gemini / Anthropic adapters
  - deterministic local fallback

## 5) Supabase implementation (`/supabase`)

### Present configuration

- Supabase project config in `supabase/config.toml`
- SQL schema + seed in `supabase/schema_and_seed.sql`
- migration files under `supabase/migrations/`

### Implemented relational model (Supabase)

From `schema_and_seed.sql`:

- `profiles`
- `user_roles`
- `cases`
- `investigations`
- `findings`
- `evidence`
- `reports`
- plus RLS policies, helper functions, and auth triggers

Auth/users are tied to `auth.users` with role support and profile bootstrap trigger.

## 6) Environment variables

### Frontend/runtime (from source usage)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_URL` (intelligence backend base URL)
- SSR fallbacks also read:
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`

### Backend (`server/.env.example` + env validation)

- `PORT`
- `HOST`
- `NODE_ENV`
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `CLIENT_URL`
- `GRAPHSENSE_API_URL`
- `GRAPHSENSE_API_KEY`
- `GRAPHSENSE_TIMEOUT_MS`
- `INTAKE_API_KEYS`
- `TRACIFY_ML_URL`
- `TRACIFY_ML_API_KEY`
- `TRACIFY_ML_TIMEOUT_MS`
- `LLM_PROVIDER`
- `LLM_API_KEY`
- `LLM_MODEL`
- `LLM_TIMEOUT_MS`
- `LLM_SEND_FULL_ADDRESSES`
- `LLM_SEND_VICTIM_DETAILS`

## 7) Build, run, and test commands

### Frontend (repository root)

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run lint`
- `npm run format`

### Backend (`/server`)

- `npm run dev`
- `npm run build`
- `npm start`
- `npm run typecheck`
- `npm test`
- `npm run seed`

## 8) CI/CD and deployment

### GitHub Actions (`.github/workflows/ci.yml`)

Three jobs:

1. API — install, typecheck, test, audit
2. Web — install (bun), typecheck, build
3. Docker — backend container build validation

### Deployment configs

- `render.yaml`: deploys backend (`server`) using Docker and healthcheck `/api/health`
- `vercel.json`: frontend build/deploy config

## 9) Current implementation status summary

- Frontend investigator workspace is implemented with authenticated and feature routes.
- Backend API is implemented across auth, cases, investigations, findings, evidence, reports, complaints, alerts, and AI surfaces.
- Supabase schema + RLS + auth trigger setup is present.
- CI pipeline validates core backend and frontend quality gates.
- The system already contains fallback paths for:
  - chain data providers
  - ML scoring
  - external LLM copilot

## 10) Known architectural characteristic

The current implementation uses a **dual data backend model**:

- Supabase powers frontend workspace records and auth/session flow.
- Express/Mongo powers attribution/intelligence APIs and separate JWT sessioning.

This is implemented and functional, but should be treated as a deliberate architecture boundary in future planning.

