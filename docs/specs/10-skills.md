# 10 — Agent Skills Registry

Each skill is a named, self-contained capability. When a task references a skill, the agent loads this entry, performs the search step, and satisfies the acceptance criteria. Skills are ordered by the day they are first needed.

---

### S-01 `bootstrap-nextjs-supabase-pwa`
**Need:** Day 1. A Next.js 15 + TS + Tailwind + shadcn project wired to Supabase with generated types and a service-worker shell.
**Search:** `next-pwa app router`, `workbox next.js 15`, `supabase gen types typescript`.
**Do:** scaffold; `supabase init`; first migration; `npm run types:gen` script; Workbox precache for the PWA route group only.
**Acceptance:** `npm run dev` serves; `npm run types:gen` writes `src/infra/db/types.gen.ts`; Lighthouse installability check passes on `/pwa`.
**Do not reinvent:** service-worker registration, manifest generation.

---

### S-02 `write-sql-migrations-with-rls`
**Need:** Day 1. Translate `03-data-model.md` into numbered SQL migrations with RLS on every table.
**Search:** `supabase rls policy patterns`, `postgres append only table rule`.
**Do:** one migration per logical group (enums → jurisdiction → receipts → tasks → services → probation → voice → bulletins → outbox → audit → idempotency). Enable RLS in the same migration that creates each table.
**Acceptance:** `supabase db reset` runs clean; `tests/unit/rls.test.ts` passes with a real anon client; no table lacks RLS (assert via a query against `pg_tables`).
**Do not reinvent:** the schema. It is decided. Report discrepancies rather than improvising.

---

### S-03 `implement-declarative-state-machine`
**Need:** Day 1–2. Three pure machines per `04-state-machine.md`.
**Search:** `typescript discriminated union state machine`, `xstate` (evaluate and likely reject with a reason).
**Do:** transition table + `transition(snapshot, event) → Result`, returning `Effect[]` rather than performing effects. Exhaustive `never` checks.
**Acceptance:** every row of every transition table in `04` has a passing test; every illegal transition returns a typed error; INV-01, INV-05, INV-07 pass.

---

### S-04 `derive-sybil-cluster-key`
**Need:** Day 2. The trust model's foundation.
**Search:** `sybil resistance community reporting`, `geohash bucketing`, `hmac key derivation node`.
**Do:** implement per `07 §3`. Pure function, deterministic, no I/O.
**Acceptance:** 11+ cases including same-cell/different-prefix, missing geo_cell fallback, and stability across process restarts. **A change to this function must break tests loudly.**

---

### S-05 `count-witnesses-with-triangulation`
**Need:** Day 2.
**Do:** `witness_count = count(distinct cluster_key) where weight = 1`; per-question agreement ratio; the ≥2/3 rule producing `PHYSICALLY_CONFIRMED` vs `DISCREPANCY_FLAGGED`.
**Acceptance:** INV-02 and INV-08 pass, including the concurrency case with two simultaneous threshold-completing inserts.

---

### S-06 `build-ussd-session-reducer`
**Need:** Day 2. Stateless replay of the `text` string into a menu node.
**Search:** `africastalking ussd webhook contract`, `ussd menu tree node`.
**Do:** pure reducer, menu tree from config, `CON`/`END` rendering, locale resolution, invalid-input re-prompt.
**Acceptance:** CH-02, CH-05, CH-07 pass; every terminal node ends with `END`; every response ≤182 chars in all locales.

---

### S-07 `build-feature-phone-simulator`
**Need:** Day 2–3. The demo hero.
**Search:** `nokia lcd css`, `ussd simulator ui react`.
**Do:** per `08 §4`. Calls the real `/api/ussd`. Includes the phone selector, the **"second phone, same area"** button, IVR mode, and the literal HTTP transcript panel.
**Acceptance:** a full task can be completed end to end; the duplicate-cluster path visibly leaves the witness counter unchanged; 4×20 truncation is real.

---

### S-08 `implement-probation-clock`
**Need:** Day 2–3. The 5% work.
**Search:** `vitest fake timers`, `date-fns tz`, `postgres interval arithmetic`.
**Do:** absolute-time arithmetic through `infra/clock`; pause/resume on discrepancy; extension rules; the triple-enforced lock.
**Acceptance:** INV-01 passes for every role; a test travels 7 days forward in milliseconds; a test asserts the DB `CHECK` rejects an early close even when domain logic is bypassed; a test covers a DST boundary.

---

### S-09 `ingest-document-to-receipt`
**Need:** Day 3. AI-assisted, human-confirmed.
**Search:** `pdfplumber`, `camelot`, `pdf-parse`, `papaparse` — **never hand-roll a PDF parser**.
**Do:** extract candidate lines → present each field in the review pane with a confidence hint → persist only fully-confirmed rows → compute and store `sha256` of the archived bytes → set `confidence` correctly.
**Acceptance:** a seeded PDF and a seeded CSV both produce reviewable candidates; nothing persists without confirmation; a document with no hash yields `UNOFFICIAL_ESTIMATE` and cannot reach `COMMITTED`.

