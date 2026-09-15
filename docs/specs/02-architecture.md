# 02 — Architecture

## 1. Architectural thesis

The whole system is a **session engine plus a rules core plus three dumb transports**.

Everything that matters — the state machines, triangulation, k-anonymity, the hash chain — lives in a pure, framework-free **domain core** with no I/O. USSD, SMS, IVR and the web PWA are transports that translate into and out of that core. This is what makes the product portable across countries and testable in a day: the rules are unit-testable pure functions, and a country is a configuration file.

**If the agent writes business logic inside a route handler or a React component, that is a defect.** See §4.

## 2. Component map

```
┌───────────────────────────── TRANSPORTS (thin, no logic) ──────────────────────────────┐
│                                                                                        │
│  /api/ussd        Africa's Talking USSD webhook contract (CON/END strings)              │
│  /api/sms/inbound Keyword-based SMS intake                                              │
│  /api/ivr         DTMF menu; returns an ordered audio-key manifest                      │
│  /pwa             Monitor PWA (offline queue) + public receipt pages                    │
│  /console         Admin & moderator console (deliberately plain)                        │
│  /simulator       In-browser feature-phone emulator → calls /api/ussd and /api/ivr      │
│                   using the EXACT same contract a real gateway would                    │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │  (DTO in / DTO out — no domain objects cross)
┌───────────────────────────────────────▼────────────────────────────────────────────────┐
│                          APPLICATION LAYER  (/src/app-services)                          │
│  Orchestrates: load aggregate → call domain → persist → emit outbox → write audit       │
│  Owns: transactions, idempotency, authorization checks                                  │
│  Contains NO branching business rules                                                   │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼────────────────────────────────────────────────┐
│                     DOMAIN CORE  (/src/domain)  — PURE, NO I/O, NO IMPORTS FROM DB      │
│                                                                                        │
│  audit-lifecycle.ts     project audit state machine                                     │
│  fiscal-lifecycle.ts    receipt fiscal state machine                                    │
│  probation.ts           7-day proof-of-fix machine + clock arithmetic                   │
│  triangulation.ts       clustering + witness counting                                   │
│  sybil.ts               cluster derivation from geo/cohort/device signals               │
│  kanonymity.ts          aggregate gating                                                │
│  divergence.ts          statutory vs observed computation                               │
│  bulletin.ts            radio script composition from a template + facts                │
│  hashchain.ts           audit event chaining                                            │
│  session.ts             USSD/IVR session reducer (menu tree → next node)                │
│  content.ts             message template resolution + slot filling                      │
└───────────────────────────────────────┬────────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼────────────────────────────────────────────────┐
│                     INFRASTRUCTURE  (/src/infra)                                        │
│  db/            typed data access (one repository module per aggregate)                 │
│  outbox/        message dispatch record + worker                                        │
│  audio/         audio manifest resolution, signed URLs                                  │
│  ingest/        document → receipt parsing (offline, human-confirmed)                   │
│  clock/         injectable clock (CRITICAL — probation tests need time travel)          │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                        │
                              Supabase Postgres + RLS
```

## 3. Technology choices and justification

Every choice below is **boring on purpose**. Deviating requires a written justification appended to this file.

