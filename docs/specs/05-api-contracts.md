# 05 — API Contracts

## 0. Conventions

- Base: same-origin Next.js route handlers under `/api`.
- Content type `application/json` except `/api/ussd` and `/api/sms/inbound`, which follow gateway conventions (form-encoded in, plain text out).
- **Every mutating endpoint requires `Idempotency-Key: <uuid>`.** Missing key → `400 missing_idempotency_key`.
- Errors use RFC 9457 `application/problem+json`.
- No endpoint returns a citizen identity. No endpoint accepts free text from a citizen.
- All timestamps ISO 8601 UTC.

### Error envelope

```json
{
  "type": "https://wardproofline.dev/errors/probation_locked",
  "title": "Probation window is still open",
  "status": 409,
  "code": "E_PROBATION_LOCKED",
  "detail": "Ticket cannot be closed before 2026-09-22T06:00:00Z.",
  "instance": "/api/repairs/9f1c.../close",
  "traceId": "01J8..."
}
```

### Error code registry

| Code | HTTP | Meaning |
|---|---|---|
| `E_MISSING_IDEMPOTENCY_KEY` | 400 | Mutating call without the header |
| `E_IDEMPOTENCY_KEY_REUSED` | 409 | Same key, different payload |
| `E_VALIDATION` | 422 | Schema failure; `errors[]` lists field paths |
| `E_UNKNOWN_CODE` | 404 | Ward/project/service code not found |
| `E_TASK_CLOSED` | 409 | Observation for an expired or closed task |
| `E_DUPLICATE_RESPONDENT` | 200 | Accepted and stored with weight 0 (not an error to the caller) |
| `E_PROBATION_LOCKED` | 409 | Attempt to close before window end |
| `E_K_NOT_SATISFIED` | 200 | Aggregate suppressed; body carries the suppression notice |
| `E_NOT_APPROVED` | 409 | Bulletin export before moderator approval |
| `E_FORBIDDEN_ROLE` | 403 | Role lacks permission |
| `E_RATE_LIMITED` | 429 | Per-`phone_hash` or per-IP limit exceeded |
| `E_CHAIN_BROKEN` | 500 | Audit chain verification failed (alert condition) |

---

## 1. `POST /api/ussd` — gateway contract

Implements the Africa's Talking USSD webhook shape exactly, so the browser simulator and a real gateway are interchangeable.

**Request (form-encoded)**
```
sessionId=ATUid_9f...&serviceCode=*890#&phoneNumber=%2B2519...&text=1*2*1
```

**Response (text/plain)**
- `CON <prompt>` — session continues
- `END <final message>` — session terminates

**Behaviour**
- `text` is the full `*`-joined history of keypresses. The session reducer in `domain/session.ts` replays it; **no server-side session storage is required**, which makes the endpoint stateless and trivially testable.
- Locale is resolved from `respondent.locale` if the `phone_hash` is known, otherwise from the first menu selection.
- Response bodies must fit a 182-character USSD page. A test asserts every possible response is ≤182 chars for every locale.
- Unknown input → re-prompt with the same node and an inline hint; never a dead end.

**Example session**
```
""        → CON 1 Check a project  2 Service fees  3 Report a fault
"1"       → CON Enter project code:
"1*4412"  → CON Health Post 08 generator. ETB 320,000. Check: 1 Does it run? 
"1*4412*1"→ CON Does the fridge light show green? 1 Yes 2 No
"1*4412*1*2" → END Thank you. 3 of 3 neighbours have now checked. Reports disagree; a moderator will review.
```

---

## 2. `POST /api/sms/inbound`

**Request (form-encoded):** `from`, `to`, `text`, `id`, `date`

**Keyword grammar (case-insensitive, whitespace-tolerant):**

| Keyword | Form | Meaning |
|---|---|---|
| `CHECK` | `CHECK <projectCode>` | Return receipt summary |
| `TASK` | `TASK <projectCode> <answers>` | Submit observation, e.g. `TASK 4412 121` |
| `FEE` | `FEE <serviceCode>` | Return statutory rule card |
| `VISIT` | `VISIT <serviceCode> <outcomeCode> [amount]` | Submit outcome code |
| `FIX` | `FIX <assetCode> <1\|2>` | Probation re-check response |
| `HELP` | `HELP` | Return keyword list |

Unparseable input → a help reply, never silence, never an error code to the citizen.

**Response:** `200` with the outbound message body queued to `outbox_message`.

---

## 3. `POST /api/ivr`

