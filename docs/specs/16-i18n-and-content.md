# 16 — Internationalisation and Content

Localisation here is not a translation chore. It is a **trust surface**: a person who hears a civic instruction in a language they do not fully read is deciding whether to act on it. Getting it half-right is worse than not offering it.

## 1. Locales for the PoC

| Code | Language | Script | Channels | Status |
|---|---|---|---|---|
| `en` | English | Latin | text + audio | complete, reference locale |
| `am` | Amharic | Ge'ez | text + audio | complete — the demo locale |
| `om` | Afaan Oromo | Latin | text + audio | complete |
| `sw`, `ha`, `fr` | — | — | — | **keys only, no content.** Ship the shells to prove the pipeline; never ship a half-translated trust product as if it were usable. |

Locale resolution order: `respondent.locale` → explicit menu selection → `ward.locales[0]` → `country.default_locale` → `en`.

## 2. Content model

```
/content
  locales/
    en.json            reference — every key must exist here first
    am.json
    om.json
  audio/
    en/*.mp3
    am/*.mp3
    om/*.mp3
    manifest.json      key → { locale, file, durationMs, sha256 }
    number-rules.en.json
    number-rules.am.json
    number-rules.om.json
```

### Key naming

`<domain>.<subject>[.<variant>]` — for example `narrative.under_probation_n_days`, `q.generator.fridge_green`, `divergence.not_enough_reports`.

Rules:
- Keys are stable forever. Changing meaning means a **new key**, never an edit in place — otherwise a translated locale silently drifts from the English it was translated from.
- Every key that appears on a citizen surface must have an audio file in every shipped locale. Enforced by CH-03/CH-04.
- No key may contain a hardcoded number, currency symbol or date. Enforced by CH-06.

### Slots

Named slots only, in `{braces}`. No positional arguments — translators reorder clauses and positional args break silently.

```jsonc
"observation.counted": "Thank you. {count} of {target} neighbours have checked."
```

Slot values arrive pre-formatted from `domain/content.ts`: numbers, currency and dates are formatted per locale **before** substitution, so a template never performs formatting.

### Pluralisation

Explicit variant keys, not a runtime pluraliser:

```jsonc
"probation.days_left.one":   "1 day left before it can be closed.",
"probation.days_left.other": "{days} days left before it can be closed."
```

Amharic and Afaan Oromo plural behaviour differs from English; a generic ICU pluraliser configured by an agent is a common silent-wrongness source. Explicit keys are verifiable by eye.

## 3. Number and currency rendering

**Text:** `Intl.NumberFormat(locale)` with the ward's currency; minor units divided at the boundary, never in a template.

**Audio:** numbers are decomposed and stitched from a phrase bank. Decomposition rules are per locale:

```jsonc
// number-rules.en.json
{
  "bank": ["num.1"…"num.20", "num.30", "num.40", …, "num.100", "num.1000", "num.10000", "num.100000", "num.1000000"],
  "decompose": "descending-additive",
  "connector": null,
  "examples": { "320000": ["num.300000","num.20000"], "50": ["num.50"] }
}
```

Each locale file carries **six worked examples** that are asserted in CI. If the phrase bank cannot express an amount, the system falls back to reading digits individually and logs a content gap — it never guesses and never goes silent.

## 4. The provenance sentence

The single most important localised string in the product. Composed from structured facts only:

```jsonc
"provenance.sentence": "{count} neighbours checked this on {weekday}. {yes} said yes, {no} said no. Last checked {ago}."
```

Translation notes shipped alongside the key (translators need intent, not just text):

> This sentence is how a person who cannot read learns why to believe the answer. Keep it plain and factual. Do not add reassurance. Do not add "verified", "confirmed" or "official". The numbers carry the meaning.

## 5. Refusal scripts — the highest-stakes translation

```jsonc
"script.request_official_receipt": "{source} states the fee is {currency} {fee}. May I have an official receipt for any additional amount?"
```

