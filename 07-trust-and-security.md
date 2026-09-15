# 07 — Trust and Security Architecture

> This file is the product. If a feature in `11-tasks.md` conflicts with a rule here, this file wins.

## 1. The definition of "verified" used by this system

The word *verified* never appears alone. Every claim carries five attributes:

| Attribute | Answer in this system |
|---|---|
| **Verified by whom?** | Named source document (for official lines) or N distinct community clusters (for observed lines). Never "the system." |
| **Using what evidence?** | A page citation and byte hash, or yes/no answers to a physical question asked at the asset. |
| **At what time?** | Timestamp on every source document, observation and aggregate refresh. |
| **With what confidence?** | An explicit state (`OFFICIAL_CITED` / `UNOFFICIAL_ESTIMATE`; witness count vs target; k-satisfied or not). Never a score out of 100. |
| **What happens when sources disagree?** | `DISCREPANCY_FLAGGED`. Both readings stay visible. Nothing is averaged, nothing is silently resolved. |

## 2. Two ledgers, never merged

```
OFFICIAL LEDGER                          COMMUNITY LEDGER
source_document + project                inspection_task + observation
hash, issuer, page, date                 witness clusters, answers, timestamps
────────────────────────────────         ────────────────────────────────
never edited by citizens                 never edited by officials
never overwritten by observation         never overwritten by official claim
                    \                   /
                     └──► DIVERGENCE ◄─┘
            published as a comparison, never as a verdict
```

Implementation rules:
- No column in `project` is ever written from an observation.
- No column in `observation` is ever written from an official record.
- Any UI that shows both must show them in **two visually distinct containers with two provenance lines**. A merged sentence like "the fee is 200 birr" is forbidden; the correct rendering is two rows.

## 3. Sybil and collusion resistance

**The threat:** one actor submits from ten SIMs to manufacture a threshold, or a single faction floods a task.

**The mechanism — confirmations are weighted by *space and cohort*, not volume.**

```
cluster_key = sha256(
    task_id
  + geo_cell                        // ~1 km grid; coarse on purpose
  + msisdn_prefix_bucket            // first 6 digits → bucket
  + registration_cohort             // week-of-registration bucket
)[0..15]
```

Counting rule:
```
witness_count = count(DISTINCT cluster_key) WHERE weight = 1
```

- The **first** observation for a `cluster_key` on a task gets `weight = 1`.
- Every subsequent observation for that `cluster_key` is stored with `weight = 0`, returned to the caller as `counted: false` with a reason key, and audited as `OBSERVATION_SUPPRESSED`.
- Ten SMS from consecutively-issued numbers registered the same week, from the same cell, count as **one witness**.
- Suppressed observations are never deleted. A burst of suppressed observations is itself a signal, surfaced to moderators as `coordinated_submission_suspected`.

**Deliberate limitation to state honestly:** a sufficiently resourced adversary with SIMs registered across weeks and physically distributed across cells can still manufacture witnesses. The design raises the cost from *trivial* (ten SIMs from one shop) to *logistically expensive*, and leaves an auditable trace. Claim exactly that; do not claim sybil-proof.

## 4. Multi-witness triangulation

- Default `witness_target = 3` distinct clusters.
- A state change also requires **answer agreement ≥ 2/3 per question** across those clusters. Below that: `DISCREPANCY_FLAGGED`, not a majority verdict.
- For probation closure the target is ≥2 distinct clusters **from the original reporter set**, dated on or after `probation_ends_at`.
- A single observation can never change any state. Not even a moderator's.

## 5. Zero-PII pipelines

**Phone numbers.** Stored as `phone_hash = HMAC-SHA256(msisdn, PEPPER)` for all joins, plus `phone_enc` (pgcrypto) readable only by the outbox worker's service role. `PEPPER` lives in the environment, never in the repo. The domain core never receives a raw MSISDN — enforce with a type (`PhoneHash`) that has no constructor from a plain string outside `infra`.