**Request**
```json
{ "sessionId": "ivr_01J8...", "phoneNumber": "+2519...", "digits": "1*4412*1", "locale": "am" }
```

**Response**
```json
{
  "action": "PROMPT",
  "audioKeys": ["prompt.project_summary", "value.amount", "prompt.q1_generator_runs"],
  "slots": { "amount": "320000", "currency": "ETB" },
  "expectDigits": 1,
  "timeoutMs": 8000,
  "repeatKey": "prompt.repeat_hint"
}
```
- `action` ∈ `PROMPT` | `END`.
- The client (simulator or telephony bridge) plays `audioKeys` in order, substituting number sequences for `slots` from the number phrase bank.
- **No audio URL is ever inlined.** Keys resolve through `/api/audio/manifest`.

---

## 4. `GET /api/wards/:wardCode/receipts`

```json
{
  "ward": { "code": "ET-AA-W09", "name": "Woreda 9", "locales": ["am","om","en"] },
  "receipts": [
    {
      "projectCode": "4412",
      "title": "Health post generator overhaul",
      "amountMinor": 32000000,
      "currency": "ETB",
      "contractor": "AfroTech Infra",
      "promisedCompletion": "2026-08-30",
      "confidence": "OFFICIAL_CITED",
      "source": {
        "title": "Woreda 9 Capital Budget FY2026",
        "issuer": "Woreda 9 Finance Office",
        "page": 41,
        "sha256": "3b1f...",
        "archivedAt": "2026-09-12T08:00:00Z"
      },
      "narrative": {
        "state": "PROBATION_ACTIVE",
        "messageKey": "narrative.under_probation_n_days",
        "slots": { "days": "5" }
      },
      "witness": { "count": 3, "target": 3 }
    }
  ],
  "generatedAt": "2026-09-15T09:00:00Z"
}
```

Lines with `confidence: "UNOFFICIAL_ESTIMATE"` must include `"source": null` and are rendered with the estimate label. Never omit the field.

---

## 5. `POST /api/observations`

Used by the Monitor PWA (including offline replay).

**Request**
```json
{
  "taskId": "b1c2...",
  "phoneHash": "9ad4...",
  "channel": "PWA",
  "answers": { "q1": true, "q2": false, "q3": true },
  "geoCell": "et-aa-0917",
  "submittedAt": "2026-09-15T06:41:00Z",
  "clientIdempotencyKey": "b7d1..."
}
```

**Response 200**
```json
{
  "accepted": true,
  "counted": true,
  "clusterKey": "et-aa-0917:c3",
  "witnessCount": 3,
  "witnessTarget": 3,
  "resultingNarrative": "FIELD_DISCREPANCY",
  "messageKey": "narrative.reports_disagree"
}
```

**Duplicate cluster response 200**
```json
{
  "accepted": true,
  "counted": false,
  "reasonKey": "observation.cluster_already_counted",
  "witnessCount": 3,
  "witnessTarget": 3
}
```

> `counted: false` is the field the demo highlights. It must be present, explicit, and rendered in the UI as a visible message — not swallowed.

**Rules**
- `submittedAt` is client time (offline capture); the server records `received_at` separately and never trusts client time for probation arithmetic.
- Idempotency: `clientIdempotencyKey` is the natural key. Replaying an offline queue must be safe.

---

## 6. `GET /api/services/:serviceCode/card`

```json
{
  "serviceCode": "ET-ID-REPLACE",
  "officeCode": "W09-CIVIL-01",
  "statutory": {
    "feeCeilingMinor": 5000,
    "currency": "ETB",
    "requiredDocuments": ["doc.birth_certificate_copy","doc.two_witnesses_id"],
    "expectedVisits": 1,
    "refusalScriptKey": "script.request_official_receipt",
    "appealRouteKey": "appeal.woreda_ombuds",
    "source": { "title": "Circular 14/2026", "page": 3, "reviewer": "H.T.", "reviewedAt": "2026-09-11" }
  },
  "observed": {
    "kSatisfied": true,
    "windowDays": 30,
    "reportCount": 14,
    "distinctClusters": 6,
    "pctAdditionalFee": 78.6,
    "medianExtraMinor": 20000,
    "avgVisits": 2.4
  }
}
```

**When k is not satisfied**, `observed` must be:
```json
{ "kSatisfied": false, "windowDays": 30, "noticeKey": "divergence.not_enough_reports", "minimumRequired": 5 }
```
No counts, no percentages, no medians. Returning a suppressed count is a **security defect**, not a UI choice.

