# 11 — Build Tasks

Tasks are atomic, ordered, and dependency-tagged. Each is one plan → one approval → one or more atomic commits.
`[P0]` must ship. `[P1]` ships if on schedule. `[P2]` only if ahead. Cut per `17-scope-control.md`.

Batch boundaries are approval checkpoints: bring the evidence summary for the whole batch before moving on.

---

## DAY 1 — Foundation and the rules core

### Batch 1A — project and database

**T-01 [P0] Scaffold the project** · skill S-01 · deps none
Next.js 15 + TS strict + Tailwind + shadcn + Vitest + Playwright + ESLint with the `no-restricted-imports` rule protecting `/src/domain`. GitHub repo created, CI workflow stubbed.
*Accept:* `npm run dev`, `npm run typecheck`, `npm run test` all succeed on an empty suite; CI green on first push.

**T-02 [P0] Domain boundary guard** · deps T-01
ESLint rule + `tests/unit/architecture.test.ts` that reads the import graph and fails if `/src/domain` imports from `/src/infra`, `next/*` or `@supabase/*`.
*Accept:* deliberately adding a forbidden import fails the test.

**T-03 [P0] Injectable clock** · deps T-01
`infra/clock` with `now()`, plus a test clock supporting `travel(ms)`. Lint rule banning `new Date()` / `Date.now()` outside it.
*Accept:* a test travels 7 days forward in <10 ms.

**T-04 [P0] Migrations: enums, jurisdiction, receipts** · skill S-02 · deps T-01
Migrations 001–003 per `03-data-model.md` §1–3, RLS enabled in the same migration as each table.
*Accept:* `supabase db reset` clean; every new table has RLS on.

**T-05 [P0] Migrations: tasks, services, probation, voice, bulletins, outbox, audit, idempotency** · skill S-02 · deps T-04
Migrations 004–011, including the `sustained_requires_probation_end` CHECK, the audit append-only rules, and the `purge_window` CHECK.
*Accept:* attempting an early `VERIFIED_SUSTAINED` via raw SQL is rejected by the constraint; `UPDATE audit_event` silently affects zero rows.

**T-06 [P0] RLS policy test** · skill S-02 · deps T-05
`tests/unit/rls.test.ts` with a real anon client.
*Accept:* zero rows from `respondent`, `voice_note`, `observation`, `audit_event`; zero rows from `divergence_aggregate` while `k_satisfied = false`; a `pg_tables` query proves no table lacks RLS.

### Batch 1B — the rules core

**T-07 [P0] Fiscal state machine** · skill S-03 · deps T-03
*Accept:* every row of `04 §1` tested; INV-07 passes.

**T-08 [P0] Audit state machine** · skill S-03 · deps T-03
*Accept:* every row of `04 §2` tested, including `DUPLICATE_OBSERVATION` producing no transition and `TASK_EXPIRED` leaving state unchanged.

**T-09 [P0] Probation state machine** · skills S-03, S-08 · deps T-03
*Accept:* every row of `04 §3` tested; INV-01 passes for **every** actor role; a DST-boundary case passes; pause/resume on discrepancy preserves remaining duration exactly.

**T-10 [P0] Hash chain** · skill S-14 · deps T-05
*Accept:* INV-04 passes; a tampered fixture is detected at the correct `seq`.

> **Checkpoint 1 (end of Day 1):** the rules core is green with no UI and no API. If the three machines are not passing their full transition tables, you are behind — cut per `17`.

---

## DAY 2 — Channels and the trust model

**T-11 [P0] Cluster key derivation** · skill S-04 · deps T-03
*Accept:* 11+ cases; deterministic across restarts; documented fallback when `geo_cell` is absent.

**T-12 [P0] Triangulation and agreement** · skill S-05 · deps T-08, T-11
*Accept:* INV-02; the ≥2/3 agreement rule produces `DISCREPANCY_FLAGGED` correctly; duplicate clusters yield `weight = 0`.

