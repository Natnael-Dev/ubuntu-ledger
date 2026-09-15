# 06 — Voice, USSD and SMS

## 1. Design constraints that drive everything here

| Constraint | Consequence |
|---|---|
| USSD page limit ~182 chars | Every prompt is short. A CI test asserts every rendered prompt in every locale is ≤182 chars. |
| Session timeout ~20–30 s per page | Max 3 questions per task. No confirmation screens. No "are you sure?" |
| The user may be standing at the asset | Questions must be answerable by looking, not remembering. |
| The user may not read | Every text prompt has a matching audio key. Parity is enforced in CI. |
| Amharic/Afaan Oromo script may not render on a feature phone | USSD text falls back to the Latin-transliterated locale variant when the handset profile is unknown; IVR carries the real language. |
| The phone may be borrowed | No session persists anything identifying on the device. Nothing to delete afterwards. |

## 2. USSD menu tree (canonical)

```
*890#
│
├── 1  Check a project                       [J1, J2]
│    └── enter project code (4 digits)
│         ├── [found]    show receipt line (title, amount, contractor, narrative state)
│         │    └── 1 Answer the check task    → question 1 → question 2 → [question 3] → END
│         │       2 Hear this again           → replay (IVR only)
│         │       3 Who checked this?         → provenance sentence → END
│         └── [not found] END with "code not recognised. Codes are on the project board."
│
├── 2  Service fees                           [J4, J5]
│    └── choose service (1 ID replacement, 2 Clinic intake)
│         └── show statutory card:
│              official fee, documents, expected visits
│              ├── 1 What do I say if asked for more?  → refusal script → END
│              ├── 2 What do others report?            → k-gated divergence OR "not enough reports yet"
│              └── 3 I have already visited            → outcome code menu → END
│
├── 3  Report a fault                         [J6]
│    └── enter asset code
│         └── 1 It is not working  2 It is working now → END (feeds probation)
│
└── 4  Language / ቋንቋ / Afaan
     └── 1 English  2 አማርኛ  3 Afaan Oromoo → persists to respondent.locale
```

**Navigation rules**
- `0` always means "back one level"; `00` always means "main menu". Present on every page footer where space allows.
- Never more than 4 options on a page.
- Never ask a question whose answer the system already has.
- An invalid entry re-renders the same page with a one-line hint. It never ends the session.

## 3. Proof-task question sets (per asset type)

These live in `/config/asset-types/*.json`. Rules: 2–3 questions, strictly yes/no, observable in under five minutes, no judgement words ("adequate", "properly", "good").

**borehole.json**
1. `Is a handpump head fitted to the borehole?` → `q.borehole.head_fitted`
2. `Pump the handle for 30 seconds — does water come out?` → `q.borehole.water_flows`
3. `Is a project board with a contract number posted?` → `q.borehole.board_posted`

**generator.json**
1. `When mains power stops, does the generator run?` → `q.generator.runs_on_outage`
2. `Does the vaccine fridge show a green light?` → `q.generator.fridge_green`
3. `Is a project board with a contract number posted?` → `q.generator.board_posted`

**latrine_block.json**
1. `Are all doors fitted and closing?` → `q.latrine.doors_fitted`
2. `Is there water at the handwashing point?` → `q.latrine.water_present`
3. `Is a project board with a contract number posted?` → `q.latrine.board_posted`

> Question 3 is deliberately identical across asset types. It is the cheapest cross-asset integrity signal and it makes the task template system visibly reusable.

## 4. Prompt templates (message keys with slots)

Templates live in `/content/locales/{locale}.json`. **Never concatenate strings in code.** Slots are named; pluralisation is handled by explicit variant keys, not by a runtime pluraliser.

```jsonc
{
  "menu.root": "1 Check a project\n2 Service fees\n3 Report a fault\n4 Language",
  "prompt.enter_project_code": "Enter the 4-digit project code from the board:",

  "receipt.summary": "{title}. {currency} {amount}. Contractor {contractor}. Due {due}.",
  "receipt.unofficial": "{title}. {currency} {amount}. NO SOURCE DOCUMENT — this figure is an estimate.",

  "q.generator.runs_on_outage": "When mains power stops, does the generator run? 1 Yes 2 No",
  "q.generator.fridge_green":   "Does the vaccine fridge show a green light? 1 Yes 2 No",

  "observation.counted":   "Thank you. {count} of {target} neighbours have checked.",
  "observation.duplicate": "Thank you. This area has already been counted, so the total stays at {count}.",

  "narrative.under_probation_n_days": "Repair claimed. Under 7-day check. {days} days left before it can be closed.",
  "narrative.reports_disagree":       "Reports disagree. A moderator is reviewing. Do not treat this as settled.",
  "narrative.repair_failed_durability":"Repair did not last 7 days. Contract {code}. Ask at the ward meeting.",
  "narrative.awaiting_reports_n_of_3": "{count} of {target} neighbours have checked so far.",
  "narrative.no_source_document":      "No source document found for this figure.",

  "provenance.sentence": "{count} neighbours checked this on {weekday}. {yes} said yes, {no} said no. Last checked {ago}.",

  "statutory.card": "Official fee {currency} {fee}. Bring: {documents}. Expected visits: {visits}.",
  "script.request_official_receipt": "{source} states the fee is {currency} {fee}. May I have an official receipt for any additional amount?",

  "divergence.summary": "In the last 30 days, {pct}% of {n} reports said more than the official fee was requested. Median extra: {currency} {median}.",
  "divergence.not_enough_reports": "Not enough reports yet to show a pattern. Your report was recorded.",

  "outcome.menu": "1 Paid official fee\n2 Asked for more\n3 No receipt given\n4 Extra document asked\n5 Office closed",
  "outcome.recorded": "Recorded. Thank you.",

  "error.code_not_found": "Code not recognised. Codes are printed on the project board.",
  "error.task_closed": "This check has closed. Dial 1 for another project."
}
```