---

## 7. `POST /api/visits/outcomes`

```json
{ "serviceCode": "ET-ID-REPLACE", "outcomeCode": 2, "extraFeeMinor": 20000, "visits": 3, "phoneHash": "9ad4...", "channel": "USSD" }
```
Response: `{ "accepted": true, "thankYouKey": "outcome.recorded" }` — **never** echoes aggregate state back to the reporter (that would leak below-k information one report at a time).

---

## 8. Repair endpoints

`POST /api/repairs/:ticketId/claim`
```json
{ "claimedBy": "AfroTech Infra", "claimedAt": "2026-09-15T08:00:00Z", "evidenceNote": "optional, console only" }
```
Response includes the refusal explicitly:
```json
{
  "state": "REPAIR_CLAIMED",
  "closureAvailable": false,
  "reasonKey": "probation.claim_does_not_close",
  "probationDays": 7
}
```

`POST /api/repairs/:ticketId/close` → **always** `409 E_PROBATION_LOCKED` before `probation_ends_at`, for every role. The attempt is written to the audit chain with the attempting role. Keep this endpoint even though it always fails early — it exists so the demo can show the refusal and so the audit trail records attempts.

`POST /api/repairs/:ticketId/recheck`
```json
{ "phoneHash": "9ad4...", "stillWorking": false, "channel": "SMS" }
```

---

## 9. Bulletins

- `POST /api/cron/bulletins/compile` → creates `DRAFT`s for wards with ≥1 k-gated fact.
- `GET /api/bulletins/:id` → moderator view (role-gated).
- `POST /api/bulletins/:id/approve` → body `{ "moderatorInitials": "S.A.", "editedScript": "..." }`. Re-validates every fact's k-status **at approval time**; a fact that dropped below k blocks approval with `E_K_NOT_SATISFIED` and names the offending fact index.
- `POST /api/bulletins/:id/reject` → body `{ "reason": "..." }`.
- `GET /api/bulletins/:id/export?format=txt|print` → `409 E_NOT_APPROVED` unless `APPROVED_FOR_BROADCAST`.

---

## 10. Audit chain

`GET /api/audit/verify?wardCode=ET-AA-W09`
```json
{ "ok": true, "eventsChecked": 412, "firstBreakSeq": null, "headHash": "7c2a..." }
```
On a break: `{ "ok": false, "firstBreakSeq": 208, "expectedHash": "...", "foundHash": "..." }` and HTTP 500 `E_CHAIN_BROKEN`.

`GET /api/projects/:code/history` → ordered, redacted event list for the public "prove it" view. Contains role, action, timestamp and hash. Never an actor identity.

---

## 11. Cron endpoints (protected by `x-cron-secret`)

| Path | Cadence | Duty |
|---|---|---|
| `/api/cron/dispatch-tasks` | hourly | dispatch due proof tasks |
| `/api/cron/probation-pings` | hourly | send Day-3 / Day-7 re-checks |
| `/api/cron/close-probations` | hourly | evaluate windows that have ended |
| `/api/cron/refresh-aggregates` | 15 min | recompute `divergence_aggregate` with k gating |
| `/api/cron/purge-audio` | 15 min | hard-delete voice blobs past TTL |
| `/api/cron/bulletins-compile` | weekly | build `DRAFT` bulletins |
| `/api/cron/flush-outbox` | 5 min | deliver queued messages |

All cron handlers must be idempotent and safe to run twice in the same minute.

---

## 12. Rate limits

| Path | Limit |
|---|---|
| `/api/ussd`, `/api/sms/inbound` | 20 sessions / phone_hash / hour |
| `/api/observations` | 10 / phone_hash / hour (offline replay exempt via idempotency key) |
| `/api/visits/outcomes` | 3 / phone_hash / service / day |
| Console endpoints | 120 / user / minute |

Exceeding the limit returns `429` **and** is recorded as a `RATE_LIMIT_TRIGGERED` audit event — coordinated submission attempts are evidence, not just noise.

---

## 13. What the API must never do

- Return a raw MSISDN, a `respondent.id`, a voice storage path, or an `audit_event.actor_ref` for a citizen.
- Return an aggregate below k, in any field, in any shape, including as a count of "pending reports."
- Accept or store free-text from any public channel.
- Accept a client-supplied `state`, `witnessCount`, `clusterKey` or `weight`. All are server-derived; presence in a request body is `422`.