**T-13 [P0] Repositories and app-services** · deps T-05, T-07…T-12
One repository per aggregate; app-services orchestrating load → domain → persist → effects → audit, inside transactions with `select … for update`.
*Accept:* INV-03 and INV-08 pass; a concurrency test with two simultaneous threshold-completing observations produces exactly one transition event.

**T-14 [P0] USSD session reducer** · skill S-06 · deps T-13
*Accept:* CH-05, CH-07 pass; full menu tree from `06 §2` navigable; invalid input re-prompts without ending the session.

**T-15 [P0] `/api/ussd` endpoint** · deps T-14
Real Africa's Talking payload contract in, `CON`/`END` out.
*Accept:* a scripted session completes a proof task end to end via HTTP; CH-02 passes (≤182 chars, all locales).

**T-16 [P0] `/api/observations` + idempotency middleware** · deps T-13
*Accept:* replaying the same `clientIdempotencyKey` creates one row; the duplicate-cluster response carries `counted: false` and a reason key.

**T-17 [P0] Feature-phone simulator** · skill S-07 · deps T-15
*Accept:* a judge-legible session runs end to end; **"second phone, same area"** leaves the witness counter unchanged and displays the duplicate message; the HTTP transcript panel shows the literal payload.

> **Checkpoint 2 (end of Day 2 — GO/NO-GO):** a proof task can be answered on the simulator, three distinct clusters move the state, and a fourth same-cluster submission does not. **If this is not working by the end of Day 2, stop adding features and fix it.** This is the demo.

---

## DAY 3 — Receipts, ingestion, probation loop

**T-18 [P0] Seed data and scenario fixture** · skill S-20 · deps T-05
*Accept:* `npm run seed:demo` is idempotent and produces exactly the demo state.

**T-19 [P0] Receipt API + public receipt page** · deps T-13, T-18
Per `05 §4` and `08 §5`, including the source block, the unofficial-estimate band and the provenance sentence with an audio control.
*Accept:* a cited line shows issuer/page/hash; an uncited line shows `NO SOURCE DOCUMENT` and cannot reach `COMMITTED`.

**T-20 [P0] Probation endpoints and the refusal** · deps T-09, T-13
`claim`, `close` (always rejected before window end), `recheck`.
*Accept:* `close` returns `409 E_PROBATION_LOCKED` for admin; the attempt is written to the audit chain; `claim` response carries `closureAvailable: false` with a reason key.

**T-21 [P0] Probation cron: pings and closures** · deps T-20
Day-3 and Day-7 pings to original reporter clusters only; window evaluation.
*Accept:* running the cron twice in a minute produces no duplicate pings; a failure report during probation flips to `PROBATION_FAILED` immediately.

**T-22 [P0] Console: project board + repair claim** · deps T-19, T-20
*Accept:* the board shows fiscal/audit state, witness `n/target` and the probation countdown; recording a claim visibly does **not** turn the project green.

**T-23 [P1] Document ingestion with human confirmation** · skill S-09 · deps T-19
*Accept:* a PDF and a CSV both yield reviewable candidates; nothing persists unconfirmed; the archived bytes' `sha256` is stored.

**T-24 [P0] Log redaction** · skill S-15 · deps T-13
*Accept:* the adversarial log test passes. **Blocker if not.**

> **Checkpoint 3 (end of Day 3 — the hard gate):** the demo's two key moments both work live — the suppressed duplicate, and the refused early close. See `17 §4`. If either is broken, everything else stops until they are fixed.

---

## DAY 4 — Divergence, bulletin, offline, adversarial suite

**T-25 [P1] Statutory rule card API + USSD path** · deps T-15, T-19
*Accept:* the card renders statutory fee, documents, expected visits and the refusal script, with audio.

**T-26 [P1] Outcome codes + k-anonymous aggregates** · skill S-10 · deps T-25
*Accept:* below-k returns a suppression notice with no counts anywhere; RLS independently blocks; the differencing test cannot isolate a single report.

