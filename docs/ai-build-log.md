# AI Build Log — Ward Proof-Line

Developer: <name> (solo)
Tools: Antigravity / Gemini 3.8 Flash
Sprint: 15–21 September 2026

## How to read this log
Every task has: what I specified, what the agent generated, what I rejected and why,
what I wrote by hand, and how it was verified. The architecture, the trust model and
every state machine transition are mine. The agent implemented, tested and attacked them.

## Division of labour (summary — update on the last day)
| Area | Author |
|---|---|
| Problem selection and the five-component fusion | Human |
| Trust model: cluster weighting, k-gating, probation lock | Human |
| All state machine states, transitions and guards | Human |
| Schema design and constraint choices | Human |
| Scaffolding, components, repositories, migrations SQL | Agent, reviewed |
| Test cases for each transition table row | Agent, from my table |
| Adversarial attack scenarios | Agent generated, human curated and extended |
| i18n plumbing and audio manifest | Agent |
| Accessibility fixes | Agent, human-verified |

---

### T-07 — Fiscal state machine
**Date:** 2026-09-15  ·  **Duration:** 0h 45m  ·  **Spec refs:** 04 §1, 04 §7 (INV-03, INV-05, INV-07), 03 §1, §3, 02 §4, 10 (S-03)

**What I specified (human)**
The fiscal state machine tracks public money claims only and is never influenced by citizen observations.
Transitions: `uninitialized` → `PROMISED` → `COMMITTED` → `DISBURSED` → `AUDITED`.
Enforce invariant INV-07: an unofficial estimate (or project lacking citation) must never reach `COMMITTED`.
Enforce invariant INV-05: illegal transitions return typed domain errors and produce zero side-effects.
Enforce invariant INV-03: every successful transition emits an audit descriptor.
`AUDITED` is terminal. Reconciling requires settled community audit state (`PHYSICALLY_CONFIRMED` or `DISCREPANCY_FLAGGED`).

**Prompt(s) used**
1. "Begin T-07 investigation only. Read canonical specs and determine exact requirements for T-07."
2. "Push existing accepted work, then implement T-07 Fiscal State Machine per 04-state-machine.md §1."

**What the agent produced**
- `src/domain/types.ts` — Common domain types (`FiscalState`, `AuditState`, `SourceConfidence`, `Effect`, `DomainErrorCode`).
- `src/domain/fiscal-lifecycle.ts` — Pure transition function `transition(snapshot, event)` with exhaustive `never` check.
- `tests/unit/fiscal-lifecycle.test.ts` — 19 unit test cases covering all 4 transition rows, illegal transitions, regressions, terminal state, and invariants INV-03, INV-05, INV-07.

**What I rejected and why**
- Rejected an early proposal to invent an `'UNINITIALIZED'` enum value in domain types, because the Postgres `fiscal_state` enum defines only `'PROMISED' | 'COMMITTED' | 'DISBURSED' | 'AUDITED'`. Instead represented uninitialized state cleanly as `fiscal: FiscalState | null` (or `current: FiscalSnapshot | null`).
- Rejected silent no-ops or default fallbacks on invalid transitions: every illegal transition strictly returns `{ ok: false, code, message, effects: [] }`.

**What I wrote by hand**
- Transition table guards and domain error codes mapping directly to `04 §1`.
- Discrimination of required effect descriptors (`AUDIT`, `SET_CONFIDENCE`, `MARK_BULLETIN_ELIGIBLE`).

**Verification (actual output)**
```
$ npx vitest run tests/unit/fiscal-lifecycle.test.ts
  ✓ tests/unit/fiscal-lifecycle.test.ts (19 tests) 13ms
$ npx vitest run tests/unit/architecture.test.ts
  ✓ tests/unit/architecture.test.ts (1 test) 39ms
$ npm run test:unit
  5 passed (38 passed | 7 skipped)
$ npm run typecheck
  tsc --noEmit (exit 0)
$ npm run lint
  eslint . (exit 0)
$ npm run test:e2e
  1 passed (playwright test)
```

**Remaining unverified items**
- Live PostgreSQL/Supabase RLS behavioral verification from T-06 remains unverified due to Docker engine being offline in local environment.

