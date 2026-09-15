# 13 — AI Build Log Template

Copy this to `/docs/ai-build-log.md` on Day 1 and append after **every** task. This file is a scored artifact under AI Coding Usage (25%) and is cited directly in the written summary.

**The column judges care about most is "What I rejected."** A log with no rejections reads as a log nobody wrote. Honesty here is worth more than volume.

---

## Header (fill once)

```markdown
# AI Build Log — Ward Proof-Line

Developer: <name> (solo)
Tools: <agent name/version>, <editor>, <model>
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
```

---

## Per-task entry template

```markdown
### T-<id> — <task name>
**Date:** 2026-09-__  ·  **Duration:** __h __m  ·  **Spec refs:** 03 §4, 07 §3

**What I specified (human)**
> One paragraph, in my words, of the behaviour and constraints I handed the agent.
> Include the invariant that must hold.

**Prompt(s) used**
> Verbatim or lightly trimmed. If several iterations, list them and say what changed
> between them and why the earlier one was insufficient.

**What the agent produced**
- `src/domain/sybil.ts` — 48 lines, generated
- `tests/unit/sybil.test.ts` — 11 cases, generated from my edge-case list

**What I rejected and why**   ← the most important field; never leave empty
- Rejected the agent's first cluster key because it included `respondent.id`, which
  would have made every submission its own cluster and silently disabled sybil
  resistance entirely. The bug was invisible in the passing tests it also generated.
- Rejected a suggested `admin_override` flag on probation closure. The lock is the product.

**What I wrote by hand**
- The cluster composition itself (which signals, in which order, and why coarse)
- The fallback when `geo_cell` is missing

**Verification (actual output)**
```
$ npx vitest run tests/unit/sybil.test.ts
  ✓ 11 passed (241ms)
$ npx tsc --noEmit
```

**Judgement call recorded**
> Cohort bucket width is one week. Too coarse at national scale; correct for a ward-level
> PoC. Deliberate, not an oversight.

**Commits**
- `add cluster key derivation`
- `stop duplicate observations incrementing witness count`
```

---

## Worked example (use as the quality bar)

```markdown
### T-09 — Probation state machine
**Date:** 2026-09-16 · **Duration:** 3h 10m · **Spec refs:** 04 §3, 07 §10 T2

**What I specified (human)**
A repair cannot reach VERIFIED_SUSTAINED before probation_ends_at, under any actor,
any event ordering, any timezone. Confirmation must come from the original reporters'
clusters only. A discrepancy on the linked project pauses the clock and resumes it with
the exact remaining duration. Invariant INV-01 must be enforced in three independent
places so an application bug cannot defeat it.

**Prompt(s) used**
1. "Implement transition() for the probation machine from this transition table.
   Pure function, snapshot in, Result<next, Effect[]> out. Exhaustive never check."
2. (after review) "The window-closed branch treats elapsed ticks as the clock. Rewrite
   using absolute timestamps from the injected clock; add a DST-crossing test case."

**What the agent produced**
- `src/domain/probation.ts` — 132 lines
- `tests/unit/probation.test.ts` — 24 cases covering every table row
- `tests/unit/probation-dst.test.ts` — 3 cases

**What I rejected and why**
- First implementation computed the window with elapsed milliseconds accumulated per
  tick. Correct in tests, wrong in production: a missed cron run would under-count the
  window and could close probation early. Replaced with absolute timestamp comparison.
- Agent proposed skipping the DB CHECK constraint since "the domain already guards it."
  Rejected — the whole point is defence in depth against my own bugs.
- Agent suggested auto-closing at window end with zero confirmations. Rejected: silence
  is not confirmation. Added the WINDOW_CLOSED_NO_RESPONSE extension path instead.

**What I wrote by hand**
- The pause/resume arithmetic on discrepancy
- The rule that re-check pings go only to original reporter clusters

**Verification**
```
$ npx vitest run tests/unit/probation*.test.ts
  ✓ 27 passed (388ms)
$ psql -c "update repair_ticket set state='VERIFIED_SUSTAINED' where id='...';"
  ERROR:  new row violates check constraint "sustained_requires_probation_end"
```

**Judgement call recorded**
Probation is 7 days for the PoC. Real deployment should vary by asset class — a generator
needs 14, a latrine door needs 3. Left configurable, defaulted to 7, not tuned.

**Commits**
- `add probation transition table`
- `use absolute time for probation window`
- `reject early close at the database level`
```

---

## Running tallies (update daily)

```markdown
## Daily summary
| Day | Tasks done | Agent-generated files | Files I rewrote | Rejections recorded | Tests added |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |
| 4 |  |  |  |  |  |
| 5 |  |  |  |  |  |
```

## Artifacts to link at the end

- [ ] The adversarial suite and its threat-list README
- [ ] The accessibility before/after PR
- [ ] The CI run showing all jobs green
- [ ] The architecture boundary test
- [ ] The log-redaction test
- [ ] The commit graph (many small commits, human-worded)

## The sentence that goes in the written summary

> The concept, the trust model and every state machine transition in this project are mine.
> The agent generated implementation, tests and attack scenarios against my specification,
> and this log records what I accepted, what I rewrote, and — in twelve specific cases —
> what I rejected because it would have silently weakened the verification model.
