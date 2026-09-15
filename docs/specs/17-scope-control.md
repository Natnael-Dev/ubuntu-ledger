# 17 — Scope Control

> Read this at the start of every day. Ward Proof-Line fuses five components. That is its strength as a concept and its single largest execution risk. **Breadth is how this project fails.** This file exists to make cutting easy and pre-decided, so that cutting under pressure is not a judgement call at 1 a.m.

## 1. The honest risk

The brief this design came from warns: *the PoC should feel deep rather than broad*. A five-component fusion is broad by construction. It is defensible only if the **loop** is visible end to end and each component is shallow but genuinely working.

The failure mode to avoid is five half-built subsystems with a beautiful architecture document. The failure mode to accept is **three components working perfectly and two clearly labelled as designed-not-built**. Judges reward honest boundaries; they punish broken demos.

## 2. Priorities

### P0 — ships or the submission has no differentiator

| Capability | Why it is P0 |
|---|---|
| Three state machines with full transition coverage | The product *is* the state machines |
| Cluster derivation + triangulation | Frame A of the demo |
| Probation lock, triple-enforced | Frame B of the demo |
| USSD session engine + `/api/ussd` + simulator | The only channel judges will see |
| Public receipt with source hash, page and the unofficial-estimate state | The "two ledgers" proof |
| Probation cron: pings and closure evaluation | Makes Day-7 real rather than claimed |
| Audit hash chain + verifier endpoint | Tamper evidence, and it is cheap |
| Bulletin generation + moderator approval gate + gated export | The last-mile differentiator |
| Adversarial suite (30 cases) | 25% of the score sits here |
| Log redaction | Non-negotiable on safety grounds |
| Seed scenario + demo recording + deck + written summary | 25% of the score sits here |

### P1 — materially improves the score, cut without regret if behind

- Statutory card + outcome codes + k-anonymous divergence
- Two-ledger divergence card UI
- Offline observation outbox in the PWA
- IVR audio playback
- Document ingestion with human confirmation (seeded data works without it)
- Second country config
- Accessibility audit PR

### P2 — only if genuinely ahead

- Voice note capture, moderation and TTL purge
- Stitched audio bulletin
- Live Africa's Talking sandbox dial
- Third language with full audio

## 3. The hard cut line — never build these

| Never | Why |
|---|---|
| Any map | Two days of work, zero rubric points, real targeting risk |
| Any chart or graph | The dashboard is not the product |
| Live ASR on the critical path | Accuracy risk inside a trust product |
| Contractor credibility **scores** | A score is an accusation with a decimal point; a factual failure count is enough |
| Real telecom provisioning as a dependency | External blocker you cannot control |
| Native mobile app | PWA is sufficient and installable |
| Blockchain / DLT | The hash chain already provides the needed property |
| Multi-ward or multi-tenant admin | One ward is the PoC |
| Free-text input for any public user | Removes doxxing, defamation, injection and PII leakage in one decision |
| Realtime subscriptions | Demo liability, no scoring benefit |
| Component-level test coverage targets | Time sink; domain coverage is what matters |
| A second moderator role | Documented as a deployment upgrade, not built |

## 4. Go / no-go gates

**Gate 1 — end of Day 1.** The three state machines pass their complete transition tables, migrations apply cleanly, RLS test is green.
*If not met:* drop T-23 (ingestion) and T-32 (voice notes) immediately and continue. Do not negotiate with yourself about catching up.

**Gate 2 — end of Day 2 (the important one).** On the simulator: a proof task can be answered, three distinct clusters move the state, and a fourth same-cluster submission visibly does not.
*If not met:* **stop all feature work.** Everything on Day 3 is cancelled except fixing this. Frame A is half the demo.

**Gate 3 — end of Day 3 (the hard gate).** Both demo frames work live:
- A duplicate cluster leaves the witness counter unchanged, with a visible message.
- An admin's attempt to close probation early is refused, and the refusal is visible in the audit chain.

*If not met:* drop **all** of P1 — divergence, offline outbox, IVR, ingestion, second country — and spend Days 4 and 5 on these two frames, the adversarial suite, and the submission package. A submission with two perfect frames and an honest "these three components are specified and seeded but not built" scores far better than five broken ones.

**Gate 4 — midday Day 5.** Demo recorded, deck drafted, written summary drafted, hosted deploy live.
*If not met:* stop all code. No exceptions. Unrecorded work scores zero.

## 5. Time budget

| Day | Build | Submission assets | Slack |
|---|---|---|---|
| 1 | 8h | — | 1h |
| 2 | 8h | — | 1h |
| 3 | 7h | 1h (README skeleton, build log catch-up) | 1h |
| 4 | 6h | 2h (deploy, deck outline, seed polish) | 1h |
| 5 | 2h | 6h (record, deck, summary, README) | 1h |

**Day 5 is 75% submission work.** This is not a buffer that can be borrowed against. Presentation is 25% of the score and it is the only quarter that cannot be earned retroactively.

## 6. De-scoping protocol

When something must be cut:

1. Cut whole capabilities, never halves. A half-built divergence card is worse than none.
2. Keep the **seed data and the config** for the cut capability. It proves the design exists even unbuilt.
3. Write one honest line in the README: *"Statutory divergence is specified in `/specs/07` and seeded in the fixtures; the aggregation endpoint is implemented, the citizen-facing card was not built within the sprint."*
4. Say the same thing on the deck's final slide. Stated limits score; discovered limits cost.
5. Never fake it in the demo. A mocked screen that a judge probes is the fastest way to lose a trust-themed competition.

## 7. Daily standup with yourself

Ask these four questions each morning and write the answers in the build log:

1. Do both demo frames still work right now? (If no, that is today's only job.)
2. What did I add yesterday that the demo will never show? (Consider cutting it.)
3. Am I ahead of, on, or behind the gate for today?
4. What is the one thing that, if it broke tomorrow, would sink the submission? (Test it today.)

## 8. The single sentence to hold onto

> Judges score what they can see working. Everything else is documentation — and documentation of an honest boundary scores, while documentation of an intended feature does not.
