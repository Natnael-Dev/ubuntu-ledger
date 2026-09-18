# Data Boundary Architecture

**Status:** Verified  
**Version:** 1.0  
**Created:** 2026-09-18  
**Owner:** Lead Architect, Ubuntu Ledger / Ward Proof-Line

---

## Overview

The frontend presentation layer operates across two distinct data strata. Understanding this boundary is critical for every engineer working on the application, as violating it silently degrades civic accountability guarantees.

### Fixture Stratum

**Location:** `src/lib/fixtures/`  
**Format:** Static JSON, committed to version control  
**Used by:** `src/lib/project-receipt.ts`, `src/lib/statutory-service.ts`, `src/app/console/page.tsx`

Fixtures are pre-seeded, sanitised ward project records used in local development without a running database, E2E tests (Playwright), unit tests (Vitest), and public demos (`docs/specs/12-demo-script.md`).

#### Demo Records

| Record | Route | Purpose |
|--------|-------|---------|
| `4412` | `/receipt/4412` | Primary demo receipt — probation cycle |
| `ET-ID-001` | `/services/ET-ID-001` | Primary demo divergence card |
| Console | `/console` | Board view with INV-01 refusal demo |

### Runtime Stratum

**Location:** `src/lib/db/`  
**ORM:** Drizzle ORM  
**Backend:** PostgreSQL 15 (Supabase Docker port 54322 in local dev)  
**Connection:** `DATABASE_URL` environment variable  

Activates automatically when `DATABASE_URL` is defined. Falls back to fixtures when not set.

`powershell
# Local dev
 = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
npm run dev
`

### SHA-256 Hash Chain

Every state transition is written to `audit_events` with `prev_hash`, `this_hash`, and `actor_ref`. The chain is immutable. Broken chains surface as `DISCREPANCY_FLAGGED` in the console board.

---

## API Transition Path

`
Phase 0 (current):  Fixtures -> Next.js RSC -> rendered HTML
Phase 1 (planned):  Fixtures + Runtime DB -> getStatutoryService() fetches from DB when available
Phase 2 (planned):  Full API layer: POST /api/observations, GET /api/receipts/[code]
`

API contracts specified in `docs/specs/05-api-contracts.md`.

---

## Environment Indicator (UI)

| Environment | Indicator |
|-------------|-----------|
| Fixture mode | `DATA: FIXTURE` badge in footer (amber) |
| Runtime mode | `DATA: LIVE -- PostgreSQL` badge in footer (green) |

Implementation: `src/components/DataBoundaryBadge.tsx` (planned -- UI-02 scope)

---

## Security Notes

1. Never expose `DATABASE_URL` to the client bundle. All DB calls must be in Server Components or API routes.
2. Offline outbox (`src/lib/outbox/`) uses IndexedDB -- client-only, zero server trust. All observations re-validated server-side on flush.
3. Phone hashes must be SHA-256 digests of MSISDN. Raw phone numbers rejected by both client validation and server API.
4. Fixture records are public. Do not use to make assumptions about real ward data structure.

---

## Cross-References

- `docs/specs/04-state-machine.md` -- INV-01 probation invariant
- `docs/specs/05-api-contracts.md` -- API endpoint contracts
- `docs/specs/08-ui-ux-design.md` -- UI rendering constraints
- `src/domain/` -- Pure domain logic (no DB, no network)
- `src/infra/clock/` -- Deterministic clock abstraction
- `tests/integration/` -- Integration tests (require DATABASE_URL)
