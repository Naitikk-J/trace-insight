# VASPTRACE API

Backend for **VASPTRACE**, a blockchain intelligence and financial investigation platform. The API powers the investigator workspace: cases, investigations, findings, evidence and reports.

> **Status: Phase A complete.** Express + TypeScript + MongoDB foundation, environment validation, consistent API envelopes, global error handling and the health endpoint are implemented and compiling. Auth and the domain modules land in the following phases.

## Tech stack

| Concern        | Choice                          |
| -------------- | ------------------------------- |
| Runtime        | Node.js 20+                     |
| Framework      | Express 4                       |
| Language       | TypeScript (strict)             |
| Database       | MongoDB via Mongoose 8          |
| Validation     | Zod                             |
| Auth (planned) | JWT + bcrypt                    |
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
```

The process exits with a clear message if MongoDB is unreachable — it never serves traffic without a database.

## API overview

Base URL: `http://localhost:5000/api`

| Method | Endpoint  | Auth | Description  |
| ------ | --------- | ---- | ------------ |
| GET    | `/health` | no   | Service probe |

```bash
curl http://localhost:5000/api/health
```

```json
{
  "success": true,
  "message": "VASPTRACE API is running",
  "data": {
    "status": "ok",
    "environment": "development",
    "database": "connected",
    "uptimeSeconds": 3,
    "timestamp": "2026-08-25T21:40:00.000Z"
  }
}
```

Planned mounts: `/api/auth`, `/api/cases`, `/api/investigations`, `/api/findings`, `/api/evidence`, `/api/reports`.

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

## Authentication overview (Phase B)

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- bcrypt-hashed passwords, never returned in responses
- JWT bearer tokens: `Authorization: Bearer <token>`
- `protect` middleware attaches `req.user`; `authorize("admin")` enforces roles
- Roles: `investigator`, `admin`

## Next phases

- **B** — User model, register/login/me, JWT + role middleware
- **C** — Case model and CRUD with pagination, search, filters (`CASE-2026-0001` ids)
- **D** — Investigation model, CRUD, `GET /api/cases/:caseId/investigations`
- **E** — Findings, Evidence, Reports
- **F** — `services/blockchain/` provider abstractions, seed script, frontend API client wiring

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
npm test          # 40 transport, validation, security and redaction tests
npm run typecheck
```