**Commit**
- `add fiscal lifecycle state machine`

---

## 2026-09-15 — T-08 Implementation: Audit State Machine

**Prompt(s) given to the agent**
1. "T-08 [P0] Audit state machine — Every row of 04 §2 tested; DUPLICATE_OBSERVATION produces no transition; TASK_EXPIRED leaves state unchanged; INV-02, INV-03, INV-05, INV-08, and INV-10 pass."

**What the agent produced**
- `src/domain/types.ts` — Extended with audit-specific effect kinds (`CREATE_TASK`, `RECOMPUTE_WITNESS_COUNT`, `NOTIFY_MODERATOR`, `ENQUEUE_MODERATOR`, `PAUSE_PROBATION_CLOCK`, `OPEN_RESPONSE_WINDOW`, `QUEUE_BULLETIN_CORRECTION`, `CLOSE_TASK`).
- `src/domain/audit-lifecycle.ts` — Pure transition function `transition(current, event)` implementing all 8 canonical rows from `04-state-machine.md §2`, plus pure `calculateAgreement` deriving per-question consensus ratios and strict integer-based `>= 2/3` consistency check across distinct clusters.
- `tests/unit/audit-lifecycle.test.ts` — 25 unit tests covering all 8 transition rows, guard failure paths, agreement ratio calculations, duplicate observation suppression (with weight 0), task expiration non-transition, and explicit invariant checks for INV-02, INV-03, INV-05, and INV-10.

**What I rejected and why**
- Rejected accepting frontend pre-computed agreement ratios; domain strictly derives agreement from raw distinct cluster answer maps (`majorityVotes * 3 >= totalVotes * 2`) to ensure frontends cannot spoof consensus.
- Rejected transitioning state on `TASK_EXPIRED`; per spec, audit state remains strictly `AWAITING_THRESHOLD` while closing the task.
- Rejected transitioning state on `DUPLICATE_OBSERVATION`; state remains unchanged, weight set to `0`, and an `OBSERVATION_SUPPRESSED` audit effect is emitted with cluster key.

**What I wrote by hand**
- Pure `calculateAgreement` algorithm with Sybil cluster deduplication.
- Pure `transition` reducer mapping all guards and side effects directly to `04-state-machine.md §2`.

**Verification (actual output)**
```
$ npx vitest run tests/unit/audit-lifecycle.test.ts
  ✓ tests/unit/audit-lifecycle.test.ts (25 tests) 16ms
$ npx vitest run tests/unit/architecture.test.ts
  ✓ tests/unit/architecture.test.ts (1 test) 51ms
$ npm run test:unit
  6 passed (63 passed | 7 skipped)
$ npm run typecheck
  tsc --noEmit (exit 0)
$ npm run lint
  eslint . (exit 0)
$ npm run test:e2e
  1 passed (11.4s)
```

**Remaining unverified items**
- Live PostgreSQL/Supabase RLS behavioral verification from T-06 remains unverified due to Docker engine being offline in local environment.

**Commit**
- `add audit lifecycle state machine`

---

## 2026-09-15 — T-09 Implementation: Probation State Machine

**Prompt(s) given to the agent**
1. "You are implementing T-09 [P0] Probation State Machine for WARD PROOF-LINE / Ubuntu Ledger. Every row of 04 §3 tested; INV-01 passes for every actor role; a DST-boundary case passes; pause/resume on discrepancy preserves remaining duration exactly."

**What the agent produced**
- `src/domain/types.ts` — Extended `DomainErrorCode` with `'E_PROBATION_LOCKED'`; extended `Effect` with `'QUEUE_BULLETIN_FACT'` and optional `clusterKey` in `'SCHEDULE_PING'`.
- `src/domain/probation.ts` — Pure transition function `transition(current: ProbationSnapshot, event: ProbationEvent): ProbationResult` covering all 11 canonical probation events (`BREAKAGE_REPORTED`, `REPAIR_CLAIMED`, `INITIAL_FUNCTION_CONFIRMED`, `CLOCK_ADVANCED`, `FAILURE_REPORTED`, `PROBATION_WINDOW_CLOSED`, `WINDOW_CLOSED_NO_RESPONSE`, `REPAIR_RECLAIMED`, `MANUAL_CLOSE_ATTEMPT`, `LINKED_DISCREPANCY_FLAGGED`, `LINKED_DISCREPANCY_RESOLVED`).
- `tests/unit/probation.test.ts` — 32 unit tests covering all 11 event cases, guard failures, INV-01 early closure rejection across all 6 actor roles, manual close lock for every role, no-response extension limit (max 2 extensions default per 04 §3), reclaim after failure preserving failure history, discrepancy pause/resume exact duration preservation, DST-boundary absolute timestamp invariance, and invariants INV-03 and INV-05.

