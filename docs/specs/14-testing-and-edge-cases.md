# 14 — Testing and Edge Cases

## 1. Test layers

| Layer | Tool | Scope | Where |
|---|---|---|---|
| Domain unit | Vitest | Pure rules: state machines, clustering, triangulation, k-gating, hash chain, session reducer, content templates | `tests/unit/` |
| Adversarial | Vitest (separate CI job) | The 30 attack scenarios below | `tests/adversarial/` |
| Contract | Vitest + supertest | API shapes, error codes, idempotency, RLS | `tests/contract/` |
| Channel parity | Vitest | CH-01…CH-07 from `06 §11` | `tests/unit/channels/` |
| E2E | Playwright | Simulator session, offline outbox, moderator approval gate | `tests/e2e/` |
| Accessibility | axe + Playwright | Every surface | `tests/e2e/a11y.spec.ts` |

The **adversarial suite runs as its own named CI job**. Judges should see it as a distinct green check, not buried inside "tests."

---

## 2. The adversarial suite — 30 cases

Each case has a one-line threat description in the suite README. This README is a scored artifact: it should read as a threat list.

### Sybil and collusion (ADV-01 … ADV-06)

| ID | Attack | Expected |
|---|---|---|
| ADV-01 | Ten submissions from consecutive MSISDNs, same cell, same registration week | `witness_count = 1`; nine stored at `weight = 0` |
| ADV-02 | Same respondent submits the same task twice | Unique constraint holds; second returns `counted: false`, no duplicate row |
| ADV-03 | Same cluster, different respondents, ten times | Counter unchanged; `coordinated_submission_suspected` surfaced to moderators |
| ADV-04 | Three genuinely distinct clusters, all agreeing | `PHYSICALLY_CONFIRMED` |
| ADV-05 | Three distinct clusters, 1 yes / 2 no on one question | `DISCREPANCY_FLAGGED`, not majority-confirmed |
| ADV-06 | Attacker supplies `clusterKey` / `weight` / `witnessCount` in the request body | `422`; server-derived values only |

### Probation integrity (ADV-07 … ADV-12)

| ID | Attack | Expected |
|---|---|---|
| ADV-07 | Two observations complete the threshold simultaneously | Exactly one transition, one audit event |
| ADV-08 | Admin calls `close` on day 3 | `409 E_PROBATION_LOCKED`; attempt audited with role |
| ADV-09 | Direct SQL `update … set state='VERIFIED_SUSTAINED'` mid-window | Rejected by CHECK constraint |
| ADV-10 | System clock jumps backwards | Window is unchanged; arithmetic is absolute-time based |
| ADV-11 | Probation crosses a DST boundary | Window length correct to the second |
| ADV-12 | Discrepancy raised on day 4, cleared on day 6 | Clock paused 2 days; `probation_ends_at` shifted exactly 2 days |

### Privacy and k-anonymity (ADV-13 … ADV-20)

| ID | Attack | Expected |
|---|---|---|
| ADV-13 | Query aggregate with 4 distinct clusters | Suppression notice only; no count, no percentage, no median, no "n more needed" |
| ADV-14 | Anon Supabase client selects `divergence_aggregate` below k | Zero rows (RLS, independent of the API) |
| ADV-15 | Anon client selects `respondent`, `voice_note`, `observation`, `audit_event` | Zero rows from all four |
| ADV-16 | Differencing: two overlapping windows to isolate one report | Impossible — windows are server-anchored and fixed |
| ADV-17 | Synthetic MSISDN / `phone_enc` / storage path / `actor_ref` injected into every log path | None appears in output |
| ADV-18 | Reporter submits an outcome code and inspects the response | No aggregate state echoed back |
| ADV-19 | Voice note past 48 h TTL | Storage object gone; row `PURGED`; `storage_path` null |
| ADV-20 | Schema scan for coordinate or transcript columns | None exist |

### Publication safety (ADV-21 … ADV-25)

| ID | Attack | Expected |
|---|---|---|
| ADV-21 | Export a `DRAFT` bulletin | `409 E_NOT_APPROVED` |
| ADV-22 | Approve a bulletin whose fact dropped below k since compile | Blocked; offending fact index named |
| ADV-23 | Moderator edits a banned word into the script | Frame validation rejects before approval |
| ADV-24 | Locale file contains a banned lexicon term | CI fails |
| ADV-25 | Bulletin fact references an individual's name | Frame grammar has no slot for it; validation rejects |