**Copy rules (enforce in review):**
- Sentence case. No ALL CAPS except the single `NO SOURCE DOCUMENT` flag, where the shout is the information.
- Never the words bribe, corrupt, theft, illegal, criminal.
- Never "verified" without who and when attached.
- Refusal scripts are always **questions**, never accusations — a question is safe to say to an official's face.

## 5. The provenance sentence (this is the trust UI for non-readers)

Every substantive answer ends with one spoken sentence naming who, how many, and when:

> *"Nine neighbours checked this on Tuesday. Two said the generator runs; seven said it does not. Last checked two days ago."*

Composed by `domain/content.ts` from structured facts only — it can never contain a name, a free-text string, or an interpretation. This sentence replaces every confidence badge in the product. **There is no colour-coded trust score anywhere.**

## 6. IVR flow

Same tree as USSD, delivered as audio with DTMF input.

```
[answer] → audio: greeting + language menu (if locale unknown)
        → audio: menu.root
        → DTMF 1
        → audio: prompt.enter_project_code
        → DTMF 4412 + #
        → audio: receipt.summary   (numbers stitched from the number phrase bank)
        → audio: q.generator.runs_on_outage
        → DTMF 1
        → audio: q.generator.fridge_green
        → DTMF 2
        → audio: observation.counted + provenance.sentence
        → [hang up]
```

**Number rendering:** `320,000` is spoken by stitching phrase-bank clips (`num.300000`, `num.20000`) per locale. Number stitching rules differ per language and live in `/content/audio/number-rules.{locale}.json`. Test with 6 fixture amounts per locale.

**Timeouts:** 8 s to respond, one repeat, then a graceful close with `prompt.call_back_hint`. Never leave dead air.

## 7. Open Voice — the deliberate ASR decision

**Decision: there is no automatic speech recognition on the critical path.**

Rationale, and say this in the pitch rather than hiding it: Amharic and Afaan Oromo ASR accuracy is not dependable enough to place inside a product whose entire proposition is trustworthy information. A mis-transcribed civic claim is exactly the harm we exist to prevent. We therefore invert the usual design:

| Stage | How it works here |
|---|---|
| Intake | Structured intent comes from **DTMF keypresses**, which are lossless. |
| Optional voice note | A citizen may leave ≤60 s of audio as *supplementary colour*, never as the data. |
| Structuring | The structured record is already complete from DTMF. The voice note is attached, not parsed. |
| Moderation | A human moderator listens and either clears or rejects. No transcript is ever stored. |
| Output | The ward's finding is spoken back as a **composed provenance sentence** built from structured facts — not as a replayed citizen clip. |
| Purge | The audio blob is hard-deleted at 48 h, unconditionally. |

Optional P2 only: Whisper-small transcription shown **to the moderator as a listening aid**, never persisted, never published, never used to change a state. If it is built, it must be behind a feature flag defaulting to off.

**Why this scores better than real ASR:** it turns a technical limitation into a stated trust principle, and it removes the single largest demo-failure risk from the build.

## 8. Zero-PII audio handling

1. Record to Supabase storage under a path containing only a UUID — never a phone number, ward name or date.
2. Write `purge_after = created_at + 48h` at insert time; the DB `CHECK` constraint makes a longer TTL impossible.
3. Cron purge deletes the blob, nulls `storage_path`, sets `purged_at`, writes an audit event.
4. No transcript column exists in the schema. Do not add one.
5. Moderator playback is via a short-lived signed URL (≤5 min), logged as an audit event.
6. Test `ADV-19` asserts that after TTL, the object is gone from storage **and** the row shows `PURGED`.

## 9. SMS design

SMS is the asynchronous companion to USSD, used for: task dispatch, probation re-check pings, bulletins to the presenter, and delivery of the statutory card for later reference.

- Outbound messages ≤160 GSM-7 characters where possible; if a locale forces UCS-2, budget 70 characters and test it.
- Every outbound message ends with the ward code so a recipient always knows the source.
- No outbound message ever contains a person's name, an allegation, or an unapproved bulletin fact.
- Inbound parsing is keyword-based (see `05 §2`) and forgiving: strip punctuation, collapse whitespace, accept lowercase.

## 10. The feature-phone simulator

Built as a first-class surface, not a toy, because it is what judges will actually watch.

- Renders a monochrome 4-line display with a numeric keypad; visually a feature phone, not a styled web component.
- Calls the **real** `/api/ussd` endpoint with the real gateway payload shape. No mocking.
- Has a visible session transcript panel beside the phone so a viewer can see the `text` string accumulating — this makes the "it is the real contract" claim self-evident on camera.
- Has an IVR mode that plays the actual audio files.
- Has a "second phone, same area" button that submits from a different MSISDN inside the **same** cluster. This single button drives the demo's sybil moment.
- No network-condition toggle needed for USSD (it needs no data); the airplane-mode toggle lives on the Monitor PWA instead.

## 11. Channel parity tests (CI)

| Test | Assertion |
|---|---|
| `CH-01` | Every message key present in `en` exists in `am` and `om`. |
| `CH-02` | Every message key with a USSD render is ≤182 chars in every locale. |
| `CH-03` | Every message key used in an IVR flow has a matching audio file in every locale. |
| `CH-04` | Every audio file referenced in the manifest exists and is non-zero length. |
| `CH-05` | Every USSD terminal node ends with `END` and every non-terminal with `CON`. |
| `CH-06` | No message template contains a hardcoded currency symbol, number or date. |
| `CH-07` | Submitting the identical `text` string twice produces identical output (session reducer is pure). |
