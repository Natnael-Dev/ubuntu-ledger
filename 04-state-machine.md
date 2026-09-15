# 04 — State Machines

## 0. Why three machines, not one

The original design sketched a single "unified state machine." That is not implementable, because three genuinely independent things are changing at different rates:

- what the **money** has done (fiscal),
- what the **community has verified** (audit),
- whether a **repair survived time** (probation).

Collapsing them produces illegal states such as "disbursed but never dispatched but sustained." Therefore the system runs **three orthogonal machines** and derives a single **narrative state** for display. The narrative state is a *view*, never a stored source of truth.

Every machine is implemented in `/src/domain` as a declarative transition table plus a pure `transition(current, event, context) → Result<next>`. Illegal transitions return an error; they never throw and never silently no-op.

---

## 1. Fiscal lifecycle (`project.fiscal`)

Tracks the public money claim only. Never influenced by citizen observations.

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| — | `RECEIPT_INGESTED` | `PROMISED` | ingest reviewer confirmed | audit event; receipt becomes publicly readable |
| `PROMISED` | `BUDGET_LINE_CONFIRMED` | `COMMITTED` | `source_document_id` present **and** `source_page` present | confidence set to `OFFICIAL_CITED`; audit |
| `COMMITTED` | `DISBURSEMENT_RECORDED` | `DISBURSED` | disbursement record cites a document | audit |
| `DISBURSED` | `RECONCILED` | `AUDITED` | project `audit` state ∈ {`PHYSICALLY_CONFIRMED`,`DISCREPANCY_FLAGGED`} | audit; eligible for bulletin |

**Rules**
- A project with no `source_document_id` may exist but is pinned at `PROMISED` with `confidence = 'UNOFFICIAL_ESTIMATE'` and is rendered with that label everywhere. It may **never** reach `COMMITTED`.
- `AUDITED` does not mean "clean." It means the fiscal record has been reconciled against community evidence, whatever that evidence said.

---

## 2. Audit lifecycle (`project.audit`)

Tracks community verification. Never influenced by contractor claims.

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| `NOT_DISPATCHED` | `TASK_CREATED` | `TASK_DISPATCHED` | project has ≥1 asset; asset_type has a task template | create `inspection_task`; enqueue outbox to ward monitors |
| `TASK_DISPATCHED` | `FIRST_OBSERVATION` | `AWAITING_THRESHOLD` | observation accepted with `weight = 1` | recompute `witness_count`; audit |
| `AWAITING_THRESHOLD` | `THRESHOLD_MET_CONSISTENT` | `PHYSICALLY_CONFIRMED` | `witness_count ≥ witness_target` **and** answer agreement ≥ 2/3 on every question | audit; notify moderator; eligible for bulletin |
| `AWAITING_THRESHOLD` | `THRESHOLD_MET_CONFLICTING` | `DISCREPANCY_FLAGGED` | `witness_count ≥ witness_target` **and** agreement < 2/3 on any question | audit; moderator queue; **pause any linked probation clock** |
| `AWAITING_THRESHOLD` | `CONTRADICTS_OFFICIAL_CLAIM` | `DISCREPANCY_FLAGGED` | ≥2 distinct clusters answer "no" to a question the official record asserts | audit; official response window opens (72 h) |
| `PHYSICALLY_CONFIRMED` | `LATE_CONTRADICTION` | `DISCREPANCY_FLAGGED` | ≥2 new distinct clusters contradict, within 30 days | audit; bulletin correction queued |
| `AWAITING_THRESHOLD` | `TASK_EXPIRED` | `AWAITING_THRESHOLD` | `now > expires_at` and threshold unmet | close task; state **unchanged**; surface "not enough reports yet" |
| any | `DUPLICATE_OBSERVATION` | *(no transition)* | `cluster_key` already present for this task | store with `weight = 0`; audit as `OBSERVATION_SUPPRESSED` |

**Critical rule — the demo hinges on this:** a second, third or tenth observation from an existing `cluster_key` **must not** increment `witness_count`. `witness_count = count(distinct cluster_key) where weight = 1`.

**Agreement rule:** for each question, compute the majority answer across distinct clusters. Agreement = (clusters agreeing with majority) / (clusters answering). If any question falls below 2/3, the result is `DISCREPANCY_FLAGGED`, not `PHYSICALLY_CONFIRMED`. Conflict is an output, not an error.

---