**What I rejected and why**
- Rejected calendar-day / local wall-clock elapsed duration in favor of absolute epoch millisecond arithmetic (`Date.getTime()`), ensuring daylight saving time shifts do not alter the 7-day probation window.
- Rejected silent override for privileged roles: manual close attempts (`MANUAL_CLOSE_ATTEMPT`) are unconditionally rejected with `E_PROBATION_LOCKED` for all roles (including `ADMIN` and `SYSTEM`).
- Rejected accepting confirmations from arbitrary/new clusters: window closure strictly requires `>= 2` confirmations from original reporter clusters.
- Handled the 2-vs-3 extension spec discrepancy: adopted `maxExtensions: 2` default as authoritative per `04-state-machine.md §3` while keeping the limit configurable on the snapshot.

**What I wrote by hand**
- Exact epoch-millisecond pause/resume arithmetic for linked discrepancy flagging and resolution.
- Confirmation filtering logic verifying cluster keys against `originalReporterClusters` on or after `probationEndsAt`.

**Verification (actual output)**
```
$ npx vitest run tests/unit/probation.test.ts
  ✓ tests/unit/probation.test.ts (32 tests) 19ms
$ npx vitest run tests/unit/architecture.test.ts
  ✓ tests/unit/architecture.test.ts (1 test) 64ms
$ npm run test:unit
  7 passed (95 passed | 7 skipped)
$ npm run typecheck
  tsc --noEmit (exit 0)
$ npm run lint
  eslint . (exit 0)
$ npm run test:e2e
  1 passed (11.0s)
```

**Remaining unverified items**
- Live PostgreSQL/Supabase RLS behavioral verification from T-06 remains unverified due to Docker engine being offline in local environment.

**Commit**
- `add probation lifecycle state machine`

---

## 2026-09-15 — T-10 Implementation: Hash Chain

**Prompt(s) given to the agent**
1. "You are implementing T-10 [P0] Hash Chain for WARD PROOF-LINE / Ubuntu Ledger. Implement the pure audit hash-chain engine required by 03 §10, 04 §7 (INV-03/INV-04), 07 §8, 10 §S-14, 11 §T-10, 14 (ADV-26/ADV-27)."

**What the agent produced**
- `src/domain/audit-chain.ts` — Pure append-only audit hash chain engine:
  - `GENESIS_PREV_HASH`: 64 hexadecimal zeros constant.
  - `canonicalJson(value)`: RFC 8785-compliant deterministic JSON serializer sorting object keys lexicographically at all levels without unnecessary whitespace.
  - `computePayloadHash(payload)`: Computes `sha256(canonical_json(payload))` returning 64-character lowercase hex.
  - `computeEventHash(params)`: Computes `sha256(seq || prev_hash || payload_hash || occurred_at)` with canonical ISO 8601 UTC timestamp normalization.
  - `createAuditEventRecord(...)`: Helper to build cryptographically chained audit event records.
  - `verifyAuditChain(events)`: Pure chain verifier validating empty chains, genesis link, sequence monotonicity, predecessor link continuity, payload hashes, and block hashes, returning exact `firstBreakSeq` on failure (satisfying INV-04, ADV-26).
- `tests/unit/audit-chain.test.ts` — 19 unit test cases covering canonical JSON key ordering, array order preservation, primitive serialization, deterministic hashing, genesis verification, valid chain verification, tampered payload detection (ADV-26 / INV-04), broken prev_hash linkage, altered timestamps, sequence gaps, duplicate sequence numbers, corrupted payload_hash/event_hash, and genesis corruption.

