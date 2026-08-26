# VASPTRACE API

Backend for **VASPTRACE**, a blockchain intelligence and financial investigation platform. The API powers the investigator workspace: cases, investigations, findings, evidence and reports.

> **Status: feature-complete.** Auth (JWT + bcrypt + RBAC), cases, investigations with the trace/intelligence engine, findings, sealed evidence, report generation, dashboard aggregation, audit logging, a demo seed, Docker packaging and CI are all implemented, type-checked and covered by 81 tests. The only deliberately outstanding piece is the trained ML model: `services/intelligence.service.ts` exposes `expandGraph`/`scoreRisk` as the swap-in points for real chain ingestion and model weights.

## Tech stack

| Concern        | Choice                          |
| -------------- | ------------------------------- |
| Runtime        | Node.js 20+                     |
| Framework      | Express 4                       |
| Language       | TypeScript (strict)             |
| Database       | MongoDB via Mongoose 8          |
| Validation     | Zod                             |
| Auth           | JWT + bcrypt                    |
| Dev runner     | tsx watch                       |

The API runs **independently** from the frontend (different port, own `package.json`).

## Folder structure

```text
server/
├── src/
│   ├── config/       env.ts (validated env), db.ts (Mongoose connection)
│   ├── controllers/  HTTP layer — request in, service call, response out
│   ├── services/     business logic
│   ├── models/       Mongoose schemas
│   ├── routes/       route definitions only (index.ts mounts feature routers)
│   ├── middleware/   auth, validate, error, notFound
│   ├── validators/   Zod schemas per module
│   ├── utils/        ApiError, ApiResponse, asyncHandler, generateId
│   ├── types/        express.d.ts (req.user augmentation)
│   ├── app.ts        Express app assembly
│   └── server.ts     entry point: connect DB, listen, graceful shutdown
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

Layering is strict: **routes → controllers → services → models**. No business logic in route files.

## Installation

```bash
cd server
npm install          # or: pnpm install / bun install
cp .env.example .env # then fill in the values
```

## Environment variables

| Variable         | Required | Default                 | Notes                                            |
| ---------------- | -------- | ----------------------- | ------------------------------------------------ |
| `PORT`           | no       | `5000`                  | HTTP port                                        |
| `NODE_ENV`       | no       | `development`           | `development` \| `test` \| `production`          |
| `MONGODB_URI`    | **yes**  | —                       | `mongodb://` or `mongodb+srv://` connection URI  |
| `JWT_SECRET`     | **yes**  | —                       | min 24 chars; `openssl rand -hex 48`             |
| `JWT_EXPIRES_IN` | no       | `7d`                    | token lifetime                                   |
| `CLIENT_URL`     | no       | `http://localhost:5173` | allowed CORS origin(s), comma-separated          |

Missing or invalid values abort startup with an explicit list of problems. Secrets are never hardcoded and `.env` is git-ignored.

## Running

```bash
npm run dev        # watch mode on http://localhost:5000
npm run build      # type-check + emit to dist/
npm start          # run the compiled build
npm run typecheck  # types only
npm test           # 81 tests
npm run seed       # load the demo investigation dataset (never in production)
```

### Docker

```bash
cd server
JWT_SECRET=$(openssl rand -hex 48) CLIENT_URL=http://localhost:8080 docker compose up --build
```

The database is not published to the host, the API runs as a non-root user, and the container image contains production dependencies only.

The process exits with a clear message if MongoDB is unreachable — it never serves traffic without a database.

## API overview

Base URL: `http://localhost:5000/api`