| Layer | Choice | Justification | Rejected alternative & why |
|---|---|---|---|
| App framework | **Next.js 15 (App Router) + TypeScript** | One deployable for API routes, PWA and console. Agent tooling knows it well. | Separate Node API + SPA — two deploys, no gain in 5 days. |
| Styling | **Tailwind + shadcn/ui** | Fast, and the console is meant to look plain. | Custom design system — costs a day, scores nothing. |
| DB | **Supabase Postgres** | RLS, SQL, hosted, generated types. | Firebase — weak for relational aggregates, audit chains and SQL-based k-anonymity. |
| Migrations | **Raw SQL files in `supabase/migrations/` + `supabase gen types typescript`** | No ORM magic for an agent to fumble; migrations are reviewable artifacts. | Drizzle/Prisma — adds a toolchain failure mode on Day 1. |
| Data access | **Hand-written repository modules over `supabase-js`, typed from generated types** | Explicit boundaries; easy to mock in tests. | Query-in-component — violates §4. |
| State machines | **Pure TS declarative transition tables + exhaustive tests** | Zero dependencies; trivially testable; transitions are also stored in DB for auditability. | XState — capable but a new DSL to learn mid-sprint. |
| Channels | **Simulator-first against the real gateway contract** | Zero telecom provisioning; demo is honest because the contract is real. | Live Africa's Talking as P0 — provisioning delay is an uncontrollable external dependency. |
| Voice | **Pre-recorded audio phrase bank + DTMF** | Deterministic, fast, and quality is fully controlled. | Runtime TTS/ASR in Amharic/Afaan Oromo — quality risk on the trust-critical path. |
| Scheduling | **Vercel Cron → protected endpoints** | Simplest reliable scheduler for this stack. | pg_cron — fine, but harder to observe and test locally. |
| Offline | **Service worker (Workbox) + IndexedDB outbox on the Monitor PWA** | Proven pattern; only the monitor surface needs it. | Full offline-first everywhere — unnecessary; USSD/IVR need no client storage at all. |
| Tests | **Vitest (unit/domain), Playwright (channel + offline flows)** | Domain core is pure, so unit tests carry most of the weight. | Jest — slower with TS/ESM here. |
| CI | **GitHub Actions: typecheck → lint → unit → adversarial → playwright** | The green CI badge is a scored artifact. | None — losing the AI-usage evidence. |

## 4. Module boundary rules (enforced, not advisory)

1. `/src/domain/**` must not import from `/src/infra/**`, `next/*`, `@supabase/*`, or any I/O library. Enforce with an ESLint `no-restricted-imports` rule **and** a unit test that reads the import graph.
2. Route handlers may contain: request parsing, auth check, idempotency check, one app-service call, response shaping. Nothing else. A route handler over ~60 lines is a defect.
3. React components must not compute trust values. Triangulation, divergence and k-gating are computed server-side and arrive pre-decided. A component may render `"not enough reports yet"` but must never decide it.
4. All time reads go through `infra/clock`. `Date.now()` and `new Date()` outside `infra/clock` are defects — probation tests must be able to travel forward seven days in milliseconds.
5. All writes that change a lifecycle state go through the app-service, inside a transaction, and emit exactly one audit event.

## 5. Data flow — the canonical path

**Path A: Ingestion → Receipt**
```
Admin uploads document (PDF/CSV) in console
 → infra/ingest extracts candidate lines (AI-assisted, offline, one-shot)
 → human confirms each field in a review table (MANDATORY — never auto-publish)
 → app-service persists source_document (sha256, page_ref) + projects
 → fiscal state = COMMITTED, or UNOFFICIAL_ESTIMATE if no document hash
 → audit event appended
```

**Path B: Dispatch → Observation → State change**
```
Cron or admin dispatches proof task for project
 → outbox rows created for registered monitors in that ward
 → transport delivers (simulator/SMS/IVR)
 → monitor answers 2–3 numeric questions
 → /api/ussd → app-service → domain/sybil derives cluster_key
 → observation persisted with cluster_key and weight
 → domain/triangulation recomputes witness_count (DISTINCT clusters)
 → domain/audit-lifecycle decides transition
 → state persisted + audit event + outbox (if a notification is owed)
```

**Path C: Repair claim → Probation → Verdict**
```
Contractor/agency claim recorded in console
 → repair_ticket → PROBATION_DAY_0, probation_ends_at = now + 7d  (clock injected)
 → system REFUSES any transition to VERIFIED_SUSTAINED before probation_ends_at
 → cron dispatches Day-3 and Day-7 re-check pings to ORIGINAL reporters
 → responses arrive → domain/probation decides
 → VERIFIED_SUSTAINED (≥2 distinct-cluster confirmations after day 7)
   or PROBATION_FAILED (≥1 confirmed failure from a distinct cluster, any day)
```

**Path D: Facts → Bulletin → Air**
```
Weekly cron collects the ward's anomalies (facts only, all k-gated)
 → domain/bulletin composes script from a fixed template + slot values
 → bulletin state = DRAFT
 → moderator reviews in console; may edit; must approve
 → APPROVED_FOR_BROADCAST, with moderator identity in the audit chain
 → export: text + printable card (+ optional stitched audio, P2)
```

