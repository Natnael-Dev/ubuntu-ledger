# 08 — UI / UX Design

## 1. Design brief

Three surfaces, three deliberately different visual registers. Getting the *contrast* between them right is most of the design work.

| Surface | Audience | Register | Rule |
|---|---|---|---|
| **Feature-phone simulator** | Judges watching a demo | Hardware, monochrome, literal | Must read as a *phone*, not a web widget. This is the hero. |
| **Public receipt page** | Ward residents with a smartphone, journalists | Printed document, high contrast, large numerals | Must read as a *receipt*, not a dashboard. |
| **Console** (admin/moderator/ingest) | The operator | Deliberately plain, dense, unstyled-feeling | Must read as *a tool*, not a product. A beautiful console signals the dashboard is the product — it is not. |

**Spend all boldness on the simulator.** Everything else stays quiet.

## 2. Design tokens

```css
:root {
  /* Ink on paper — the receipt metaphor, not a SaaS palette */
  --paper:        #FBFAF7;   /* public receipt background */
  --ink:          #14150F;   /* primary text */
  --ink-soft:     #55564C;   /* secondary text, provenance lines */
  --rule:         #D9D7CC;   /* hairlines, receipt perforations */

  /* Meaning colours. Used ONLY for state, never for decoration. */
  --state-open:   #1F5C3D;   /* deep green: sustained / confirmed */
  --state-hold:   #8A5A00;   /* amber-brown: probation, awaiting, below-k */
  --state-break:  #8C2F22;   /* oxide red: discrepancy, probation failed */
  --state-none:   #6B6C61;   /* grey: unofficial estimate, no data */

  /* Feature phone */
  --lcd-bg:       #C3CBB4;   /* STN LCD green-grey */
  --lcd-ink:      #1B2016;
  --shell:        #2A2A28;
}
```

Notes on why these, not the defaults: the palette is an **ink-on-newsprint receipt**, because the product's central metaphor is a supermarket receipt for public money. It avoids the cream-plus-terracotta and near-black-plus-acid-accent pairings that read as generated. State colours are desaturated earth tones so that a red state looks *serious* rather than *alarming* — this product must never look like it is accusing someone.

## 3. Typography

| Role | Face | Why |
|---|---|---|
| Public receipt + console body | **IBM Plex Sans** | Neutral, excellent Latin + good multilingual coverage, reads as institutional without being corporate. |
| Numerals on receipts, contract codes, amounts, countdowns | **IBM Plex Mono** | Money and codes must align in columns and be unmistakably transcribable. This is functional, not decorative. |
| Amharic / Ge'ez script | **Noto Sans Ethiopic** | Only dependable option; pair at 1.05× the Latin size so x-heights match. |
| Feature-phone LCD | **IBM Plex Mono**, letter-spaced, rendered at 4 lines × 20 chars | Matches real USSD constraints; the constraint is visible in the design. |

Type scale (receipt surface): 13 / 15 / 18 / 24 / 34. Line length capped at 62 characters. Amharic body gets +0.15 line-height over Latin.

**Avoid:** all-caps labels, single-word colour accents inside headlines, eyebrow labels above every heading, and the `→` glyph appended to buttons. The only all-caps string in the entire product is `NO SOURCE DOCUMENT`, where the shout carries information.

## 4. Feature-phone simulator (the hero)

```
┌─────────────────────────────────────────┬──────────────────────────────────┐
│                                         │  SESSION TRANSCRIPT              │
│      ┌───────────────────────────┐      │                                  │
│      │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │      │  POST /api/ussd                  │
│      │ Health Post 08 generator  │      │  sessionId  ATUid_9f3c           │
│      │ ETB 320,000  AfroTech     │      │  phone      +2519•••••42         │
│      │ 1 Answer check            │      │  text       "1*4412*1"           │
│      │ 3 Who checked this?       │      │                                  │
│      │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │      │  ← CON Does the fridge show      │
│      └───────────────────────────┘      │    a green light? 1 Yes 2 No     │
│         ┌───┬───┬───┐                   │                                  │
│         │ 1 │ 2 │ 3 │                   │  ── this is the real gateway     │
│         ├───┼───┼───┤                   │     contract, not a mock ──      │
│         │ 4 │ 5 │ 6 │                   │                                  │
│         ├───┼───┼───┤                   │                                  │
│         │ 7 │ 8 │ 9 │                   │                                  │
│         ├───┼───┼───┤                   │                                  │
│         │ * │ 0 │ # │                   │                                  │
│         └───┴───┴───┘                   │                                  │
│                                         │                                  │
│  [ phone: Amina ▾ ]  [ second phone,    │                                  │
│                        same area ]      │                                  │
│  [ mode: USSD | IVR ]                   │                                  │
└─────────────────────────────────────────┴──────────────────────────────────┘
```

Requirements:
- The LCD is exactly 4 lines × 20 characters and **truncates** like a real handset. If a prompt does not fit, that is a content bug to fix, not a display to stretch.
- Keypresses produce a 40 ms tactile depress state and a soft click. This is the only non-user-triggered motion in the product and it exists because it makes the demo feel physical on camera.
- The transcript panel shows the literal HTTP payload. This is the credibility device: a viewer can see that the simulator and a real gateway are the same contract.
- **"Second phone, same area"** submits from a different MSISDN inside the same `cluster_key`. The LCD then shows `observation.duplicate` and the witness counter on screen **does not move**. This is the demo's most important frame; give it a dedicated visual: the counter pulses once and stays at 3.
- IVR mode plays the real audio files with a visible waveform and the audio key being played, so a viewer understands the audio is content, not TTS improvisation.