## 3. Probation lifecycle (`repair_ticket.state`)

The only machine where **time itself is a verifier**.

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| — | `BREAKAGE_REPORTED` | `REPORTED_BROKEN` | ≥1 observation or console entry | record original reporter cluster set |
| `REPORTED_BROKEN` | `REPAIR_CLAIMED` | `REPAIR_CLAIMED` | claim recorded in console with `claimed_by` | audit; **no green state, no closure** |
| `REPAIR_CLAIMED` | `INITIAL_FUNCTION_CONFIRMED` | `PROBATION_DAY_0` | ≥1 distinct-cluster confirmation the asset currently works | set `probation_started_at = now`, `probation_ends_at = now + probation_days`; schedule Day-3 and Day-7 pings |
| `PROBATION_DAY_0` | `CLOCK_ADVANCED` | `PROBATION_ACTIVE` | `now > probation_started_at` | — |
| `PROBATION_ACTIVE` | `FAILURE_REPORTED` | `PROBATION_FAILED` | ≥1 distinct-cluster report that the asset stopped working | audit; increment `probation_failure_count` on the claiming org; queue bulletin fact |
| `PROBATION_ACTIVE` | `PROBATION_WINDOW_CLOSED` | `VERIFIED_SUSTAINED` | `now ≥ probation_ends_at` **and** ≥2 distinct-cluster confirmations dated on/after `probation_ends_at` **and** zero unresolved failure reports | audit; fiscal eligible for `AUDITED` |
| `PROBATION_ACTIVE` | `WINDOW_CLOSED_NO_RESPONSE` | `PROBATION_ACTIVE` | window closed, <2 confirmations | extend by 3 days, max twice, then `PROBATION_FAILED` with reason `no_verification` |
| `PROBATION_FAILED` | `REPAIR_RECLAIMED` | `REPAIR_CLAIMED` | new claim recorded | probation restarts at full length; failure history retained |
| any | `MANUAL_CLOSE_ATTEMPT` | *(rejected)* | — | return `E_PROBATION_LOCKED`; audit the **attempt** |

**Hard rules**
1. **No role — not admin, not moderator, not system — may transition to `VERIFIED_SUSTAINED` before `probation_ends_at`.** Enforced in three places: domain guard, app-service check, and the DB `CHECK` constraint `sustained_requires_probation_end`. Triple enforcement is intentional; demonstrate it.
2. Re-check pings go **only to the original reporters' clusters**, never to a fresh pool. The people who said it was broken are the people who close it.
3. A `DISCREPANCY_FLAGGED` audit state on the linked project **pauses** the probation clock (`probation_ends_at` shifts by the pause duration). A disputed asset cannot quietly time out into success.

---

## 4. Bulletin lifecycle (`radio_bulletin.state`)

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| — | `WEEKLY_COMPILE` | `DRAFT` | ≥1 k-gated fact available | compose script from template; audit |
| `DRAFT` | `MODERATOR_APPROVE` | `APPROVED_FOR_BROADCAST` | actor role ∈ {moderator, admin}; every fact still k-satisfied **at approval time**; no fact references an individual | record moderator identity + timestamp in audit chain |
| `DRAFT` | `MODERATOR_REJECT` | `REJECTED` | reason supplied | audit |
| `APPROVED_FOR_BROADCAST` | `BROADCAST_CONFIRMED` | `BROADCAST_CONFIRMED` | presenter confirmation recorded | audit |
| `APPROVED_FOR_BROADCAST` | `FACT_INVALIDATED` | `DRAFT` | any underlying fact changed state | revoke approval; audit; **must be re-approved** |

**Hard rule:** no path exists from `DRAFT` to any exported artifact. Export (text, print, audio) is gated on `APPROVED_FOR_BROADCAST`. There is no auto-approve, no timeout-approve, no admin bypass. A script that reaches air without a named human approver is the single worst failure this product can have.

---

## 5. Voice note lifecycle (`voice_note.state`)

| From | Event | To | Guard | Side effects |
|---|---|---|---|---|
| — | `AUDIO_CAPTURED` | `AUDIO_RECORDED` | ≤60 s duration | set `purge_after = now + 48h` |
| `AUDIO_RECORDED` | `INTENT_EXTRACTED` | `INTENT_STRUCTURED` | structured answers derived (DTMF, or moderator-assisted) | store booleans only; no transcript |
| `INTENT_STRUCTURED` | `MODERATOR_CLEARED` | `HUMAN_AUDITED` | moderator confirms no PII, no named individual, no allegation | contributes to aggregates |
| `INTENT_STRUCTURED` | `MODERATOR_REJECTED` | `REJECTED` | — | excluded from all aggregates; still purged on schedule |
| any | `TTL_REACHED` | `PURGED` | `now ≥ purge_after` | delete blob; null `storage_path`; set `purged_at`; audit |