### Data integrity and resilience (ADV-26 … ADV-30)

| ID | Attack | Expected |
|---|---|---|
| ADV-26 | Tamper with an `audit_event.payload` in a fixture | Verifier reports the break at the correct `seq` |
| ADV-27 | `UPDATE` / `DELETE` on `audit_event` | Zero rows affected (rules) |
| ADV-28 | Offline outbox flushed twice | Exactly one row per observation |
| ADV-29 | Cron runs twice in the same minute | No duplicate pings, no double state transitions |
| ADV-30 | Project with no source document pushed toward `COMMITTED` | Rejected; stays `PROMISED` with `UNOFFICIAL_ESTIMATE` |

---

## 3. Edge cases by module

**Session reducer**
- Empty `text` (first page) · trailing `*` · double `*` · non-numeric input · input longer than the menu · `0`/`00` navigation from the root · unknown project code · project code with leading zeros · a locale switch mid-session.

**Observations**
- Task expired between dispatch and submission · task closed while the answer was queued offline · respondent not registered in this ward · `answers` missing a question · extra unknown question id · `submittedAt` in the future (clamp to `received_at`, never trust client time).

**Probation**
- Claim before any breakage report · two claims in a row · failure reported after `VERIFIED_SUSTAINED` (opens a new ticket, never rewrites the old one) · window closes with exactly one confirmation (extend, do not pass) · three extensions exhausted → `PROBATION_FAILED` with `no_verification`.

**Ingestion**
- Scanned PDF with no text layer (must fail loudly, never guess) · CSV with merged header rows · amount with thousands separators and a currency symbol · duplicate project code within a ward (reject) · document whose `sha256` already exists (link, do not duplicate).

**Aggregates**
- Zero reports · exactly k−1 clusters · exactly k · a report arriving mid-refresh · a cluster whose reports all fall outside the window.

**Audio and i18n**
- Missing audio file for a key present in the locale · locale with no audio at all (fall back to text, state that audio is unavailable) · number too large for the phrase bank · currency with no minor unit.

**Offline**
- Submit offline, close the tab, reopen, reconnect (queue survives) · queue full · storage quota exceeded · reconnect during a flush · server rejects one item and accepts the rest.

---

## 4. Failure-injection scenarios (run before the demo)

| Scenario | How to inject | Required behaviour |
|---|---|---|
| Supabase unreachable | Wrong key for 30 s | API returns typed 503; the PWA queues; no unhandled rejection; no data loss |
| Storage unreachable | Block the storage domain | Audio falls back to text with an explicit notice; the rest of the response still works |
| Cron never runs | Disable for 24 simulated hours | Nothing auto-closes; states stay honest; the next run catches up |
| Slow network | Throttle to 2G | USSD path unaffected; PWA shows a sync badge, never a frozen screen |
| Partial locale | Delete a key from `am.json` | CI fails before deploy |
| Clock skew | Shift server time ±6 h | Probation arithmetic unaffected |

---

## 5. Coverage expectations

- `/src/domain` — **100% branch coverage.** It is pure, small, and it is the product. No exceptions.
- App-services — every transaction path plus every failure path.
- Route handlers — one happy, one validation failure, one authorization failure each.
- UI — no coverage target; E2E covers the demo path only. Do not spend Day 4 chasing component coverage.

## 6. Pre-submission verification run

```bash
supabase db reset && npm run seed:demo
npm run typecheck
npm run lint
npm run test:unit
npm run test:adversarial
npm run test:contract
npm run test:e2e
npm run test:a11y
curl -s localhost:3000/api/audit/verify?wardCode=ET-AA-W09 | jq .ok   # must be true
grep -ri "latitude\|longitude\|transcript" supabase/ src/            # must be empty
grep -riE "corrupt|bribe|theft|stole|fraud|illegal" content/locales/ # must be empty
```

Every line of this block goes in the README, verbatim, so a judge can run it. A judge who runs your verification block and sees it pass has scored you on AI Coding Usage without you saying a word.
