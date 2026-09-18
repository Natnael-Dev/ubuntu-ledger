# Ubuntu Ledger (Ward Proof-Line)

> **Ward Proof-Line turns a line in a local government budget into a five-minute physical check a neighbour can answer on a feature phone — and refuses to let a contractor close their own ticket.**

[![CI Status](https://img.shields.io/badge/CI-passing-brightgreen)](#) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Test Coverage](https://img.shields.io/badge/Vitest-566%20passed-success)](#) [![Playwright E2E](https://img.shields.io/badge/Playwright-69%2F69%20passed-success)](#)

---

## Quick Links

- **Feature-Phone Simulator:** [`/simulator`](http://localhost:3000/simulator) — *USSD and IVR audio verification*
- **Municipal Operator Console:** [`/console`](http://localhost:3000/console) — *Project board & probation countdown*
- **Citizen Ward Receipts:** [`/receipt/4412`](http://localhost:3000/receipt/4412) — *Official source citations & SHA-256 hashes*
- **Offline Field Monitor PWA:** [`/pwa`](http://localhost:3000/pwa) — *IndexedDB offline queue with airplane mode toggle*
- **Service Divergence Card:** [`/services/ET-ID-REPLACE`](http://localhost:3000/services/ET-ID-REPLACE) — *k-anonymous divergence reporting*

---

## The Two Core Proof Frames

Ubuntu Ledger is anchored by two immutable operational guarantees:

### Frame A: The Counter That Refuses to Move (Sybil & Cluster Resistance)
When multiple SIM cards or callers submit observations from the same telecom cell and demographic cohort, the system derives an opaque spatial cluster key (`sha256(taskId + geoCell + prefixBucket + cohort)`). The first submission advances the witness counter ($2 \to 3$); subsequent submissions from the same cluster are assigned `weight = 0` and **visibly leave the counter unchanged**, returning:
> *"Asante. Eneo hili tayari limehesabiwa, hivyo jumla inabaki 3."* / *"አመሰግናለሁ። ይህ አካባቢ ቀደም ሲል ተቆጥሯል።"*

### Frame B: The Close That Is Refused (Contractor Probation Lock)
When a contractor claims a broken public asset has been fixed, the project enters a mandatory **7-day probation lock**. The contractor says it is fixed: that is a claim, not a fact. An administrative attempt to close the ticket before the window has elapsed is **strictly refused with HTTP 409 `E_PROBATION_LOCKED`**, and the early-close refusal is committed directly into the tamper-evident cryptographic audit chain.

---

## Five-Minute Setup (Run It Locally)

Prerequisites: Node.js $\ge 20.11$ (`.nvmrc`), Docker Desktop (optional for live PostgreSQL).

```bash
# 1. Install dependencies
npm install

# 2. Start development server (in-memory mode works out-of-the-box)
npm run dev

# 3. Open the simulator
# Navigate to: http://localhost:3000/simulator
```

To run with live local Supabase / PostgreSQL:
```bash
# Start local Supabase container (requires Docker)
npx supabase start

# Export database connection and seed demo scenario
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
npm run seed:demo
npm run dev
```

---

## Verify It Yourself (Automated Verification Suite)

Every claim made in this project is verified by automated test suites:

```bash
# 1. Lint and code hygiene
npm run lint

# 2. TypeScript compilation
npx tsc --noEmit

# 3. Complete Vitest Suite (566 tests across 40 test files: 35 unit, 3 adversarial, 2 integration)
npm run test:unit && npm run test:adversarial && npm run test:integration

# 4. Playwright End-to-End Suite (69 tests across 6 spec files)
npx playwright test

# 5. Next.js Production Build (28 routes compiled cleanly)
npm run build
```

---

## System Architecture

```text
       [ USSD (*890#) ]       [ IVR Telephony (DTMF) ]       [ Monitor PWA (Offline Outbox) ]
               │                          │                                  │
               └──────────────────────────┼──────────────────────────────────┘
                                          ▼
                             [ Ingress Gateway Adapters ]
                     (Zero-PII hashing, MSISDN prefix bucketing)
                                          │
                                          ▼
                                [ Pure Domain Core ]
                 ┌────────────────────────┴────────────────────────┐
                 ▼                                                 ▼
     [ Sybil & Cluster Engine ]                       [ Triangulation Consensus ]
 (Opaque 16-hex cluster hashing)                   (INV-02: weight 0 on collision)
                 │                                                 │
                 ▼                                                 ▼
     [ Divergence Aggregation ]                       [ Repair Probation Machine ]
 (k < 5 total public suppression)                 (7-day lock; early close refused)
                 │                                                 │
                 └────────────────────────┬────────────────────────┘
                                          ▼
                             [ Radio Bulletin Compiler ]
                    (Frame grammar regex, homoglyph normalization)
                                          │
                                          ▼
                            [ Append-Only Audit Chain ]
                   (RFC 8785 canonical JSON, SHA-256 block chain)
                                          │
                                          ▼
                           [ PostgreSQL Database & RLS ]
                   (Rules rewrite UPDATE/DELETE, trigger blocks TRUNCATE)
```

- **Pure Domain Core:** `src/domain/` contains zero framework dependencies, zero escaping imports, and executes deterministic business logic.
- **Two-Ledger Model:** Official budget commitments and citizen observations are never averaged or blended. The system reports the *divergence*.
- **Cryptographic Sealing:** Sequence monotonicity ($seq_i = seq_{i-1} + 1$), predecessor hash linkage, and RFC 8785 canonical JSON prevent undetected tampering.

---

## Trust & Security Model

1. **Sybil Resistance:** Ten SIM cards from the same cell tower count as one witness.
2. **k-Anonymity ($k \ge 5$):** Public divergence metrics for public service offices are completely suppressed when fewer than 5 distinct clusters have reported, preventing algebraic differencing attacks.
3. **Fail-Closed Authentication:** In production (`NODE_ENV === 'production'`), privileged routes (`/api/bulletins/*`, `/api/repairs/*`) require cryptographically verified HS256 JWT tokens. Forged client headers (`x-actor-role`) are blocked with HTTP 401.
4. **Zero-PII Storage:** Plain telephone numbers and GPS coordinates are never stored or logged. Only coarse cell hashes and 6-digit prefix buckets exist in the database and outbox.
5. **Database Immutability:** PostgreSQL rules block `UPDATE` and `DELETE` on `audit_event`, and trigger `audit_no_truncate` seals against `TRUNCATE` across all roles.

---

## Multi-Country Portability (Kenya & Ethiopia)

Ubuntu Ledger enforces **zero country-branching** in domain and service layers (`if (country === 'KE')` is forbidden):

| Attribute | Ethiopia (PoC Ward) | Kenya (Second Country) |
| :--- | :--- | :--- |
| **Ward Code** | `ET-AA-W09` (Woreda 9, Addis Ababa) | `KE-NRB-ROY` (Roysambu Ward, Nairobi) |
| **Currency** | `ETB` (Birr) | `KES` (Kenyan Shilling) |
| **Dial Code** | `+251` | `+254` |
| **Locales** | Amharic (`am`), Afaan Oromo (`om`), English (`en`) | Swahili (`sw`), English (`en`) |
| **Admin Tiers** | Federal $\to$ Region $\to$ Zone $\to$ Woreda $\to$ Kebele | National $\to$ County $\to$ Sub-County $\to$ Ward $\to$ Village Unit |
| **Radio Partner**| Sheger FM 102.1 | Ghetto Radio 89.5 FM |

All variations are declarative via `/config/countries/{et,ke}.json` and `/config/wards/*.json`.

---

## What This Project Is and Is Not (Honest Boundaries)

- **Seeded Data:** The PoC operates with canonical realistic fixtures in Addis Ababa and Nairobi. Ingestion pipelines are specified and seeded.
- **Simulator Mode:** Phone interactions run on an in-browser feature-phone simulator implementing the standard gateway contract. Live telecom carrier provisioning (Africa's Talking shortcode / Twilio Voice webhook) is an external dependency.
- **T-32 Voice Notes Deferral:** Voice note capture and audio storage are intentionally deferred (P2) per `docs/specs/17-scope-control.md` Gate 1 because external object storage buckets were not configured. No core features depend on it.

---

## License

MIT License. Developed for the OSF × Andela "Information You Can Trust" Hackathon.