`PURGED` is terminal and unconditional. There is no retention extension, no admin hold, no "archive for research."

---

## 6. Derived narrative state (display only)

Computed by `domain/narrative.ts`. Never stored. Resolved in this priority order — first match wins:

| Narrative state | Condition | Citizen-facing sentence (i18n key) |
|---|---|---|
| `PROBATION_FAILED` | ticket failed probation | `narrative.repair_failed_durability` |
| `FIELD_DISCREPANCY` | audit = `DISCREPANCY_FLAGGED` | `narrative.reports_disagree` |
| `PROBATION_ACTIVE` | ticket in probation | `narrative.under_probation_n_days` |
| `VERIFIED_SUSTAINED` | ticket sustained | `narrative.working_seven_days` |
| `PHYSICALLY_CONFIRMED` | audit confirmed, no ticket | `narrative.asset_present` |
| `AUDIT_DISPATCHED` | task open, threshold unmet | `narrative.awaiting_reports_n_of_3` |
| `CLAIMED` | fiscal ≥ `COMMITTED`, audit `NOT_DISPATCHED` | `narrative.funded_not_yet_checked` |
| `UNOFFICIAL_ESTIMATE` | confidence = `UNOFFICIAL_ESTIMATE` | `narrative.no_source_document` |

Note there is **no `VERIFIED` narrative state**. Nothing in this product is ever labelled simply "verified" — the word always carries who, when and on what evidence.

---

## 7. Transition invariants (assert these as tests)

| ID | Invariant |
|---|---|
| INV-01 | No `VERIFIED_SUSTAINED` earlier than `probation_ends_at`, under any actor or event ordering. |
| INV-02 | `witness_count` equals `count(distinct cluster_key) where weight = 1`, always. |
| INV-03 | Every state change writes exactly one `audit_event`; no state change is unlogged. |
| INV-04 | The audit hash chain has no break after any sequence of operations. |
| INV-05 | An illegal transition returns a typed error and leaves all rows unchanged (transaction rolled back). |
| INV-06 | No bulletin export exists for a bulletin not in `APPROVED_FOR_BROADCAST`. |
| INV-07 | A project with `UNOFFICIAL_ESTIMATE` confidence never reaches `COMMITTED`. |
| INV-08 | Concurrent threshold-completing observations produce exactly one transition event. |
| INV-09 | A voice note past TTL has a null `storage_path` and a non-null `purged_at`. |
| INV-10 | A `DISCREPANCY_FLAGGED` project pauses its linked probation clock; the clock resumes with the same remaining duration. |

---

## 8. Reference implementation shape

```ts
// /src/domain/probation.ts  — pure, no imports outside /domain
export type ProbationEvent =
  | { type: 'REPAIR_CLAIMED'; claimedBy: string; at: Date }
  | { type: 'INITIAL_FUNCTION_CONFIRMED'; clusterKey: string; at: Date }
  | { type: 'FAILURE_REPORTED'; clusterKey: string; at: Date }
  | { type: 'PROBATION_WINDOW_CLOSED'; at: Date }
  | { type: 'MANUAL_CLOSE_ATTEMPT'; actor: ActorRole; at: Date };

export type TransitionResult =
  | { ok: true; next: ProbationState; effects: Effect[] }
  | { ok: false; code: DomainErrorCode; message: string };

export function transition(
  current: ProbationSnapshot,   // includes probationEndsAt, confirmations, failures
  event: ProbationEvent
): TransitionResult;
```

Rules for the agent:
- `transition` takes a **snapshot**, not a database row, and returns **effects to perform**, not performed effects.
- `Effect` is a discriminated union: `{kind:'AUDIT'}`, `{kind:'SCHEDULE_PING'}`, `{kind:'ENQUEUE_OUTBOX'}`, `{kind:'INCREMENT_FAILURE_COUNT'}`. The app-service executes them inside the transaction.
- Every event type must be exhaustively handled with a `never` check in the default branch. A non-exhaustive switch is a defect.