## 6. Offline strategy (be precise — judges probe this)

| Surface | Offline behaviour | Honest limitation |
|---|---|---|
| USSD | Requires no data at all. Session state lives server-side keyed by `sessionId`. | Requires live cellular signal; works during data outages, not during total network loss. |
| SMS | Store-and-forward by the network. Works with intermittent coverage. | Delivery latency is unbounded; we surface `queued` state. |
| IVR | Requires a voice call only. | Same as USSD. |
| Monitor PWA | Full offline: app shell cached, observations written to an IndexedDB outbox with a client-generated `idempotency_key`, flushed on reconnect, with a visible sync badge and per-item state. | Dispatch of *new* tasks needs a connection; cached tasks remain answerable offline. |
| Public receipt page | Last-viewed receipts cached read-only with a visible "last updated" stamp. | Cached receipts may be stale; staleness is displayed, never hidden. |

**Never claim** the product works with "no network at all." Claim precisely: *the citizen path needs no mobile data, and the monitor app survives full connectivity loss without data loss.*

## 7. Security model (summary; full detail in 07)

- Public channels are **write-mostly**: a citizen can submit an observation or outcome code and read only k-gated aggregates.
- Console is role-gated: `admin`, `moderator`, `ingest_reviewer`. Supabase Auth, RLS on every table, deny-by-default.
- Raw phone numbers are stored encrypted (pgcrypto) with a separate `phone_hash` used for all joins and dedupe. Domain code never sees a raw number.
- `audit_event` is append-only (no UPDATE/DELETE grant to any role) and hash-chained.
- Audio blobs have a hard TTL enforced by a cron purge with a test that proves deletion.

## 8. Portability architecture (this is 25% of the score)

A country/ward deployment is **configuration, not code**:

```
/config/
  countries/
    et.json     admin tiers (region→zone→woreda→kebele), currency ETB, locales [am, om, en],
                statutory source types, appeal bodies, outcome-code labels
    ke.json     county→ward, KES, [sw, en]
    ng.json     state→LGA→ward, NGN, [ha, en]
  wards/
    et-aa-w09.json   ward identity, radio partner, monitor roster shape
  asset-types/
    borehole.json, generator.json, latrine_block.json   ← proof-task templates live here
  services/
    et-id-replacement.json, et-clinic-intake.json       ← statutory rules live here
```

**Invariant across countries:** the loop, the three state machines, triangulation, sybil clustering, k-anonymity, probation arithmetic, the bulletin template structure, the session engine.
**Varies:** admin hierarchy labels, currency, locales, statutory content, outcome-code labels, appeal bodies, asset-type task templates.

Ship **two country configs** (ET primary, KE shell) in the PoC. This is the cheapest possible proof of portability and it is worth more than any slide claim.

## 9. Repository layout

```
/
  README.md
  /docs/                     ← copy of this spec set + ai-build-log.md
  /supabase/migrations/      ← numbered SQL migrations
  /supabase/seed/            ← seed SQL + scenario fixtures
  /config/                   ← country / ward / asset-type / service configs
  /content/
     locales/{en,am,om}.json ← message templates
     audio/{en,am,om}/*.mp3  ← prompt phrase bank
     audio/manifest.json
  /src
     /domain                 ← pure rules core
     /app-services           ← orchestration
     /infra                  ← db, outbox, clock, audio, ingest
     /app                    ← Next.js routes (api + pages)
     /components             ← UI
     /simulator              ← feature-phone emulator
  /tests
     /unit                   ← domain
     /adversarial            ← the 30-case suite
     /e2e                    ← Playwright
  .github/workflows/ci.yml
```

## 10. What the agent must never do architecturally

- Introduce a new runtime dependency without recording the justification in this file.
- Put a `status` string assignment anywhere outside a domain state machine.
- Add a map library.
- Add a real-time subscription. Polling is fine; realtime is a demo liability.
- Add authentication to any public citizen path. The citizen never has an account.
- Cache a trust decision on the client.
