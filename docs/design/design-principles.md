# Design Principles — Ubuntu Ledger / Ward Proof-Line

> **Product identity in one sentence:** A public evidence system for ward-level infrastructure accountability.
>
> Never: "AI-powered civic intelligence." Never: "next-generation transparency platform." Never anything that would appear on a SaaS landing page.

---

## 1. Design Brief

Ubuntu Ledger is civic accountability infrastructure. Its job is to make a single question answerable with evidence:

> **Did the public money for this repair actually produce a working repair?**

The design must serve that question. Every element that does not help an evaluator understand the proof is noise, and noise erodes trust in civic systems.

### Three surfaces, three registers

The design deliberately splits into three visually distinct registers. Getting the *contrast between them* right is most of the design work.

| Surface | Primary audience | Register | Governing rule |
|---|---|---|---|
| **Feature-phone simulator** | Judges, journalists watching a demo | Hardware, monochrome, physical | Must read as a *phone*, not a web widget |
| **Public receipt page** | Ward residents, journalists, auditors | Printed document — quiet, high contrast, dense numerals | Must read as a *receipt*, not a dashboard |
| **Console** (admin/moderator/ingest) | Operators | Deliberately plain, dense, unstyled-feeling | Must read as *a tool*, not a product |

**Allocate all visual weight to the simulator.** Everything else stays quiet.

---

## 2. Core Design Principles

### Principle 1 — Less interface, more evidence

Every element earns its place by helping the evaluator understand the proof. If a component does not directly surface evidence, source provenance, or state — it should not exist.

Ask of every element: *Does this help someone decide whether the repair happened?* If no, remove it.

This rules out:
- Decorative illustrations
- Progress rings showing percentages
- Sparklines or activity charts
- Hero banners
- Any element that celebrates the *product* rather than the *evidence*

### Principle 2 — Three visual registers

The simulator is **bold**. The receipt is **quiet**. The console is **plain**.

These registers must feel like different media — like a physical phone, a printed receipt, and a terminal window sharing the same screen. If all three feel like the same web app, the design has failed.

- Simulator: dark shell, LCD greenish-grey (`--lcd-bg`), monospaced keypad — physical, hardware
- Receipt: `--paper` background, `--ink` text, hairline rules, narrow column, serif whitespace rhythm — printed
- Console: no shadows, no cards, no gradients, system-feeling density — tool

### Principle 3 — Receipt as the primary metaphor

The product's central metaphor is a supermarket receipt for public money. This is not a dashboard. This is not an app. This is not a portal.

A receipt is:
- **Narrow** — single column, printed width
- **Structured by hairlines** — not by card borders or rounded boxes
- **Right-aligned amounts** — monospaced, always
- **Source-stamped** — issuer, page reference, hash, archive date are primary content, not metadata footnotes
- **Perforated** — the fold and tear aesthetic signals finality and authenticity

This metaphor must hold across every public-facing surface.

### Principle 4 — State colors carry meaning, not aesthetics

The four state colors (`--state-open`, `--state-hold`, `--state-break`, `--state-none`) are semantic signals, not decoration. Their usage is strictly controlled:

- They appear **only** to communicate state
- They are **never** used to add visual interest or brand color to a layout
- State is **always** communicated with color **plus a word** — never by color alone
- The desaturation is intentional: `--state-break` (oxide red) must read as *serious*, never as *alarming*. This product must never look like it is accusing someone.

**Violation:** Using `--state-open` as an accent color on a button that is not communicating open status.

### Principle 5 — Typography as structure

Whitespace and type hierarchy replace cards. The receipt surface uses no card components. Structure is created by:
- Hairline rules (`--rule`) as section dividers
- Type scale contrast (34px amounts vs 13px provenance)
- Monospaced alignment for columns and codes
- Breathing room above and below section breaks

**Avoid:**
- All-caps labels on every section heading
- Single-word color accents inside headlines
- Eyebrow labels above every heading
- The `->` glyph appended to buttons
- Card-everything layouts that box every piece of information

The only all-caps string in the product is `NO SOURCE DOCUMENT`, where the shout carries information.

### Principle 6 — Concrete language

The copy must be written for someone who has never used a civic tech product. Every label, status message, and notification uses concrete declarative language.