## 5. Public receipt page

Laid out as an actual receipt: a narrow column, hairline rules, monospaced amounts right-aligned, a perforation motif at the fold.

```
──────────────────────────────────────────
  WOREDA 9                    ET-AA-W09
  Public spending receipt
──────────────────────────────────────────
  4412  Health post generator overhaul
                             ETB 320,000
        AfroTech Infra       due 30 Aug
──────────────────────────────────────────
  SOURCE   Woreda 9 Capital Budget FY2026
           page 41 · archived 12 Sep 2026
           sha256 3b1f9c…7a2e
──────────────────────────────────────────
  STATUS   Repair claimed. Under 7-day
           check. 5 days left before it
           can be closed.
──────────────────────────────────────────
  CHECKED  Nine neighbours checked this on
           Tuesday. Two said it runs;
           seven said it does not.
           [ ▶ hear this ]
──────────────────────────────────────────
  [ prove it ]  → source page + hash + full
                  event history
──────────────────────────────────────────
```

Rules:
- The source block is never collapsed or hidden behind a disclosure. Provenance is primary content.
- Unofficial lines replace the source block with a full-width `NO SOURCE DOCUMENT` band in `--state-none`, and the amount renders in grey rather than ink.
- "Hear this" is present on every receipt and plays the composed provenance sentence. A receipt without an audio control is unfinished.
- No charts. No sparklines. No progress ring. The witness count is rendered as `3 of 3`, in mono.

## 6. Low-literacy interaction rules (non-negotiable)

1. Maximum three questions per task, all yes/no, all answerable by looking.
2. Options are always numbered `1`, `2`, `3` — never lettered, never unnumbered.
3. Every screen with text has an audio control playing the same content in the user's locale.
4. Icons accompany, never replace, numbered options. An icon alone is ambiguous across cultures; a number is not.
5. No free-text input for any public user, anywhere, ever.
6. No time-pressure UI: no countdown timers on citizen surfaces, no auto-advance.
7. Reading level: short declarative sentences, concrete nouns, no procurement vocabulary. "The money was given for a generator" beats "capital expenditure allocation."
8. Every terminal screen tells the user what happens next — never just "thank you."

## 7. Console (deliberately plain)

Four screens only:

| Screen | Contents |
|---|---|
| **Ingest review** | Two-pane: extracted fields on the left, source page image on the right. Every field has a confirm checkbox. Nothing persists until all are confirmed. Reviewer initials required. |
| **Project board** | Dense table: code, title, amount, fiscal state, audit state, witness `n/target`, probation countdown. Sortable. No charts. |
| **Moderation queue** | Flagged discrepancies, voice notes awaiting clearance, bulletins awaiting approval. Each item: approve / reject with a required reason. |
| **Bulletin editor** | The generated script in a fixed frame, with editable slots only. An export button that is visibly disabled with the tooltip *"Needs moderator approval"* until approval lands. |

Console styling: system-default-feeling, dense rows, no cards, no shadows, no gradients. If it looks like a product, it has been over-designed.

## 8. Component inventory

| Component | Surface | Notes |
|---|---|---|
| `FeaturePhone` | simulator | shell, LCD, keypad, transcript panel |
| `LcdScreen` | simulator | 4×20 char grid, truncation, blink cursor |
| `SessionTranscript` | simulator | literal HTTP payload display |
| `ReceiptCard` | public | the receipt column layout |
| `SourceBlock` | public | issuer, page, hash, archive date |
| `UnofficialBanner` | public | the `NO SOURCE DOCUMENT` band |
| `NarrativeState` | public, console | renders derived state + slots; **never computes** |
| `WitnessCounter` | public, simulator | `n of target` in mono; pulse-without-increment on suppressed |
| `ProvenanceSentence` | public | composed sentence + audio play control |
| `ProbationCountdown` | public, console | days remaining; turns `--state-break` on failure |
| `DivergenceCard` | public | two stacked blocks: statutory / observed, or the suppression notice |
| `RefusalScript` | public, simulator | the exact sentence, with a copy control and audio |
| `IngestReviewRow` | console | field + confidence + confirm checkbox |
| `ModerationItem` | console | approve/reject with mandatory reason |
| `BulletinFrame` | console | fixed sentence frames with editable slots only |
| `AuditChainViewer` | public | event list + verifier status |
| `SyncBadge` | PWA | queued / syncing / synced counts |

## 9. Accessibility floor

- Contrast ≥ 4.5:1 for all text, ≥ 3:1 for state indicators; state is **never** communicated by colour alone — always colour plus a word.
- Visible keyboard focus on every interactive element.
- `prefers-reduced-motion` respected; the keypad depress is the only motion and it is user-triggered.
- Touch targets ≥ 44 px on the PWA.
- Full screen-reader labels on the console; `aria-live` on the witness counter so a change is announced.
- Agent must run an automated accessibility audit (axe) and commit the before/after as a separate PR — this is also an AI-usage artifact.

## 10. Demo-readiness requirements for the UI

Because Presentation is 25%, these are functional requirements, not polish:

- Every state change visible in the demo must be legible at 1080p when the browser is at 100% zoom with a 1280 px viewport.
- The suppressed-duplicate message must occupy at least a third of the LCD — it is the money frame.
- The probation countdown must be readable across the room.
- The disabled export button's tooltip must be visible without hovering (render it as inline helper text, since a hover tooltip does not record well on video).
