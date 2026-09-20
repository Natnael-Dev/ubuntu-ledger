# Ubuntu Ledger (Ward Proof-Line)

> **Ward Proof-Line turns a line in a local government budget into a five-minute physical check a neighbour can answer on a feature phone — and refuses to let a contractor close their own ticket.**

[![CI Status](https://img.shields.io/badge/CI-passing-brightgreen)](#) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Test Coverage](https://img.shields.io/badge/Vitest-613%20passed-success)](#) [![Playwright E2E](https://img.shields.io/badge/Playwright-69%2F69%20passed-success)](#)

---

## 🏛 For Hackathon Judges

Welcome to the **Ward Proof-Line (Ubuntu Ledger)** submission for the Open Society Foundations × Andela Hackathon (*"Information you can trust"*).

### The 5 Core Pillars
1. **Proof of Task:** Turning opaque municipal capital budgets into five-minute physical verification checklists that any citizen can answer on a basic feature phone.
2. **Open Voice:** Interactive Voice Response (IVR) telephony and local FM radio bulletins in local languages (Amharic, Afaan Oromo, Swahili, English) for citizens across all literacy levels.
3. **Ward Receipt:** Cryptographically verified public spending receipts with direct citations, page numbers, and SHA-256 hashes linking back to official government gazettes.
4. **Bribe-Resistant Checklist:** Side-by-side two-ledger separation contrasting statutory fee ceilings against counter realities, accompanied by plain-language citizen refusal scripts.
5. **Proof-of-Fix (Probation Lock):** A mandatory 7-day citizen verification probation window before any repair ticket can be signed off. A contractor cannot close their own ticket.

### How to Evaluate the 6 Surfaces
We invite judges to explore the 6 verified demonstration portals in order:

| Surface | URL | What Invariant It Proves |
|---|---|---|
| **1. Overview & Thesis** | [`/`](http://localhost:3000/) | The institutional thesis, closed-loop 6-stage Proof-Line pipeline schematic, and architecture. |
| **2. Feature-Phone Simulator** | [`/simulator`](http://localhost:3000/simulator) | **Proof A (Sybil Resistance):** Dial `*890#`. Amina moves quorum $2 \to 3$. Switching to Girma (same cell cluster) is suppressed: witness count stays at 3. |
| **3. Municipal Console** | [`/console`](http://localhost:3000/console) | **Proof B (INV-01 Probation Lock):** Recording a contractor claim turns amber (`REPAIR_CLAIMED`), never green. Attempting early close returns `409 E_PROBATION_LOCKED`. |
| **4. Civic Spending Receipt** | [`/receipt/4412`](http://localhost:3000/receipt/4412) | **Cryptographic Provenance:** Itemized budget card with official gazette citation (Vol 14, Page 88), SHA-256 hash, and trilingual audio readout. |
| **5. Service Divergence Card** | [`/services/ET-ID-REPLACE`](http://localhost:3000/services/ET-ID-REPLACE) | **Proof C (Two-Ledger Separation & k-Anonymity):** Official ceiling (ETB 50) vs community reality (ETB 120). Reports below $k=5$ are strictly suppressed. Citizen refusal script included. |
| **6. Field Monitor PWA** | [`/pwa`](http://localhost:3000/pwa) | **Offline-First Resilience:** Toggle Airplane Mode to test client-side IndexedDB outbox queueing and automatic idempotent background sync on reconnect. |

### Local Setup for Judges (Full 624-Test Suite)
The repository runs out-of-the-box in memory (`npm run dev` / `npm test`), passing 613 tests (with 11 multi-connection database tests skipped).  
To run the full **624-test live PostgreSQL & RLS concurrency suite**, please refer to our step-by-step guide:  
👉 **[docs/hackathon/ci-notes.md](docs/hackathon/ci-notes.md)**

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

## ⏱️ 5-Minute Evaluator Quickstart

The fastest path for hackathon judges to verify the system end-to-end:

- **Minute 1: Setup & Launch (Zero External Dependencies)**
  ```bash
  npm install
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000) to inspect the civic thesis and 6-stage Proof-Line pipeline. The system runs 100% in-memory by default.  
  *(Optional: To run with a live Supabase / PostgreSQL instance, export `DATABASE_URL` and run `npm run seed`).*

- **Minute 2: Witness Quorum & Sybil Refusal (Proof A)**
  Open [`/simulator`](http://localhost:3000/simulator). Dial `*890#`. Check project `4412` as Amina — witness count advances $2 \to 3$. Switch the caller profile to Girma (same spatial cell cluster `CELL_ET_AA_042` and prefix bucket) and answer: spatial suppression assigns `weight = 0`, and the counter visibly remains locked at 3.

- **Minute 3: Contractor 409 Lockout & Probation Lock (Proof B & INV-01)**
  Open [`/console`](http://localhost:3000/console). On borehole `ET-AA-W09-BH-001`, click **Record Repair Claim**. The status turns amber (`REPAIR_CLAIMED`), never green. Click **Attempt Early Close**: the municipal engine strictly refuses the close with `409 E_PROBATION_LOCKED`, appending the violation to the cryptographic audit chain.

- **Minute 4: Public Gazette Receipt & Cryptographic Provenance**
  Open [`/receipt/4412`](http://localhost:3000/receipt/4412). Review the public spending receipt citing Official Gazette Vol 14, Page 88, accompanied by its SHA-256 payload hash and trilingual audio readouts in Amharic, Afaan Oromoo, and English.

- **Minute 5: Run the Verification Suite**
  Run the complete automated test suite to confirm all 12 mathematical invariants:
  ```bash
  npm run typecheck
  npm test                        # 613 Vitest tests passing (11 live-DB multi-conn skipped)
  npx playwright install chromium # install Playwright browsers if needed
  npx playwright test            # 69 Playwright E2E browser tests passing
  ```

---

## 🤖 AI Coding Usage & Division of Labor

Ubuntu Ledger was developed with an explicit human-in-the-loop AI swarm architecture. We uphold full transparency regarding division of labor, architectural ownership, and critical human vetoes:

- **Human Architecture (100%):**
  - **Invariants:** 100% of mathematical invariants (INV-01 through INV-12), including the 7-day non-negotiable probation lock, monotonic hash-chained sequence IDs, and RFC 8785 canonical JSON deterministic hashing.
  - **Sybil Resistance:** Mathematical formulation of spatial Sybil cluster keys: $\text{HMAC-SHA256}(\text{taskId} \parallel \text{geoCell} \parallel \text{prefixBucket} \parallel \text{cohort})$.
  - **State Machines:** Exhaustive transition matrices for Fiscal Lifecycle, Triangulation Consensus, Repair Probation, and Ingress Gateway.
  - **Multi-Country Portability:** Zero-branching design eliminating country conditionals in favor of declarative schema configs (`config/countries/{et,ke}.json`).

- **AI Swarm Execution:**
  - Fast boilerplate generation, Next.js 15 App Router endpoints, and React 19 UI component wiring.
  - In-memory mock repositories, Postgres pool adapters, and SQL schema migrations.
  - Implementation and stress-testing of 45 adversarial test attack scenarios (covering SQL injection, path traversal, differencing attacks, role escalation, and header spoofing).

- **Documented Human Vetoes:**
  - *Vetoed Client Consensus Flags:* Rejected an AI agent proposal allowing client requests to send consensus override parameters; triangulation consensus is computed strictly server-side by the deterministic domain engine.
  - *Vetoed Calendar-Day Arithmetic:* Rejected naive calendar date diffs; enforced monotonically advancing Unix epoch millisecond comparisons (`clock.now() + 7 * 86_400_000`) to eliminate timezone and leap-second attack vectors.
  - *Vetoed Unhashed MSISDN Storage:* Overrode an agent attempt to store telephone numbers with reversible masking; enforced zero-PII salted SHA-256 HMAC hashing at the ingress boundary prior to database storage or log output.

👉 *For the comprehensive task-by-task log, prompts, rejections, and test records, see [docs/ai-build-log.md](docs/ai-build-log.md).*

---

## Verify It Yourself (Automated Verification Suite)

Every claim made in this project is verified by automated test suites:

```bash
# 1. Lint and code hygiene
npm run lint

# 2. TypeScript compilation
npm run typecheck

# 3. Complete Vitest Suite (613 tests across 45 test files: 40 unit, 3 adversarial, 2 integration)
npm run test:unit && npm run test:adversarial && npm run test:integration

# 4. Playwright End-to-End Suite (69 tests across 6 spec files)
npx playwright install chromium
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