| Avoid | Use instead |
|---|---|
| "AI-powered civic intelligence" | "A public evidence system for ward-level repair accountability" |
| "Capital expenditure allocation" | "The money was given for a generator" |
| "Verification in progress" | "Repair claimed. Under 7-day check. 5 days left." |
| "Transaction complete" | "Your answer was recorded. Results show in 7 days." |
| "Data ingested successfully" | "Budget document page 41 added. Reviewer initials required." |

Reading level: short declarative sentences, concrete nouns, no procurement vocabulary.

### Principle 7 — Evidence-first provenance

The source block is **never collapsed, never hidden behind a disclosure, never placed below the fold**.

Provenance is primary content:
- Issuer name
- Document page reference
- Archive date
- SHA-256 hash (truncated: first 6 chars + last 4 chars)

When no source document exists, the source block is replaced by a full-width `NO SOURCE DOCUMENT` band in `--state-none`. The amount renders in grey. This is not an error state — it is an honest state.

### Principle 8 — Accessibility floor

These are non-negotiable requirements, not aspirational goals:

- Text contrast >= 4.5:1 for all text
- State indicator contrast >= 3:1
- State communicated by color **plus** a visible text label
- Visible keyboard focus on every interactive element
- `prefers-reduced-motion` respected — the keypad depress is the only motion and it is user-triggered
- Touch targets >= 44 px on the PWA
- `aria-live` on the witness counter so changes are announced to screen readers
- Full screen-reader labels on the console

---

## 3. Visual Identity

### The receipt metaphor — not a SaaS palette

The palette is ink on newsprint. It is chosen because the product's central metaphor is a receipt for public money, not a productivity app.

The `--paper`/`--ink` foundation reads as institutional without being governmental-bland or corporate-designed. The deliberate avoidance of cream-plus-terracotta and near-black-plus-acid-accent pairings prevents the product from looking like a generated design template.

State colors are desaturated earth tones because:
1. They must survive monochrome printing
2. They must not read as alarming in a civic context
3. They must remain legible alongside `--ink` on `--paper`

### Identity vocabulary

| Concept | Word to use | Word to avoid |
|---|---|---|
| The product | "evidence system" / "proof-line" | "platform", "app", "solution" |
| A claim | "claimed repair" / "submitted proof" | "ticket", "submission", "case" |
| A check | "community check" / "neighbour observation" | "verification", "crowdsourced audit" |
| The budget line | "public spending" / "budget record" | "transaction", "contract award" |
| The receipt | "public receipt" / "ward receipt" | "dashboard", "report", "summary" |

---

## 4. Typography

### Typefaces

| Role | Typeface | Rationale |
|---|---|---|
| Public receipt body, console body | **IBM Plex Sans** | Neutral; excellent Latin coverage; good multilingual support; reads as institutional without being corporate. SIL OFL licensed. |
| Numerals, contract codes, amounts, hashes | **IBM Plex Mono** | Money and codes must align in columns and be unmistakably transcribable. Functional, not decorative. |
| Amharic / Ge'ez script | **Noto Sans Ethiopic** | Only dependable option for Ethiopic script. Pair at 1.05x the Latin size so x-heights match. |
| Feature-phone LCD display | **IBM Plex Mono**, letter-spaced | Matches real USSD constraints; the constraint is visible in the design. Rendered at 4 lines x 20 chars. |

### Type scale — receipt surface

| Step | Size | Usage |
|---|---|---|
| `text-xs` | 13px | Provenance lines, hashes, secondary metadata |
| `text-sm` | 15px | Body copy, descriptions |
| `text-base` | 18px | Section headings, primary labels |
| `text-lg` | 24px | Status summaries, witness counts |
| `text-xl` | 34px | Contract amounts, primary numerals |

- **Maximum line length:** 62 characters (receipt column width)
- **Amharic body:** +0.15 line-height over Latin equivalent
- **Amount alignment:** always right-aligned, monospaced

### Typography rules

- No all-caps except `NO SOURCE DOCUMENT`
- No single-word color accents inside headlines
- No eyebrow labels above every heading (only where structurally necessary)
- No `->` glyph on buttons
- No decorative use of monospace — only for codes, amounts, hashes, and LCD content