**Location.** `geo_cell` only, ~1 km. No latitude, no longitude, no accuracy radius, no address. Adding a coordinate column is a defect.

**Audio.** See `06 §8`. No transcripts. Hard 48-hour TTL enforced by a DB `CHECK` plus a cron purge plus a test.

**Free text.** The public has no free-text input path anywhere. This removes, in one decision: doxxing, defamation, hate speech moderation load, prompt injection, and PII leakage through narrative fields.

**Logs.** A structured logger with a redaction middleware. `tests/adversarial/log-redaction.test.ts` injects a synthetic MSISDN, `phone_enc` value, storage path and `actor_ref` into every log-emitting path and asserts none appears in output. This test failing is a release blocker.

## 6. Defamation and safety protection

1. **No individual is ever named** in any output. Aggregation units are `office_code`, `project_code`, `asset_id` and organisation names for contracting entities only.
2. **Behaviour is coded, never characterised.** Outcome code 2 is `additional_payment_requested` — a factual description of an event, not an allegation of a crime.
3. **Response window.** When a divergence crosses the alert threshold, a 72-hour response window opens before the fact becomes bulletin-eligible. The window's existence and expiry are recorded. This one design choice is what separates an accountability instrument from a pillory; put it in the deck.
4. **Bulletin language is constrained by template.** The script is composed from fixed sentence frames with numeric slots. A moderator may edit within the frame but cannot introduce a free-form accusation, because the export renderer validates the script against the frame grammar before allowing approval.
5. **Forbidden-word check.** A CI test scans all locale files, bulletin frames and outbound templates for a banned lexicon (`corrupt*`, `bribe*`, `theft`, `stole*`, `fraud*`, `criminal*`, `illegal*` and locale equivalents). A match fails the build.

## 7. k-anonymity

- `k_min = 5` **distinct clusters** — not 5 reports — before any aggregate is computed or returned.
- `alert_active` requires `report_count ≥ 10` **and** `distinct_clusters ≥ 5` **and** `pct_additional_fee ≥ 60`.
- Below k the API returns a suppression notice only: no count, no percentage, no median, no "n more needed until we can show this" (that leaks the count incrementally).
- RLS enforces the same rule at the database layer (`divergence_k_gated` policy), so an application bug cannot leak what the policy forbids.
- **Differencing attack mitigation:** aggregates are computed on fixed 30-day windows anchored to a rolling boundary, and the API never accepts a caller-supplied window. Allowing arbitrary windows would let an attacker difference two overlapping queries to isolate a single report.

## 8. Tamper-evident audit chain

- Every state change appends one `audit_event`.
- `payload_hash = sha256(canonical_json(payload))`, `hash = sha256(seq || prev_hash || payload_hash || occurred_at)`.
- Genesis `prev_hash` is 64 zeros.
- `UPDATE` and `DELETE` are disabled by rule on the table.
- `GET /api/audit/verify` walks the chain and reports the first break.
- Payloads are pre-redacted: entity IDs, roles, state names and numeric facts only. No MSISDN, no `actor_ref` for citizens, no free text.

**Say this in the pitch, unprompted:** *"This is a hash chain in Postgres, not a blockchain. The property we need is append-only tamper evidence with a public verifier, and this provides it at zero operational cost."* Pre-empting the blockchain question is worth more than answering it.

## 9. Role model

| Role | Can | Cannot |
|---|---|---|
| Citizen (no account) | Submit observations, outcome codes, fault reports; read receipts and k-gated aggregates | Read raw reports, see other citizens, see below-k data, submit free text |
| Monitor (registered phone) | Everything a citizen can, plus receive dispatched tasks and use the offline PWA | Approve anything, see aggregates before k |
| Moderator | Review flagged items, clear/reject voice notes, approve or reject bulletins | Change any project or probation state, edit observations, close a ticket |
| Ingest reviewer | Confirm extracted receipt fields, attach source documents | Approve bulletins, view respondent data |
| Admin | Configure wards, services, dispatch tasks, record repair claims | **Close a probation early. Delete an audit event. Publish below k. Bypass moderation.** |