---

### S-10 `compute-k-anonymous-aggregates`
**Need:** Day 3–4.
**Search:** `k-anonymity sql group having`, `differencing attack aggregates`.
**Do:** SQL aggregate with `distinct_clusters >= 5` gate; fixed 30-day server-anchored window; suppression notice shape from `05 §6`.
**Acceptance:** below-k returns no counts in any field; RLS independently blocks the row; a differencing test with two overlapping windows cannot isolate a single report.

---

### S-11 `render-two-ledger-divergence-card`
**Need:** Day 4.
**Do:** two visually distinct blocks, two provenance lines, never a merged sentence; suppression notice when below k; the refusal script with a copy control and audio.
**Acceptance:** a visual test confirms the two blocks are separate DOM containers with separate source lines; no template concatenates statutory and observed values into one sentence.

---

### S-12 `generate-radio-bulletin-script`
**Need:** Day 4.
**Search:** `sentence frame template engine`, `icu message format`.
**Do:** compose from fixed frames + numeric slots per `07 §6.4`; validate the final script against the frame grammar; block export until `APPROVED_FOR_BROADCAST`.
**Acceptance:** INV-06 passes; a script containing a banned word fails validation; an unapproved bulletin returns `409 E_NOT_APPROVED` on export; approval re-checks every fact's k-status.

---

### S-13 `build-offline-observation-outbox`
**Need:** Day 4.
**Search:** `workbox background sync`, `idb`, `dexie` — **do not hand-roll IndexedDB**.
**Do:** client-generated idempotency key per observation; queue on failure; flush on reconnect; visible sync badge with per-item state.
**Acceptance:** Playwright test goes offline, submits three observations, returns online, and asserts exactly three server rows; a double flush creates no duplicates.

---

### S-14 `implement-append-only-hash-chain`
**Need:** Day 3.
**Search:** `hash chain audit log postgres`, `canonical json stringify`.
**Do:** canonical JSON → `payload_hash` → chain hash; append inside the same transaction as the state change; verifier endpoint.
**Acceptance:** INV-03 and INV-04 pass; verifier detects a manually tampered payload in a test fixture; `UPDATE`/`DELETE` rules prevent mutation.

---

### S-15 `redact-logs-and-pii`
**Need:** Day 3.
**Search:** `pino redact`, `structured logging redaction node`.
**Do:** logger wrapper with a redaction path list covering msisdn, `phone_enc`, storage paths, `actor_ref`, idempotency keys.
**Acceptance:** the adversarial log test injects each sensitive value into every log-emitting path and finds none in output. **Release blocker if failing.**

---

### S-16 `purge-audio-on-ttl`
**Need:** Day 4.
**Do:** cron deletes the storage object, nulls `storage_path`, sets `purged_at`, writes an audit event.
**Acceptance:** test proves the object is gone from storage (not merely flagged) and the row reads `PURGED`.

---

### S-17 `generate-adversarial-test-suite`
**Need:** Day 4. This is a **scored deliverable**, not a chore.
**Do:** implement the 30 cases in `14-testing-and-edge-cases.md` §2 as a distinct `tests/adversarial/` suite with its own CI job and its own README explaining each attack in one line.
**Acceptance:** all 30 pass; the CI job appears as a separate named check; the suite README reads as a threat list, not a test list.

---

### S-18 `localize-content-and-audio`
**Need:** Day 3–5.
**Do:** locale JSON per `16-i18n-and-content.md`; audio manifest; per-locale number decomposition rules; CI parity checks CH-01…CH-06.
**Acceptance:** all channel parity tests pass for `en`, `am`, `om`; a deliberately removed key fails the build.

---

### S-19 `run-accessibility-audit-and-fix`
**Need:** Day 5.
**Search:** `@axe-core/playwright`.
**Do:** audit every surface; fix; commit the fixes as a **separate PR** with the before/after report attached.
**Acceptance:** zero critical/serious violations; the PR is linked in the AI build log as an AI-usage artifact.

---

### S-20 `seed-demo-scenario`
**Need:** Day 5.
**Do:** a single idempotent `npm run seed:demo` that produces the exact state the demo script needs: generator ticket at `REPAIR_CLAIMED`, two witnesses already recorded, one service just above k and one just below, one unofficial-estimate line.
**Acceptance:** running it twice yields the same state; the full demo can be performed immediately after a reset with no manual steps.

---

### S-21 `verify-portability-with-second-country`
**Need:** Day 5. Cheap, high-scoring.
**Do:** add `/config/countries/ke.json` and one KE ward with two projects; prove the same engine renders a KES receipt with different admin tier labels and locale.
**Acceptance:** a test loads both configs and asserts no code path branches on country code; the demo can switch config and show a working Kenyan receipt in under five seconds.

---

### S-22 `write-submission-package`
**Need:** Day 5.
**Do:** README, written summary, deck outline, demo recording per `18-submission-deliverables.md`.
**Acceptance:** every rubric line in `18 §5` has a named artifact that exists in the repo.