Constraints:
- **Always a question, never an accusation.** A question is socially safe to say to an official's face; an accusation may get the person thrown out or worse.
- Register must be polite-formal in every locale. In Amharic this means honorific verb forms; a literal translation that lands as informal is a safety defect, not a style issue.
- Must be sayable in one breath.
- Must survive being overheard.

**Process rule:** refusal scripts must be reviewed by a native speaker before the demo, and the reviewer's initials recorded in `/content/locales/REVIEWERS.md`. If no reviewer is available before submission, say so in the written summary rather than shipping an unreviewed script as though it were validated. That admission scores better than a false claim.

## 6. Translation workflow with the agent

Allowed:
- Generate the key scaffold and the `en` reference strings.
- Produce **draft** `am` and `om` translations, clearly marked `"__draft": true` in the file.
- Generate translation notes, glossaries and slot documentation.
- Build the manifest, run parity checks, and flag gaps.

Not allowed:
- Marking a draft as final without a human pass.
- Translating a refusal script, a narrative state sentence, or a bulletin frame without human review — these three carry legal and physical safety consequences.
- Inventing a key not present in `en`.
- Generating audio for a language via TTS and presenting it as the local-language voice. Audio is **recorded**, not synthesised. If the demo carries a synthetic voice, say so on screen.

A `"__draft": true` marker anywhere in a locale file makes CI emit a warning and adds a banner to the console. It never blocks the build — shipping an honestly-labelled draft is acceptable; shipping an unlabelled one is not.

## 7. CI checks (from `06 §11`, restated as build gates)

| ID | Check | Severity |
|---|---|---|
| CH-01 | Key parity: every `en` key exists in every shipped locale | fail |
| CH-02 | Every USSD-rendered string ≤182 chars in every locale | fail |
| CH-03 | Every citizen-surface key has an audio file in every shipped locale | fail |
| CH-04 | Every manifest entry resolves to a non-zero file with a matching `sha256` | fail |
| CH-05 | Every USSD terminal node renders `END`, every non-terminal `CON` | fail |
| CH-06 | No template contains a hardcoded number, currency symbol or date | fail |
| CH-08 | No template contains a banned-lexicon term (`07 §6.5`) | fail |
| CH-09 | Six number-decomposition examples per locale produce the expected key sequence | fail |
| CH-10 | No `"__draft": true` in a locale used by the recorded demo | warn |

## 8. Adding a language (the portability proof)

Document this as a numbered procedure in the README — it is the cheapest possible evidence for the Scalability criterion:

1. Copy `en.json` → `<locale>.json`, translate values, keep keys identical.
2. Record audio for every key in the citizen-surface list; drop files in `/content/audio/<locale>/`.
3. Run `npm run audio:manifest` to hash and register them.
4. Add `<locale>` to the ward's `locales` array.
5. Add `number-rules.<locale>.json` with six worked examples.
6. Run `npm run test:unit -- channels` — CH-01…CH-09 must pass.
7. Native-speaker review of the three high-stakes key groups; record initials in `REVIEWERS.md`.

**No code changes. No deployment changes. No schema changes.** That sentence belongs on the scalability slide.

## 9. Country content vs. language content

Keep these separate; conflating them is what makes civic products unportable:

| Layer | Lives in | Example |
|---|---|---|
| **Language** | `/content/locales/` | how "official fee" is phrased |
| **Country** | `/config/countries/` | that the tier is called *Woreda*, currency is ETB, the appeal body is the woreda ombuds |
| **Ward** | `/config/wards/` | which radio partner, which services exist, which asset types are present |
| **Service** | `/config/services/` | the statutory fee ceiling and document list, with its citation |

A Kenyan deployment changes three config files and one locale file. It changes **zero** lines of `/src/domain`. There is a test that asserts this: `tests/unit/portability.test.ts` loads both country configs and fails if any code path branches on country code.