All endpoints except `/health*`, `/auth/register` and `/auth/login` require `Authorization: Bearer <token>`.

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health`, `/health/ready` | Liveness and readiness probes |
| POST | `/auth/register` | Create an account (first account becomes admin) |
| POST | `/auth/login` | Exchange credentials for a token |
| GET/PATCH | `/auth/me` | Read or update the current profile |
| POST | `/auth/password` | Change password (verifies the current one) |
| POST | `/auth/logout` | Audit-logged sign-out |
| GET | `/users` | Workspace directory (for case assignment) |
| PATCH | `/users/:id` | Admin only: role and activation |
| GET | `/dashboard/overview` | Aggregated command-centre metrics |
| GET/POST | `/cases` | List (paginated, filtered, text search) and create |
| GET/PATCH/DELETE | `/cases/:id` | Detail (with children), update, cascade delete |
| POST/DELETE | `/cases/:id/assignees[/:userId]` | Assign or unassign an investigator |
| GET/POST | `/investigations` | List traces, start a trace |
| GET | `/investigations/:id` | Investigation record |
| GET | `/investigations/:id/graph` | Bounded hop graph (nodes + edges) |
| GET | `/investigations/:id/analysis` | Ranked paths, behavioural signals, risk |
| POST | `/investigations/:id/rerun` | Re-queue the trace |
| GET/POST | `/findings` | List and record findings |
| GET/PATCH/DELETE | `/findings/:id` | Read, update, delete |
| GET/POST | `/evidence` | List and pin (seals a SHA-256 checksum) |
| GET | `/evidence/:id/verify` | Re-verify the chain-of-custody seal |
| PATCH/DELETE | `/evidence/:id` | Metadata only / owner-or-admin delete |
| GET/POST | `/reports` | List and generate a report from case contents |
| GET | `/reports/:id/export.csv` | CSV export |
| PATCH/DELETE | `/reports/:id` | Update (finalised reports are locked), delete |

```bash
curl http://localhost:5000/api/health
```


### Response contract

Success:

```json
{ "success": true, "message": "Human readable message", "data": {} }
```

Paginated `data`:

```json
{ "items": [], "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 } }
```

Error:

```json
{ "success": false, "message": "Human readable error message", "errors": [{ "field": "email", "message": "..." }] }
```

Handled centrally: Zod and Mongoose validation errors, duplicate keys (409), invalid ObjectIds, JWT invalid/expired (401), authorization (403), unknown (500). Stack traces are included only outside production.

## Authentication

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- bcrypt-hashed passwords, never returned in responses
- JWT bearer tokens: `Authorization: Bearer <token>`
- `requireAuth` attaches `req.user` and re-reads the account so deactivation is immediate; `requireRole("admin")` enforces roles
- Roles: `investigator`, `admin`

## Intelligence engine

`services/intelligence.service.ts` is pure and deterministic — no database, no network — which is what makes it testable and swappable:

- `expandGraph` — bounded breadth-first hop expansion preserving value continuity; terminal (service) addresses never forward value.
- `rankPaths` — root-to-leaf paths scored by retained value, aggregate risk, hop economy and service termination; every path carries a plain-language rationale.
- `detectSignals` — mixer touchpoints, peeling/splitting, structuring bursts and regulated-service exposure, each with confidence and supporting addresses.
- `scoreRisk` — blends structural risk with signal severity into a bounded 0–100 score.

Replacing the synthetic expansion with a real chain-ingestion adapter, or `scoreRisk` with trained model weights, requires no changes to the HTTP layer.

## Data model

`User`, `Case`, `Investigation` (embedded graph + metrics), `Finding`, `Evidence` (sealed payload + SHA-256), `Report`, `AuditLog`, `Counter` (atomic `CASE-2026-0001`-style references).

Authorisation is centralised in `services/access.service.ts`: every case-scoped read and write passes `assertCaseAccess`, unauthorised ids return `404` so they cannot be enumerated, and destructive actions additionally require case ownership or admin.

## Security & production-readiness audit

Findings resolved during the audit pass:

| Area | Issue found | Fix |
| --- | --- | --- |
| Authorization (data layer) | Demo rows had no owner, so any signed-in investigator could update/delete them (IDOR) | Backfilled owners, added `NOT NULL` + owner defaults, recreated update/delete policies with owner-or-admin `WITH CHECK` |
| Error responses | Stack traces were returned outside production (including test) | Stacks are now development-only; 5xx details go to structured logs |
| Transport hardening | No security headers, no rate limiting | `helmet` (strict CSP, no-referrer, HSTS in prod), global + auth + heavy + upload rate limiters |
| NoSQL injection | Mongo operators could reach query filters | Request scrubber strips `$`/dotted/prototype keys; mongoose `sanitizeFilter` + `strictQuery` |
| Input validation | No shared contract | `validate()` Zod middleware for body/params/query, strict objects, whitelisted sort fields, bounded pagination |
| Logging | Risk of credential leakage | Structured JSON logger with key redaction and correlation ids |
| Availability | Single health endpoint; abrupt shutdown | `/api/health` liveness + `/api/health/ready` readiness (503 when DB down/draining), connection draining, socket timeouts, resilient rejection handling |
| Payloads | Unbounded bodies, raw JSON parse errors | 512kb limit, controlled 400/413 responses |
| CORS | Permissive by default | Explicit origin allowlist; wildcard/localhost origins rejected in production |

### Testing

```bash
npm test          # 81 tests: transport, validation, security, redaction, auth guards, intelligence engine
npm run typecheck
```