**T-27 [P1] Two-ledger divergence card** · skill S-11 · deps T-26
*Accept:* two separate DOM containers with two provenance lines; no merged sentence anywhere in the templates.

**T-28 [P1] Bulletin compile + moderator approval + gated export** · skill S-12 · deps T-26
*Accept:* INV-06; approval re-validates k at approval time; a banned word fails frame validation; export before approval returns `409`.

**T-29 [P1] Offline observation outbox** · skill S-13 · deps T-16
*Accept:* the Playwright offline test submits three observations offline and produces exactly three server rows after reconnect; double flush creates no duplicates.

**T-30 [P0] Adversarial test suite (30 cases)** · skill S-17 · deps everything above
*Accept:* all 30 pass as a separately-named CI job with its own README.

**T-31 [P1] IVR endpoint + audio playback in the simulator** · skill S-18 · deps T-15
*Accept:* CH-03, CH-04 pass; numbers are stitched correctly for six fixture amounts per locale.

**T-32 [P2] Voice note capture + moderation + TTL purge** · skills S-16, S-18 · deps T-31
*Accept:* blob is genuinely deleted after TTL; no transcript column exists.

---

## DAY 5 — Portability, accessibility, submission

**T-33 [P1] Second country config** · skill S-21 · deps T-19
*Accept:* a KE ward renders with KES and different admin tier labels; a test asserts no code path branches on country code.

**T-34 [P1] Accessibility audit and fixes** · skill S-19 · deps all UI
*Accept:* zero critical/serious axe violations; committed as a separate PR with the before/after report.

**T-35 [P0] README + AI build log finalisation** · deps all
*Accept:* every section of `18 §2` present; the build log has an entry per task including rejected outputs.

**T-36 [P0] Demo recording** · deps T-18, T-30
*Accept:* the sequence in `12-demo-script.md` recorded in ≤90 s, ≤250 MB, with both key frames clearly legible.

**T-37 [P0] Pitch deck PDF** · deps T-36
*Accept:* 10 slides per `18 §3`; ≤100 MB.

**T-38 [P0] Written summary** · deps T-35
*Accept:* the four required pillars as literal headings; the "verified means" paragraph present; the AI-usage table with a rejected-output column.

**T-39 [P2] Live Africa's Talking sandbox dial** · deps T-15
Only if everything above is done. A live dial is a bonus, never a dependency.

---

## Dependency summary

```
T-01 ─┬─ T-02
      ├─ T-03 ─┬─ T-07 ─┐
      │        ├─ T-08 ─┤
      │        ├─ T-09 ─┤
      │        └─ T-11 ─┴─ T-12 ─┐
      └─ T-04 ── T-05 ─┬─ T-06   │
                       ├─ T-10   │
                       └─ T-18   │
                                 ├─ T-13 ─┬─ T-14 ── T-15 ── T-17
                                 │        ├─ T-16 ── T-29
                                 │        ├─ T-19 ─┬─ T-22
                                 │        │        ├─ T-23
                                 │        │        └─ T-25 ── T-26 ─┬─ T-27
                                 │        │                        └─ T-28
                                 │        ├─ T-20 ── T-21
                                 │        └─ T-24
                                 └─ T-30 ── T-36 ── T-37
```

## Per-task definition of done

A task is done only when **all** of these are true:

- [ ] Plan was approved before code was written
- [ ] Acceptance criteria demonstrably met, with pasted command output
- [ ] Tests written in the same commit as the behaviour
- [ ] `typecheck`, `lint`, `unit` and `adversarial` all green locally
- [ ] Atomic commits with lowercase human-sounding messages, no prefixes, no AI footers
- [ ] `/docs/ai-build-log.md` entry appended, including anything you rejected
- [ ] No new dependency without a recorded justification
- [ ] No spec rule violated; if one was in the way, it was escalated, not worked around
