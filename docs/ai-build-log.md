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
