# Continuous Integration & PostgreSQL Testing Notes

## Overview
The Ward Proof-Line automated test suite contains **574 automated tests** across unit, adversarial, and integration suites:
- **In-Memory Suite (563 passed, 11 skipped):** Executes pure domain state machines, cryptographic hash chains, PII redaction engines, and API route handlers in pure Node.js without an external database.
- **Full Live PostgreSQL Suite (574 passed, 0 skipped):** Executes all in-memory tests **plus 11 multi-connection live concurrency, atomic lock, and Row-Level Security (RLS) integration tests** in `tests/integration/postgres-observation.test.ts`.

---

## Why CI Skips the 11 Live PostgreSQL Tests
In `.github/workflows/ci.yml`, the `unit` test job runs:
```bash
npm run test:unit
```
Without a running PostgreSQL / Supabase instance, `tests/integration/postgres-observation.test.ts` activates its conditional skip guard:
```typescript
const hasLiveDatabase = Boolean(
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.TEST_POSTGRES_URL
);

describe.skipIf(!hasLiveDatabase)(
  "Live Multi-Connection Concurrency (Requires Live PostgreSQL/Supabase)",
  ...
);
```
This is an intentional design decision to keep standard GitHub Actions runs fast (~1 minute) and lightweight without spinning up heavy container services for PR checks.

---

## How to Run the Full 574-Test Suite Locally

To verify 100% of the live PostgreSQL concurrency and RLS assertions locally:

### 1. Ensure Local Supabase / PostgreSQL is Running
Start the local Supabase container:
```bash
npx supabase start
```
Check that the database is reachable:
```bash
npx supabase status
```
Default connection string:
```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

### 2. Run Database Migrations & Demo Seed
Apply all 12 schema migrations and seed canonical scenarios:
```bash
npx supabase db reset
npm run seed:demo
```

### 3. Run Vitest with Live Database Target
Export `DATABASE_URL` and run the entire suite:
```powershell
# PowerShell (Windows)
$env:DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
npx vitest run
```
```bash
# Bash (Linux / macOS)
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres" npx vitest run
```

### Expected Output:
```text
✓ 27 test files passed
✓ 574 passed (0 skipped, 0 failed)
```
