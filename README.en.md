# Classroom Booking System (Sistema de Reservas de Aulas)

[![CI](https://github.com/GinoPiersigilli/Reservas/actions/workflows/ci.yml/badge.svg)](https://github.com/GinoPiersigilli/Reservas/actions/workflows/ci.yml)
[![CodeQL Analysis](https://github.com/GinoPiersigilli/Reservas/actions/workflows/codeql.yml/badge.svg)](https://github.com/GinoPiersigilli/Reservas/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

🌐 **Language / Idioma:** [Español](README.md) | **English**

Full-stack institutional web platform for managing classroom reservations, checking real-time time-slot availability, and preventing double bookings at the database engine level.

> **Why is the UI and codebase in Spanish?** This system was built for the academic registrar's office (_bedelía_) of an Argentine university (UTN FRC), so the interface, REST routes (`/api/reservas`, `/api/aulas`), code identifiers, and detailed `docs/` files are in Spanish. This English README summarizes the architecture, measured benchmarks, test strategy, and engineering trade-offs.

---

## Context & Role

Academic project for my Systems Engineering degree at UTN FRC, modeled on the university registrar's classroom-booking workflow. I designed, built, tested, and documented it end to end, using AI tools as assistants (see Development Process below).

---

## Screenshots & Live Walkthrough

End-to-end flow: a lecturer checks the availability grid and submits a booking request; registrar staff approves it from the admin panel.

![Full walkthrough: requesting and approving a classroom booking](docs/img/recorrido.gif)

| Time-Slot Availability Grid                          | Daily Schedule View                               |
| ---------------------------------------------------- | ------------------------------------------------- |
| ![Availability grid](docs/img/grilla-escritorio.png) | ![Daily schedule](docs/img/agenda-escritorio.png) |

| Admin Dashboard                               | Dark Mode                                         |
| --------------------------------------------- | ------------------------------------------------- |
| ![Admin panel](docs/img/panel-escritorio.png) | ![Dark mode schedule](docs/img/agenda-oscuro.png) |

More screenshots—sortable table view, audit detail page, classroom management, mobile, and tablet rail—live in [docs/img](docs/img). Both screenshots and the GIF are generated directly from the running app via `npm run capturas --prefix e2e` and `npm run gif --prefix e2e`.

---

## Problem Statement & Role-Based Capabilities

Eliminates blind booking requests through a visual 30-minute availability grid (`08:00`–`22:00`, `America/Argentina/Cordoba`) and enforces non-overlapping reservations inside PostgreSQL.

- **Faculty & Students (`usuario`):** Inspect real-time room occupancy, pick free ranges in two clicks with live tentative range preview, track request history, and cancel active bookings.
- **Registrar Staff (`admin`):** Work from a prioritized pending queue, approve/reject with confirmation dialogs, edit active bookings, manage classrooms (create, edit, soft-deactivate with atomic cancellation of future bookings, reactivate) under row locks and immutable auditing, and monitor monthly room occupancy & demand metrics.

---

## Architecture & Tech Stack

```mermaid
graph LR
  Client[React 19 SPA] -->|HTTPS /api| Nginx[Nginx Proxy + CSP]
  Nginx -->|HTTP Proxy| Node[Express API + Zod]
  Node -->|ACID Transactions & GiST| DB[(PostgreSQL 16)]
  Node -->|Token Verification| Auth[Clerk SSO / Local JWT]
```

- **Frontend:** React 19, CSS Modules, CSS custom property design tokens (`tokens.css`), self-hosted institutional fonts (`@fontsource`), Vite, Vitest, Testing Library, and `vitest-axe`.
- **Backend:** Node.js (ESM), Express, Sequelize 6, Zod schema validation, Jest, and Supertest.
- **Database:** PostgreSQL 16 with `btree_gist` exclusion constraints, transaction advisory locks, and `BEFORE UPDATE OR DELETE` audit-immutability triggers.
- **Infrastructure:** Docker Compose, unprivileged Nginx (`1.31-alpine`) reverse proxy, and strict CSP without `'unsafe-inline'` in `script-src`.

---

## Engineering Highlights & Measured Evidence

### 1. Concurrency Immunity & The Exclusion Constraint Experiment

Double booking is prevented by PostgreSQL itself, not by trusting application-level pre-checks:

```sql
ALTER TABLE reservas
  ADD CONSTRAINT reservas_sin_solapamiento
  EXCLUDE USING gist (
    "aulaId" WITH =,
    tsrange(("fecha" + "horaInicio")::timestamp, ("fecha" + "horaFin")::timestamp, '[)') WITH &&
  ) WHERE (estado IN ('pendiente', 'aprobada'));
```

- **Queueing & Lock Ordering:** Competing booking writes acquire `pg_advisory_xact_lock` on `(aulaId, fecha)` to eliminate deadlock cycles (`40P01`) while keeping different rooms/dates fully parallel. Room mutations acquire `SELECT ... FOR UPDATE`, while booking creation/edition acquires `SELECT ... FOR SHARE` on the classroom row.
- **Verified Under 100 Concurrent Requests:** 100 distinct users firing `POST /api/reservas` simultaneously for the same slot yield **1× `201 Created`**, **99× `409 Conflict`**, **0× `5xx`**, zero orphan audit rows, and **0 deadlocks** recorded in `pg_stat_database`.
- **Measured Ablation Experiment ([docs/CALIDAD.md §5.1](docs/CALIDAD.md#L296-L324)):** When `reservas_sin_solapamiento` was temporarily removed from migration `002` while leaving all backend pre-checks intact:
  - **29 out of 100 concurrent requests** succeeded in creating overlapping bookings (the pre-check `SELECT` stopped 71, but could not close the race window before `INSERT`).
  - **63 of 65 business-logic tests still passed**—proving why database-level exclusion is non-negotiable and why the concurrency suite specifically isolates this guarantee.

### 2. Transactional Idempotency (`Idempotency-Key`)

To absorb network retries, mobile reconnects, and accidental double-clicks on `POST /api/reservas`:

- The frontend generates an `Idempotency-Key` (UUID v4) per form state and reuses it across retries without changing form data.
- The backend computes a recursive canonical SHA-256 hash of the body and persists `(usuarioId, clave)` via `INSERT ... ON CONFLICT ("usuarioId", "clave") DO UPDATE ... WHERE idempotency_keys."expiresAt" < NOW()` inside the same transaction as the reservation and its audit record.
- **Same key + same body:** Returns stored `201` JSON with `Idempotent-Replay: true` without creating a second booking.
- **Same key + different body:** Returns `422 Unprocessable Entity`.
- **Failed `4xx` attempts:** Roll back without consuming the key so the user can fix validation errors and retry; keys expire after 24 hours and are purged at startup and hourly.

### 3. Database Benchmark on 200,000 Rows ([docs/RENDIMIENTO.md](docs/RENDIMIENTO.md))

Benchmarked via `EXPLAIN (ANALYZE, BUFFERS)` on PostgreSQL 16 over **200,000 bookings** spanning 800 days across 50 rooms and 1,000 users:

| Critical Query                                                | Baseline Time | With Composite Index | Impact / Execution Plan                                                                    |
| ------------------------------------------------------------- | ------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| Room & date availability (`WHERE "aulaId" = X AND fecha = Y`) | `0.244 ms`    | `0.070 ms`           | **+71.3% faster** (`35` -> `3` shared buffers, `Index Scan using reservas_aula_fecha_idx`) |
| Admin filtered listing (`aulaId`, `estado`, date range)       | `0.317 ms`    | `0.105 ms`           | **+66.9% faster** (`320` -> `5` buffers via composite index)                               |
| GiST overlap validation (`tsrange && tsrange`)                | `0.050 ms`    | `0.054 ms`           | **~50 µs** (`4` buffers, `Bitmap Index Scan on reservas_sin_solapamiento`)                 |

### 4. Testing Pyramid (424 Automated Tests) & Mock Discipline

| Level             | Tooling                                 | Count         | Scope & Real-DB Guarantee                                                                                                                                                                                                                                                                                                                           |
| ----------------- | --------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API Integration   | Jest + Supertest                        | **233 tests** | Business rules, RBAC/IDOR, 100-req concurrency, idempotency, rate limits, PostgreSQL errors, OpenAPI 3.1 contract (`openapi.test.js`). Only **29 mock usages** across the entire suite (network Clerk API, logger clock/output, history failure rollback, `40P01` injection); domain & concurrency suites run mock-free against real PostgreSQL 16. |
| Components & A11y | Vitest + Testing Library + `vitest-axe` | **171 tests** | Rendering, user interactions, session/auth race guards, frontend API contract, automated accessibility checks.                                                                                                                                                                                                                                      |
| End-to-End        | Playwright                              | **20 tests**  | 7 complete user flows against compiled React build + live Express API + fresh seeded Postgres (`*_e2e`).                                                                                                                                                                                                                                            |

### 5. Security, Multi-Layer Rate Limiting & DevSecOps

- **Four Purpose-Built Rate Limiters:** General IP limiter on `/api`, pre-auth write limiter (`limiteEscrituras` runs before token verification to block unauthenticated floods cheaply), per-user write limiter (`limiteEscriturasUsuario` prevents rotating-IP bypass), and strict IP login brute-force limiter (`/api/auth/login` behind validated `TRUST_PROXY_HOPS`). All emit `429` with `Retry-After`.
- **Hybrid Auth & Timing-Safe Login:** Clerk SSO (strict `azp` origin checks + verified-email enforcement on JIT provisioning) alongside local HS256 JWT (`issuer: 'reservas-api'`), live Postgres `activo` + role lookup per request, and constant-time `HASH_DE_DESCARTE` `bcrypt.compare` mitigation against account-enumeration timing leaks.
- **Observability & Error Hygiene:** Own zero-dependency JSON logger ([docs/adr/0005-logger-propio.md](docs/adr/0005-logger-propio.md)) with `requestId` / `correlationId` correlation and mandatory secret redaction, clean RFC 9110 status mapping (`409` for state conflicts vs `400` for malformed input, `503` + `Retry-After` for pool saturation / transient conflicts).
- **CI/CD Security Gates:** Prettier format check, ESLint (`max-lines-per-function`, `complexity`, security rules), `npm audit`, Gitleaks, Semgrep SAST, Trivy Docker image scanning (`0` OS CVEs on `nginxinc/nginx-unprivileged:1.31-alpine` & `node:20-alpine` non-root), and CodeQL—with all third-party GitHub Actions pinned to 40-char commit SHAs.

---

## Architecture Decision Records (ADRs)

Six lightweight ADRs document concrete trade-offs, measured impacts, and break-even points (full Spanish originals in [docs/adr/](docs/adr/README.md)):

1. **[ADR 0001 — Schedule integrity enforced by PostgreSQL, not the backend](docs/adr/0001-integridad-en-postgresql.md):** Why `EXCLUDE USING gist` over `tsrange('[)')` + `pg_advisory_xact_lock` replaced app-only checks (`29/100` concurrent leaks prevented).
2. **[ADR 0002 — Hybrid Clerk + local HS256 JWT auth](docs/adr/0002-autenticacion-clerk-y-jwt-local.md):** Why the backend synchronizes Clerk tokens against PostgreSQL (`usuarios`) as the source of truth for numeric IDs, `activo` status, and roles, while keeping local credentials available for zero-external-dependency environments and automated tests.
3. **[ADR 0003 — Client `Idempotency-Key` protocol](docs/adr/0003-idempotencia-por-clave.md):** Payment-API-style UUID + canonical body hash stored inside the booking transaction instead of fragile client-only button disabling or time-window heuristics.
4. **[ADR 0004 — Append-only audit trail via database trigger](docs/adr/0004-auditoria-append-only.md):** Both `historial_reservas` and `historial_aulas` are protected by `BEFORE UPDATE OR DELETE` PostgreSQL triggers so immutability travels with schema migrations regardless of DB user permissions.
5. **[ADR 0005 — Custom 95-line JSON logger instead of `pino`/`winston`](docs/adr/0005-logger-propio.md):** Zero-dependency stdout/stderr JSON logger enforcing mandatory secret/token redaction with an explicit break-even point to adopt `pino` if external transports or sampling are ever needed.
6. **[ADR 0006 — `409 Conflict` for state conflicts vs `400` for malformed requests](docs/adr/0006-codigos-http-de-conflicto.md):** Consistent RFC 9110 semantics across overlap (`23P01`), unique constraints (`23505`), and classroom deactivation (`409`), keeping `422` dedicated exclusively to idempotency key payload mismatches.

---

## Local Setup

```bash
# 1. Copy environment templates
cp .env.example .env && cp backend/.env.example backend/.env && cp frontend/.env.example frontend/.env

# 2. Start PostgreSQL 16
docker compose up -d postgres

# 3. Apply migrations and seed demo data
npm run migrate --prefix backend && npm run seed --prefix backend

# 4. Start Backend API (port 3001)
npm run dev --prefix backend

# 5. In another terminal, start Frontend SPA (port 5173)
npm run dev --prefix frontend
```

> **Local Demo Credentials** (seeded locally for testing):
>
> - Admin (Registrar): `admin@utnfrc.edu.ar` / `admin123`
> - Lecturer (`usuario`): `david@utnfrc.edu.ar` / `user123`

---

## Tests & Verification

```bash
npm test --prefix backend                    # 233 API integration tests against PostgreSQL (Jest)
npm test --prefix frontend                   # 171 component & axe-core a11y tests (Vitest)
npm run format:check                         # Repository formatting check (Prettier)
node frontend/scripts/verificar-contraste.js # WCAG 2.1 AA contrast token verification
npm run capturas --prefix e2e                # Regenerate docs/img screenshots + overflow assertions
npm run gif --prefix e2e                     # Re-record walkthrough GIF (requires ffmpeg)
```

End-to-end Playwright suite (starts live backend + compiled frontend automatically against an isolated `*_e2e` database):

```bash
cd e2e && npm ci && npx playwright install --with-deps chromium
DATABASE_URL_E2E=postgres://user:pass@localhost:5432/reservas_e2e npm test
```

k6 load script ([carga/README.md](carga/README.md), manual):

```bash
k6 run carga/disponibilidad.js
```

---

## API Docs, Production & Further Reading

- **OpenAPI 3.1 UI:** Available in development at `http://localhost:3001/api/docs/ui` (disabled when `NODE_ENV=production`).
- **Full Documentation Index (Spanish):** [docs/README.md](docs/README.md) — covers [Architecture](docs/ARQUITECTURA.md), [Quality & Testing](docs/CALIDAD.md), [Security Audit](docs/SEGURIDAD.md), [Performance](docs/RENDIMIENTO.md), [Deployment & Backups](docs/DEPLOY.md), and [UI Design System](docs/DISENO.md).
- **Accepted Risks:** Local JWT storage in `localStorage` is mitigated with strict Nginx CSP (`script-src` without `'unsafe-inline'`, `HttpOnly` cookies noted for future hardening); `'unsafe-inline'` in `style-src` is scoped to Clerk modal style injection only.

---

## Development Process & License

Built iteratively with AI tooling assistance (Google Antigravity and Claude Code), with architecture design, code review, test strategy, concurrency experiments, and security auditing authored and verified under own engineering judgment.

Licensed under the [MIT License](LICENSE). © 2026 Gino Piersigilli.
