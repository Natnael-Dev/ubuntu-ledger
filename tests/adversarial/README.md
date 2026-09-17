# Adversarial Threat Model & Test Suite Index

Authoritative source: `docs/specs/14-testing-and-edge-cases.md`, `docs/specs/18-submission-deliverables.md` §1.

This directory houses the deterministic adversarial verification suites for WARD PROOF-LINE:
- `tests/adversarial/t30-adversarial.test.ts` (30 canonical threat cases)
- `tests/adversarial/production-auth.test.ts` (7 production JWT & role enforcement cases)
- `tests/adversarial/log-redaction.test.ts` (8 zero-PII & log sanitization cases)

---

## The 30 Canonical Adversarial Cases (T-30 Matrix)

| Threat ID | Adversarial Vector / Attack Payload | Target Invariant | Expected Defense |
| :--- | :--- | :--- | :--- |
| **ADV-01** | Attempt early repair ticket close while probation is open | INV-01 | Refused with HTTP 409 `E_PROBATION_LOCKED`; attempt logged in audit chain |
| **ADV-02** | Attempt early close on day 0, 1, ..., 6 of 7-day probation | INV-01 | Rejection is monotonic until timestamp strictly surpasses `probation_ends_at` |
| **ADV-03** | Attempt early close with forged `x-actor-role: ADMIN` | INV-01 / Auth | Refused with 409; in production without JWT fails with 401 |
| **ADV-04** | Attempt early close with empty/whitespace body | INV-01 / Schema | Rejected with 400 or 409; cannot bypass probation state machine |
| **ADV-05** | Attempt close on non-existent repair ticket | Data Integrity | Returns RFC-7807 problem details with HTTP 404 `E_NOT_FOUND` |
| **ADV-06** | Attempt repair claim on already sustained ticket | State Machine | Refused with 409 `E_INVALID_STATE_TRANSITION` |
| **ADV-07** | Attempt repair claim with missing contractor name | Schema | Refused with 400 `E_MISSING_CONTRACTOR` |
| **ADV-08** | Attempt repair claim with whitespace-only contractor | Schema | Stripped and refused with 400 `E_MISSING_CONTRACTOR` |
| **ADV-09** | Attempt repair claim with 10,000 character string | Buffer Hygiene | Rejected with 400; prevents unbounded memory payload |
| **ADV-10** | Sybil attack: submit 10 observations from identical cell & prefix | INV-02 / Sybil | Collides on `clusterKey`; first gets `weight = 1`, next 9 get `weight = 0` |
| **ADV-11** | Network replay: submit identical `clientIdempotencyKey` | Idempotency | Returns cached HTTP 200 response; creates 0 duplicate records in database |
| **ADV-12** | Client injects forged `weight: 1` or `clusterKey: "fake"` | Trust Boundary | Server strictly ignores client weight/cluster; recomputes server-side |
| **ADV-13** | Observation submitted for expired inspection task | Lifecycle | Rejected with HTTP 409 `E_TASK_EXPIRED` |
| **ADV-14** | Triangulation split vote (1 Yes / 2 No) | Consensus | Majority < 2/3 fails consistent consensus; flags `DISCREPANCY_FLAGGED` |
| **ADV-15** | Public query on service divergence when distinct clusters $k < 5$ | INV-07 / Privacy | Numbers, percentages, and medians are suppressed; returns notice key only |
| **ADV-16** | 100 observations submitted from only 2 cell towers ($k = 2$) | Privacy / Sybil | Distinct cluster count is 2 ($2 < 5$); metric remains 100% suppressed |
| **ADV-17** | Sliding window differencing attack ($W_2 - W_1$) to deduce fee | Privacy | Suppressed state omits report count and delta, thwarting algebraic reconstruction |
| **ADV-18** | Citizen visit outcome reported 4 times in 1 day by same phone | Rate Limit | 4th submission rejected with HTTP 429 `E_RATE_LIMITED` |
| **ADV-19** | Moderator attempts export of unapproved bulletin | INV-06 | Gated by state; rejected with HTTP 409 `E_NOT_APPROVED` |
| **ADV-20** | Fact drops below $k < 5$ between draft compile and approval | Dynamic Privacy | Live approval recheck detects $k < 5$; aborts with 409 `E_K_NOT_SATISFIED` |
| **ADV-21** | Free-form defamatory prose injected into bulletin script | Frame Grammar | AST parser strictly requires canonical fact frames; arbitrary prose fails 400 |
| **ADV-22** | Cyrillic/Greek homoglyph injection in script (`\u0441orrupt`) | Content Policy | NFKD decomposition and lookalike mapping catch terms; throws integrity error |
| **ADV-23** | Invisible zero-width codepoints in script (`cor\u200Brupt`) | Content Policy | Filter strips zero-width/format codepoints; detects collapsed term |
| **ADV-24** | Punctuation delimiter obfuscation (`c.o.r.r.u.p.t`) | Content Policy | Non-Latin characters stripped; collapsed Latin projection triggers exception |
| **ADV-25** | Direct SQL `UPDATE` or `DELETE` on `audit_event` table | Immutability | Postgres rewrite rules `audit_no_update` and `audit_no_delete` do nothing (0 rows) |
| **ADV-26** | In-place payload tampering of an `audit_event` record | Hash Continuity | `verifyAuditChain` detects SHA-256 payload mismatch at exact sequence number |
| **ADV-27** | Event sequence reordering or gap insertion in audit chain | Hash Continuity | Predecessor hash pointer mismatch (`prev_hash`) invalidates chain |
| **ADV-28** | Raw international phone number inserted into IndexedDB outbox | Zero-PII | Outbox store validator throws `PII Violation`; only 64-hex hash stored |
| **ADV-29** | Database `TRUNCATE audit_event;` statement execution | Immutability | Statement-level trigger `audit_no_truncate` raises `IMMUTABILITY VIOLATION` |
| **ADV-30** | Unofficial project (`UNOFFICIAL_ESTIMATE`) attempts `COMMITTED` | Fiscal Integrity | Refused with `E_UNOFFICIAL_ESTIMATE_CANNOT_COMMIT`; receipt has `source: null` |