**What I rejected and why**
- Rejected external npm packages for canonical JSON: wrote a clean recursive key-sorted serializer with zero external dependencies, protecting domain isolation.
- Rejected locale-dependent timestamp stringification: normalized all dates strictly to UTC ISO 8601 (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- Rejected building HTTP endpoint `/api/audit/verify` in T-10: per `11-tasks.md` Checkpoint 1 ("the rules core is green with no UI and no API"), T-10 is purely the domain verification engine. The HTTP endpoint will be mounted in Day 2/3.

**What I wrote by hand**
- Chain verification loop with early-exit reporting exact `firstBreakSeq`, `expectedHash`, and `foundHash`.
- Deterministic canonical JSON serializer and SHA-256 pre-image concatenation.

**Verification (actual output)**
```
$ npx vitest run tests/unit/audit-chain.test.ts
  ✓ tests/unit/audit-chain.test.ts (19 tests) 14ms
$ npx vitest run tests/unit/architecture.test.ts
  ✓ tests/unit/architecture.test.ts (1 test) 77ms
$ npm run test:unit
  8 passed (114 passed | 7 skipped)
$ npm run typecheck
  tsc --noEmit (exit 0)
$ npm run lint
  eslint . (exit 0)
$ npm run test:e2e
  1 passed (9.9s)
```

**Remaining unverified items**
- Live PostgreSQL/Supabase RLS behavioral verification from T-06 remains unverified due to Docker engine being offline in local environment.

**Commit**
- `add audit hash chain`

---

## 2026-09-15 — T-11 Implementation: Sybil Cluster Key Derivation

**Prompt(s) given to the agent**
1. "You are implementing T-11 [P0] Cluster key derivation for WARD PROOF-LINE. Implement the pure domain trust primitive required by T-11: derive the Sybil/collusion cluster key deterministically; no database access; no external I/O; no Next.js/Supabase imports; no respondent ID in the derivation."

**What the agent produced**
- `src/domain/sybil.ts` — Pure Sybil cluster key derivation module:
  - `DEFAULT_WARD_FALLBACK_TOKEN`: Constant `'ward:UNSPECIFIED'`.
  - `resolveEffectiveGeoCell(geoCell, wardId)`: Resolves geo_cell; when geo_cell is absent, falls back deterministically to `'ward:' + wardId.trim()`, or to `'ward:UNSPECIFIED'` if wardId is also omitted.
  - `normalizeMsisdnPrefix(input, defaultCountryCode)`: Normalizes phone numbers / prefixes into a 6-digit bucket (e.g. `+254712...` -> `254712`, `254712...` -> `254712`, local `07...` with country code -> `254712`).
  - `getRegistrationCohort(registeredAt)`: Deterministically computes UTC ISO-8601 weekly cohort bucket (`YYYY-Www`).
  - `deriveClusterKey(params)`: Computes `sha256(taskId + effectiveGeoCell + msisdnPrefixBucket + registrationCohort).slice(0, 16)`.
- `tests/unit/sybil.test.ts` — 22 unit test cases covering determinism, hardcoded process-restart fixture, collusion collision, geo_cell sensitivity, telecom prefix sensitivity, registration cohort sensitivity, task isolation, missing geo_cell fallback, MSISDN prefix normalization, exact 16-character lowercase hex format, and respondent ID anti-regression.

**What I rejected and why**
- Strongly rejected including `respondent.id` in `ClusterKeyParams` or derivation: confirmed with `07 §3` and `13 §template` that including `respondent.id` would make every submission its own cluster and silently destroy Sybil resistance.
- Resolved spec discrepancy for missing `geo_cell` fallback: canonical `09 §9` states "missing geo_cell -> falls back to ward-level cell, still deterministic". When `wardId` is available, it resolves to `ward:${wardId}`; when neither `geo_cell` nor `wardId` is available, it resolves to `ward:UNSPECIFIED` (honest, transparent token rather than guessing a synthetic `DEFAULT_WARD`).

**What I wrote by hand**
- Deterministic UTC ISO week calculator (`getRegistrationCohort`) preventing local timezone skew from shifting cohort buckets.
- Strict 16-character hexadecimal extraction and MSISDN prefix normalizer.

**Verification (actual output)**
```
$ npx vitest run tests/unit/sybil.test.ts
  ✓ tests/unit/sybil.test.ts (22 tests) 14ms
$ npx vitest run tests/unit/architecture.test.ts
  ✓ tests/unit/architecture.test.ts (1 test) 116ms
$ npm run test:unit
  9 passed (136 passed | 7 skipped)
$ npm run typecheck
  tsc --noEmit (exit 0)
$ npm run lint
  eslint . (exit 0)
$ npm run test:e2e
  1 passed (11.5s)
```

**Remaining unverified items**
- Live PostgreSQL/Supabase RLS behavioral verification from T-06 remains unverified due to Docker engine being offline in local environment.

**Commit**
- `add sybil cluster key derivation`

---

## 2026-09-15 — T-11 Remediation: MSISDN Trust-Boundary Correction

**Prompt(s) given to the agent**
1. "T-11 REMEDIATION — MSISDN TRUST-BOUNDARY CORRECTION: src/domain/sybil.ts exposes normalizeMsisdnPrefix and accepts full MSISDN formats. Established T-11 trust boundary says domain must never receive full phone numbers. Place transformation at correct application/ingress boundary."

**What I specified (human)**
- Canonical specs: `07-trust-and-security.md §5` ("The domain core never receives a raw MSISDN — enforce with a type (PhoneHash) that has no constructor from a plain string outside infra"), `03-data-model.md §4` (`msisdn_prefix text NOT NULL -- first 6 digits ONLY`), `02-architecture.md`, `10-skills.md` (S-04), `09-agent.md §9`.
- The domain module `src/domain/sybil.ts` must receive only the pre-truncated 6-digit `msisdnPrefixBucket`. It must not normalize or accept full phone numbers.
- Full MSISDN normalization belongs at the channel/ingress boundary (`src/lib/msisdn.ts`), well outside the domain core.

**What the agent produced**
- `src/lib/msisdn.ts` — Ingress boundary phone normalization: `extractMsisdnPrefix(input, defaultCountryCode)` converting E.164, local `07...`, and international digits into the 6-digit prefix bucket.
- `src/domain/sybil.ts` — Pure derivation module strictly enforcing the trust boundary:
  - Replaced `normalizeMsisdnPrefix` with `validateMsisdnPrefixBucket(bucket)`.
  - `validateMsisdnPrefixBucket` asserts `/^\d{6}$/` and rejects full phone numbers (>6 digits) loudly.
  - `ClusterKeyParams` accepts only `msisdnPrefixBucket: string`.
- `tests/unit/sybil.test.ts` — Updated 20 unit test cases passing only 6-digit prefix buckets, plus negative test asserting that full MSISDN formats (`+254712345678`, `254712345678`, `0712345678`) throw immediately when passed to the domain.
- `tests/unit/msisdn.test.ts` — 6 unit tests verifying ingress extraction behavior.

**What I rejected and why**
- Rejected allowing optional `msisdn` in `ClusterKeyParams` with auto-truncation: that would silently erode the domain privacy boundary and make leaking raw PII into domain logs or memory trivial.

**Verification (actual output)**
```
$ npx vitest run tests/unit/sybil.test.ts
  ✓ tests/unit/sybil.test.ts (20 tests) 14ms
$ npx vitest run tests/unit/architecture.test.ts
  ✓ tests/unit/architecture.test.ts (1 test) 71ms
$ npm run test:unit
  10 passed (140 passed | 7 skipped)
$ npm run typecheck
  tsc --noEmit (exit 0)
$ npm run lint
  eslint . (exit 0)
$ npm run test:e2e
  1 passed (10.4s)
```

**Remaining unverified items**
- Live PostgreSQL/Supabase RLS behavioral verification from T-06 remains unverified due to Docker engine being offline in local environment.

**Commit**
- `tighten sybil phone trust boundary`

---

## 2026-09-15 — T-12 Implementation: Triangulation and Agreement

**Prompt(s) given to the agent**
1. "T-12 [P0] IMPLEMENTATION — TRIANGULATION AND AGREEMENT. Implement the pure domain triangulation/trust engine defined by the canonical specs: assignObservationWeight, countWitnesses, calculateAgreement, checkOfficialClaimContradiction, evaluateTriangulation."

**What I specified (human)**
- Canonical specs: `04 §2`, `04 §7` (INV-02, INV-08), `07 §3`, `07 §4`, `10` (S-05), `02 §2, §5`, `03 §4`, `05 §5`, `14 §2` (ADV-01..ADV-05).
- Pure domain implementation in `src/domain/triangulation.ts` with zero database or external I/O imports.
- Invariant INV-02: `witness_count = count(distinct cluster_key) where weight = 1`. Suppressed duplicates (`weight = 0`) never count.
- Multi-witness agreement rule: each question evaluated independently across distinct clusters; agreement passes only when `majorityVotes * 3 >= totalVotes * 2` (strict integer arithmetic); if any question falls below 2/3, overall consensus is inconsistent (`DISCREPANCY_FLAGGED`).
- Official claim contradiction: ≥2 distinct clusters answering `false` to an official claim flags discrepancy immediately (`CONTRADICTS_OFFICIAL_CLAIM`).
- INV-08 domain boundary: pure domain guards prevent duplicate threshold transitions or duplicate audit effects once a task is settled. Physical cross-process serialization with `SELECT ... FOR UPDATE` is explicitly deferred to T-13.
- Backwards compatibility: move `calculateAgreement` and `ClusterAnswer` to `src/domain/triangulation.ts` and re-export from `src/domain/audit-lifecycle.ts` without duplicating logic.

**What the agent produced**
- `src/domain/triangulation.ts` — Pure domain triangulation engine:
  - `assignObservationWeight(existingClusterKeys, incomingClusterKey)`: returns `{ weight: 1, isDuplicate: false }` for new clusters, or `{ weight: 0, isDuplicate: true, reasonKey: 'observation.cluster_already_counted' }` for duplicates.
  - `countWitnesses(observations)`: counts distinct cluster keys with `weight = 1`.
  - `calculateAgreement(clusterAnswers)`: computes per-question majority ratio using integer arithmetic (`majorityVotes * 3 >= totalVotes * 2`).
  - `checkOfficialClaimContradiction(clusterAnswers, officialClaims)`: detects if ≥2 distinct clusters contradict an official assertion.
  - `evaluateTriangulation(params)`: evaluates threshold and maps to canonical `AuditEvent` recommendations (`THRESHOLD_MET_CONSISTENT`, `THRESHOLD_MET_CONFLICTING`, `CONTRADICTS_OFFICIAL_CLAIM`, or awaiting).
- `src/domain/audit-lifecycle.ts` — Updated to import and re-export `calculateAgreement`, `ClusterAnswer`, and `AgreementResult` from `./triangulation`.
- `tests/unit/triangulation.test.ts` — 26 unit test cases covering weighting, duplicate suppression (ADV-01), INV-02, agreement thresholds (ADV-04, ADV-05), integer precision boundaries, official contradictions, evaluator mappings, and domain settled-state guards.

**What I rejected and why**
- Rejected implementing an in-memory lock in the domain: concurrency locks belong to PostgreSQL transactions (`SELECT ... FOR UPDATE`) in T-13.
- Rejected duplicating `calculateAgreement` across domain files.

**Verification (actual output)**
```
$ npx vitest run tests/unit/triangulation.test.ts
  ✓ tests/unit/triangulation.test.ts (26 tests) 20ms
$ npx vitest run tests/unit/audit-lifecycle.test.ts
  ✓ tests/unit/audit-lifecycle.test.ts (25 tests) 18ms
$ npx vitest run tests/unit/architecture.test.ts
  ✓ tests/unit/architecture.test.ts (1 test) 75ms
$ npm run test:unit
  11 passed (166 passed | 7 skipped)
$ npm run typecheck
  tsc --noEmit (exit 0)
$ npm run lint
  eslint . (exit 0)
$ npm run test:e2e
  1 passed (9.5s)
```

**Remaining unverified items**
- Live PostgreSQL/Supabase RLS behavioral verification from T-06 remains unverified due to Docker engine being offline in local environment.

**Commit**
- `add triangulation and agreement`