The admin's list of *cannots* is the security story. Demonstrate one of them failing on camera.

## 10. Threat model

| # | Threat | Actor | Mitigation | Residual risk |
|---|---|---|---|---|
| T1 | Fabricated threshold via multiple SIMs | Contractor, local broker | Cluster weighting; suppressed-burst signal to moderators | Distributed, patient adversary still possible |
| T2 | Contractor closes own ticket | Contractor, captured admin | Triple-enforced probation lock (domain, service, DB constraint); attempts audited | None at the data layer |
| T3 | Retaliation against a reporter | Official, local power holder | No identities stored or returned; k-gating; coded outcomes; no map; no free text | A very small ward may make k itself identifying — mitigate by raising k for wards below a population floor |
| T4 | Defamation claim against the project | Aggrieved office or contractor | Codes not allegations; response window; template-constrained bulletins; forbidden-lexicon CI gate | Legal exposure is reduced, not eliminated; state that deployment requires local legal review |
| T5 | Stale official data presented as current | System failure | Every receipt shows document date + archive date; staleness is rendered, never hidden | — |
| T6 | Moderator capture | Local pressure | Approval identity is in the immutable chain; two-moderator requirement is a documented deployment upgrade | Single-moderator PoC is a stated limitation |
| T7 | Voice-based identification of a reporter | Surveillance actor | 48 h hard purge; no transcript; no public clip playback ever | Window of exposure before purge; stated |
| T8 | Database compromise | External attacker | No coordinates, no raw phones in plaintext, no narratives, minimal retention — the database is deliberately boring to steal | — |
| T9 | Differencing attack on aggregates | Researcher or adversary | Fixed server-side windows; no caller-supplied parameters; no below-k hints | — |
| T10 | Prompt injection through ingested documents | Malicious document | Ingestion is offline, one-shot, and **every extracted field is human-confirmed** before persistence; model output never triggers an action directly | — |

## 11. Failure modes the system must handle openly (judges will ask)

| Failure | System behaviour |
|---|---|
| The source document is wrong | We publish the citation, not the truth claim. The community ledger can contradict it, and the contradiction is the finding. |
| Nobody answers the proof task | State stays `AWAITING_THRESHOLD`; the receipt reads "not enough reports yet." Silence never becomes confirmation. |
| Reports contradict each other | `DISCREPANCY_FLAGGED`. Both readings stay visible. This is a supported outcome, not an error. |
| The asset is fixed then breaks on day 6 | `PROBATION_FAILED` — which is the entire reason probation exists. |
| A moderator never reviews | The bulletin stays `DRAFT` forever. Nothing reaches air. Staleness beats unreviewed publication. |
| A locale file is incomplete | CI fails. The build does not ship a half-translated trust product. |
| A cron job misses a run | All cron handlers are idempotent; the next run catches up. Probation arithmetic is absolute-time based, not tick-count based. |

## 12. Security checklist before submission

- [ ] RLS enabled on every table; anon client returns zero rows from `respondent`, `voice_note`, `observation`, `audit_event`
- [ ] `divergence_aggregate` unreadable while `k_satisfied = false`, verified with a real anon client
- [ ] Log redaction test passing
- [ ] Forbidden-lexicon test passing across all locale files and bulletin frames
- [ ] Audio purge test passing (blob actually gone from storage, not just flagged)
- [ ] Probation lock test passing for every role including admin
- [ ] Audit chain verifier returns `ok: true` after the full seeded scenario
- [ ] No coordinate column anywhere in the schema (`grep -ri "latitude\|longitude\|lat,\|lng" supabase/` returns nothing)
- [ ] No transcript column anywhere
- [ ] No secret in the repo; `.env.example` complete and values absent
