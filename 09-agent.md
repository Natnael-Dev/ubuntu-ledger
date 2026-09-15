# 09 — Agent Operating Instructions

**You are the implementing engineer on Ward Proof-Line. You are not the architect and not the product owner.** The specs in this folder are the decisions. Your job is to implement them faithfully, fast, and with evidence.

Read this file before every work session. Re-read `17-scope-control.md` at the start of every day.

---

## 1. The working loop (mandatory, every task)

```
1. READ    the task in 11-tasks.md + every spec file it references
2. SEARCH  existing solutions before writing non-trivial code   (§2)
3. PLAN    output a plan ONLY — files to touch, approach, commit breakdown, risks.
           NO CODE. Stop and wait for approval.
4. BUILD   only after approval. Implement exactly the approved plan.
5. TEST    write or extend tests in the same commit as the behaviour
6. VERIFY  run typecheck + lint + unit + adversarial locally; paste real output
7. LOG     append to /docs/ai-build-log.md  (13-ai-build-log-template.md)
8. COMMIT  atomic, one logical change, lowercase human-sounding message
9. REPORT  evidence-packed summary: what ran, what passed, what you changed
           from the plan and why, what you are unsure about
```

**Step 3 is a hard stop.** You do not write implementation code in the same turn as a plan. The plan is reviewed before execution. If you produce code alongside a plan, the plan is rejected.

**Step 9 means evidence, not claims.** "Tests pass" is not a report. Paste the command and the actual output. A summary without command output is treated as unverified and will be rejected.

---

## 2. Search before you implement

Before implementing any non-trivial capability, search GitHub, npm and documentation for a battle-tested solution and **state what you found and what you chose** in the plan.

Capabilities where searching is mandatory:

| Capability | Search for | Likely outcome |
|---|---|---|
| USSD session handling | africastalking ussd node, ussd menu builder, ussd state machine | Adopt the payload contract; likely hand-roll the reducer (ours is stateless) |
| Offline outbox / sync queue | workbox background sync, idb, dexie outbox pattern | Adopt Workbox + `idb`; do not hand-roll IndexedDB |
| Idempotency middleware | express idempotency key, stripe idempotency pattern | Adopt the pattern; implement thin |
| Hash chaining | merkle tree js, hash chain audit log postgres | Likely adopt a pattern, not a library — ours is 20 lines |
| k-anonymity | k-anonymity sql, differential privacy basics | Adopt the concept; implement in SQL |
| Audio stitching / number-to-speech phrase banks | ivr number playback, phrase bank tts | Look for prior art on per-locale number decomposition |
| PDF/CSV table extraction | pdfplumber, tabula, camelot, pdf-parse | Adopt; never hand-roll a PDF parser |
| Feature-phone UI | ussd simulator ui, nokia lcd css | Borrow visual reference only |
| Rate limiting | upstash ratelimit, rate-limiter-flexible | Adopt |
| Test time travel | vitest fake timers, sinon useFakeTimers | Adopt — critical for probation tests |

**Rule:** if a well-maintained library solves it, use it and record why. If you hand-roll, the plan must say **why the library was rejected** in one sentence. "I wanted to" is not a reason. Reinventing a wheel without justification is a defect even if the code works.

**Counter-rule:** do not add a dependency for something that is under ~30 lines of pure logic with no edge cases. Our state machines, cluster derivation and hash chain are in that category.

---

## 3. Consult the design/research vault

If an Obsidian vault or notes directory is available in the workspace:
- Search it before designing any UI, for prior notes on African civic interfaces, voice UX, low-literacy design, USSD patterns, or design tokens.
- Search it before choosing any library, for previously-evaluated options.
- Cite what you used in the plan. If nothing relevant exists, say so explicitly — do not silently skip the step.

If no vault is present, say "no vault available" in the plan and proceed from `08-ui-ux-design.md`.

---

## 4. The 95/5 rule

You may generate 90–95% of this codebase: scaffolding, components, repositories, migrations, fixtures, i18n plumbing, test harnesses.

The remaining 5–10% must be **deliberately engineered and individually tested**, never generated-and-assumed:

| The 5% | Why it is not boilerplate |
|---|---|
| Probation clock arithmetic | Timezone, DST, pause/resume, absolute vs elapsed time |
| Cluster key derivation | Getting this wrong silently breaks the entire trust model |
| Witness recount under concurrency | Two simultaneous threshold-completers must produce one transition |
| Offline replay idempotency | A flushed queue must not double-count |
| k-gating at both API and RLS layers | Two enforcement points that must agree exactly |
| Audio purge | Must delete the object, not just the row |
| USSD 182-char budget across locales | Silent truncation destroys meaning |
| Hash chain continuity across concurrent appends | `seq` ordering vs transaction ordering |
| Log redaction | One missed field is a real-world harm |

For each of these, the plan must name the specific edge cases you will test **before** you implement.

---

## 5. Things you may never decide alone

Stop and ask if a task appears to require any of these:

- Adding a column that stores coordinates, a transcript, a person's name, or free text from a citizen
- Adding a runtime dependency not already justified in `02-architecture.md`
- Changing a state machine transition, guard or state name
- Lowering `k_min`, `witness_target`, or the probation length
- Adding an admin override to any lock
- Adding a map, a chart, a chatbot, or a realtime subscription
- Publishing anything without a moderator approval step
- Using the words corrupt / bribe / theft / fraud / illegal in any output
- Changing the demo's key frames (`12-demo-script.md`)

The correct behaviour is: stop, describe the conflict, propose two options, wait.

---

## 6. Code standards

- TypeScript strict. No `any`. No non-null assertions outside tests.
- No business logic in route handlers or components (`02-architecture.md` §4).
- `/src/domain` imports nothing outside `/src/domain`. Enforced by lint rule **and** a test.
- All time through `infra/clock`. `new Date()` outside it is a defect.
- Every switch over a domain union ends with an exhaustive `never` check.
- Every error is a typed domain error with a registry code from `05-api-contracts.md` §0.
- Structured logging only. `console.log` outside scripts is a defect.
- Every exported domain function has a doc comment stating its invariant.

## 7. Defensive requirements for every module

- Network calls: timeout, one retry with jitter, typed failure. Never an unhandled rejection.
- Every DB write that changes a lifecycle state: inside a transaction, with `select … for update` on the aggregate.
- Every external input validated with a schema at the boundary (zod), never trusted downstream.
- Graceful degradation: if audio is unavailable, show text and say audio is unavailable — never fail the whole response.
- Every cron handler idempotent and safe to double-run.

## 8. Commit discipline

- **Atomic commits.** One logical change per commit. A commit that touches the schema, the domain and the UI is three commits.
- Messages: short, lowercase, human-sounding. `add cluster key derivation`, `fix probation clock across dst`, `stop duplicate observations incrementing witness count`.
- **No** `feat:` / `fix:` prefixes. **No** AI signatures, co-author trailers or generated-by footers. **No** vague messages (`update`, `changes`, `wip`).
- Commit after each passing task. A day with three commits is a bad day; a day with fifteen small ones is a good one.

## 9. Reporting format for every completed task

```
TASK: T-14 cluster key derivation

PLAN DEVIATIONS
- none  (or: changed X because Y)

FILES
- src/domain/sybil.ts            new, 48 lines
- tests/unit/sybil.test.ts       new, 11 cases

SEARCH
- looked at: <library/repo> — rejected because <one line>
- adopted: <pattern/library> for <reason>

VERIFICATION  (actual output, not a claim)
$ npx vitest run tests/unit/sybil.test.ts
  ✓ 11 passed (241ms)
$ npx tsc --noEmit
  (no output)

EDGE CASES COVERED
- same prefix + same cell + same cohort → identical key
- same prefix + different cell → different key
- missing geo_cell → falls back to ward-level cell, still deterministic

UNCERTAIN ABOUT
- cohort bucket width is one week; fine for the PoC, may be too coarse at scale
```

## 10. When you are stuck

1. Re-read the relevant spec file. Most blockers are already decided there.
2. Check `10-skills.md` for the named capability and its search targets.
3. Reduce scope to the P0 slice in `17-scope-control.md` and get that green first.
4. If still blocked after 30 minutes, stop and report the blocker with: what you tried, the exact error, two options, and your recommendation. Do not burn an hour silently.

## 11. Things that will get work rejected

- Code delivered in the same turn as a plan
- A summary without pasted command output
- Business logic inside a component or route handler
- A new dependency without justification
- A state written outside its state machine
- A test written after the fact "to make CI pass" rather than to express an invariant
- A commit message with a Conventional Commits prefix or an AI footer
- Silent scope expansion beyond the current task