---

## 5. Color Usage Rules

### Foundation palette

| Token | Value | Usage |
|---|---|---|
| `--paper` | `#FBFAF7` | Public receipt background; the "page" |
| `--ink` | `#14150F` | Primary text — headings, amounts, labels |
| `--ink-soft` | `#55564C` | Secondary text — provenance lines, helper copy |
| `--rule` | `#D9D7CC` | Hairlines, section dividers, receipt perforations |

### State palette

| Token | Value | State | Never used for |
|---|---|---|---|
| `--state-open` | `#1F5C3D` | Confirmed / sustained / active | Accent color, branding, highlighting |
| `--state-hold` | `#8A5A00` | Probation / awaiting / below threshold | Warning decoration |
| `--state-break` | `#8C2F22` | Discrepancy / probation failed | Error icons, danger warnings |
| `--state-none` | `#6B6C61` | No data / unofficial estimate | Disabled state, placeholder text |

### Feature-phone palette

| Token | Value | Usage |
|---|---|---|
| `--lcd-bg` | `#C3CBB4` | STN LCD green-grey background |
| `--lcd-ink` | `#1B2016` | LCD text |
| `--shell` | `#2A2A28` | Phone shell, keypad surround |

### Rules for state colors

1. State color appears **only when communicating state**
2. State is **always accompanied by a text label** (color alone is never sufficient)
3. State colors do **not** appear in navigation, buttons (unless the button itself conveys state), decorative borders, or illustrations
4. When a line item has no state, it uses `--ink` or `--ink-soft` — never a state color

---

## 6. Anti-Patterns

These patterns are explicitly prohibited and must be rejected in pull requests and design reviews.

### Visual anti-patterns

| Anti-pattern | Why it violates the design |
|---|---|
| Card-everything — every section wrapped in a rounded box | Replaces the receipt metaphor with a dashboard metaphor |
| Progress rings, donut charts, sparklines | Implies trending data; not this product's model |
| Hero banners or splash sections on the receipt page | Prioritizes branding over evidence |
| Gradient backgrounds | Incompatible with the ink-on-paper metaphor |
| Shadows on the console | Makes the console look like a product, not a tool |
| State color used as decoration | Corrupts the semantic meaning of state |
| Icons replacing numbered options | Ambiguous across cultures; numbers are universal |
| Auto-advancing screens or countdown timers on citizen surfaces | Applies time pressure to potentially slow readers |

### Copy anti-patterns

| Anti-pattern | Why it violates the design |
|---|---|
| "Powered by AI" or similar | AI is an implementation detail, not the identity |
| "Platform" / "solution" / "ecosystem" | SaaS vocabulary incompatible with civic infrastructure |
| Acronyms without expansion | Excludes the primary audience |
| "Thank you" as a terminal screen | Leaves the user without knowing what happens next |

### Structural anti-patterns

| Anti-pattern | Why it violates the design |
|---|---|
| Collapsible source block | Provenance is primary content; hiding implies it is optional |
| Amount rendered without a source line | Every number needs a chain of custody |
| Colour-only state differentiation | Fails accessibility; fails monochrome printing |
| Free-text input on citizen surfaces | Excludes low-literacy users |

---

## 7. Core Evaluation Tests

### 10-second test

> Can a person who has never used this product tell, within 10 seconds of looking at the receipt page, whether the repair happened?

The state (word + color), witness count (`n of target` in monospaced), and contract amount must all be visible above the fold on a 375px viewport without scrolling.

**Pass criteria:** State visible as word+color. Witness count visible. No decorative element above the fold.

### 60-second test

> Can a journalist, within 60 seconds, find the source document reference and verify that it matches the claimed amount?

**Pass criteria:** Source block visible on initial render. Contains issuer, page reference, archive date, hash. Hash is selectable. "Prove it" link leads to full event history.

### 5-minute test

> Can an auditor, within 5 minutes, trace from the receipt to the original budget document image and all recorded events?

**Pass criteria:** Every event is attributable. No event is missing a type label. The chain is traversable without leaving the receipt page.

---

*Last updated: 2026-09-17*
*Owned by: Design / Product — Ward Proof-Line*
