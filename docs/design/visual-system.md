# Visual System — Ubuntu Ledger / Ward Proof-Line

> This document is the single source of truth for all design tokens, typographic rules, spacing, component patterns, and composition rules. Every implementation decision should trace back to a rule in this document.

---

## 1. Design Token Reference

All tokens are CSS custom properties. Define them in `:root` in `globals.css`.

### Foundation — Ink on Paper

```css
:root {
  /* ── Surface ─────────────────────────────────────── */
  --paper:        #FBFAF7;   /* public receipt background */
  --ink:          #14150F;   /* primary text */
  --ink-soft:     #55564C;   /* secondary text, provenance lines */
  --rule:         #D9D7CC;   /* hairlines, receipt perforations */

  /* ── State (semantic only — never decorative) ────── */
  --state-open:   #1F5C3D;   /* deep green: confirmed / active */
  --state-hold:   #8A5A00;   /* amber-brown: awaiting / below threshold */
  --state-break:  #8C2F22;   /* oxide red: discrepancy / failed */
  --state-none:   #6B6C61;   /* grey: unofficial / no data */

  /* ── Feature-phone ───────────────────────────────── */
  --lcd-bg:       #C3CBB4;   /* STN LCD green-grey */
  --lcd-ink:      #1B2016;
  --shell:        #2A2A28;
}
```

### Token Usage Cheat Sheet

| Token | Use | Do not use for |
|---|---|---|
| `--paper` | Page background, receipt surface | Component backgrounds that differ from the page |
| `--ink` | All primary text, amounts, headings | State communication |
| `--ink-soft` | Provenance lines, secondary labels, helper text | Primary headings |
| `--rule` | Horizontal rules, column dividers, hairlines | Emphasis borders |
| `--state-open` | OPEN status label + indicator only | Any decorative purpose |
| `--state-hold` | HOLD / AWAIT status label + indicator only | Any decorative purpose |
| `--state-break` | BREAK / DISCREPANCY status label + indicator only | Error UI decoration |
| `--state-none` | NO DATA label + `NO SOURCE DOCUMENT` band only | Disabled buttons |
| `--lcd-bg` | LCD panel background inside the simulator only | Any other surface |
| `--lcd-ink` | LCD panel text only | Any other surface |
| `--shell` | Phone shell, keypad surround only | Page backgrounds |

---

## 2. Typography System

### Font Stack

```css
:root {
  --font-sans:     'IBM Plex Sans', system-ui, sans-serif;
  --font-mono:     'IBM Plex Mono', 'Courier New', monospace;
  --font-ethiopic: 'Noto Sans Ethiopic', sans-serif;
}
```

### Loading (Google Fonts / self-hosted)

```html
<!-- Latin -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=Noto+Sans+Ethiopic:wght@400;600&display=swap" rel="stylesheet">
```

> Prefer self-hosting for offline / PWA resilience. Use `next/font` with `display: swap`.

### Type Scale

```css
:root {
  --text-xs:   13px;   /* provenance, hashes, secondary metadata */
  --text-sm:   15px;   /* body copy, descriptions */
  --text-base: 18px;   /* section headings, primary labels */
  --text-lg:   24px;   /* status summaries, witness counts */
  --text-xl:   34px;   /* contract amounts, primary numerals */
}
```

### Line Height and Measure

```css
:root {
  --leading-tight:  1.25;   /* headings, amount numerals */
  --leading-body:   1.5;    /* body copy, descriptions */
  --leading-loose:  1.65;   /* provenance blocks, long-form */
  --leading-eth:    1.65;   /* Amharic/Ethiopic body (leading-body + 0.15) */
  --measure:        62ch;   /* max line length — all receipt surfaces */
}
```

### Role Mapping

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Amount / primary numeral | Mono | `--text-xl` (34px) | 500 | Right-aligned, tabular figures |
| Section heading | Sans | `--text-base` (18px) | 600 | Title case, no all-caps |
| Status label | Sans | `--text-sm` (15px) | 500 | Paired with state color dot |
| Body / description | Sans | `--text-sm` (15px) | 400 | Max `--measure` |
| Provenance line | Sans | `--text-xs` (13px) | 400 | `--ink-soft` |
| Hash / code | Mono | `--text-xs` (13px) | 400 | `--ink-soft`, selectable |
| Witness count | Mono | `--text-lg` (24px) | 500 | `n of target` format |
| Amharic body | Ethiopic | `--text-sm` × 1.05 | 400 | `--leading-eth` |
| LCD display | Mono | fixed 4×20 grid | 400 | `--lcd-ink` on `--lcd-bg` |
| Console body | Sans | `--text-xs` (13px) | 400 | Dense, `--ink` on `#FFFFFF` |

### Typography Rules — Enforced

1. `NO SOURCE DOCUMENT` is the **only** all-caps string in the product
2. The `->` glyph (`→`) is prohibited on buttons
3. No eyebrow labels (small uppercase text above headings) unless structurally required
4. No single-word color accents inside headlines
5. Amounts always use tabular figures and are right-aligned
6. Hashes display as: first 6 chars · last 4 chars (`3b1f9c···7a2e`)

---

## 3. Color Semantic Palette

### Contrast Ratios (required)

| Foreground | Background | Ratio | Requirement |
|---|---|---|---|
| `--ink` `#14150F` | `--paper` `#FBFAF7` | ~17.5:1 | >= 4.5:1 (passes AAA) |
| `--ink-soft` `#55564C` | `--paper` `#FBFAF7` | ~7.1:1 | >= 4.5:1 (passes AA) |
| `--state-open` `#1F5C3D` | `--paper` `#FBFAF7` | ~7.2:1 | >= 3:1 (passes AA) |
| `--state-hold` `#8A5A00` | `--paper` `#FBFAF7` | ~5.5:1 | >= 3:1 (passes AA) |
| `--state-break` `#8C2F22` | `--paper` `#FBFAF7` | ~6.0:1 | >= 3:1 (passes AA) |
| `--state-none` `#6B6C61` | `--paper` `#FBFAF7` | ~5.2:1 | >= 3:1 (passes AA) |
| `--lcd-ink` `#1B2016` | `--lcd-bg` `#C3CBB4` | ~8.3:1 | >= 4.5:1 (passes AAA) |

> Run `npx axe-cli <url>` before every release. Commit the before/after report as a separate PR artifact.

### State Dot Pattern

Every state label is accompanied by a 8px circle in the state color:

```html
<!-- Example: Open state -->
<span class="state-badge state-open">
  <span class="state-dot" aria-hidden="true"></span>
  Open
</span>
```

```css
.state-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.state-open  .state-dot { background: var(--state-open); }
.state-hold  .state-dot { background: var(--state-hold); }
.state-break .state-dot { background: var(--state-break); }
.state-none  .state-dot { background: var(--state-none); }
```

---

## 4. Spacing System

Spacing uses a 4px base unit. All spacing values are multiples of 4.

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
}
```

### Spacing Rules by Surface

| Context | Spacing |
|---|---|
| Between receipt sections (across hairline) | `--space-4` above, `--space-4` below |
| Provenance block internal padding | `--space-3` vertical, `--space-4` horizontal |
| Receipt column padding | `--space-4` horizontal on mobile; `--space-6` on desktop |
| Console row height | `--space-8` (32px) — dense |
| Console row padding | `--space-2` vertical, `--space-4` horizontal |
| Touch target minimum | 44px (override spacing as needed) |
| LCD grid cell | Fixed 20-char width, 4-line height — do not override |

---

## 5. Border, Radius, and Shadow Rules

### Receipt Surface

```css
/* Hairline rules — the only dividers on the receipt */
.receipt-rule {
  border: none;
  border-top: 1px solid var(--rule);
  margin: var(--space-4) 0;
}

/* No rounded corners on the receipt surface */
/* No card shadows on the receipt surface */
/* No box-shadow on receipt sections */
```

### Console Surface

```css
/* Table row separators — lighter than receipt rules */
.console-row {
  border-bottom: 1px solid var(--rule);
}

/* No shadows, no card borders, no rounded corners */
/* Console header row uses --ink-soft text on white background */
```

### Simulator Surface

```css
/* Phone shell */
.phone-shell {
  background: var(--shell);
  border-radius: 12px;         /* only rounded element — the phone corners */
  box-shadow: 0 8px 32px rgba(0,0,0,0.45);  /* one shadow, only here */
}

/* LCD panel */
.lcd-panel {
  background: var(--lcd-bg);
  border-radius: 2px;
  border: 1px solid rgba(0,0,0,0.2);
}
```

**Shadow policy:**
- One shadow allowed: on the phone shell (the hero element)
- No shadows on cards, sections, panels, or console rows
- No inset shadows
- No text-shadow

**Radius policy:**
- Phone shell corners: 12px
- LCD panel: 2px
- Status dots: 50% (circle)
- Everything else: 0px (no radius)

---

## 6. Component Patterns

### 6.1 Navigation

The console uses a minimal top navigation. The receipt page uses no navigation chrome.

```
┌─────────────────────────────────────────────────┐
│  Ward Proof-Line          [Ingest] [Board] [Mod] │
└─────────────────────────────────────────────────┘
```

- Plain background (white), `--ink` text, `--rule` bottom border
- Active page: `--ink` with 2px `--ink` underline
- No icons in navigation
- No hamburger menus — console is desktop-only
- Receipt page: no navigation bar; only a text link "Back to ward list" at top-left

### 6.2 Buttons

Three button roles only:

**Primary action** (used sparingly — max one per screen):
```css
.btn-primary {
  background: var(--ink);
  color: var(--paper);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 500;
  padding: var(--space-2) var(--space-4);
  border-radius: 0;          /* no radius */
  border: none;
  cursor: pointer;
}
```

**Secondary action** (audit links, "prove it"):
```css
.btn-secondary {
  background: transparent;
  color: var(--ink);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 400;
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--ink);
  border-radius: 0;
  cursor: pointer;
}
```

**Disabled state** (export awaiting approval):
```css
.btn-disabled {
  background: var(--rule);
  color: var(--ink-soft);
  cursor: not-allowed;
  /* Disabled export: show reason as inline helper text, not tooltip */
}
```

Rules:
- No `->` glyph on button labels
- No gradient fills
- No icon-only buttons
- Disabled state reason is inline text, not a hover tooltip (hover does not record on video)

### 6.3 Cards

**There are no cards on the receipt surface.**

The receipt surface uses hairline-delimited sections, not bordered/shadowed card components.

The console uses flat table rows, not cards.

A "card" component (with border + shadow + border-radius) is not in the component library for receipt or console surfaces.

If you find yourself reaching for a card, ask: can a hairline rule and type hierarchy do the same job?

### 6.4 Evidence Blocks (Source Block)

The source block is always fully visible. Never collapsed. Never behind a disclosure.

```
──────────────────────────────────────
  SOURCE   Woreda 9 Capital Budget FY2026
           page 41 · archived 12 Sep 2026
           sha256 3b1f9c···7a2e
──────────────────────────────────────
```

```css
.source-block {
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  padding: var(--space-4) 0;
}

.source-label {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  color: var(--ink-soft);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  width: 72px;
  flex-shrink: 0;
}

.source-value {
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  color: var(--ink);
  line-height: var(--leading-loose);
}

.source-hash {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  color: var(--ink-soft);
  user-select: all;          /* selectable for copy */
}
```

**When no source document exists:**

```
┌────────────────────────────────────────────────┐
│  NO SOURCE DOCUMENT                            │
└────────────────────────────────────────────────┘
```

```css
.no-source-banner {
  background: var(--state-none);
  color: var(--paper);
  font-family: var(--font-sans);
  font-size: var(--text-sm);
  font-weight: 600;
  letter-spacing: 0.06em;
  padding: var(--space-3) var(--space-4);
  width: 100%;
  /* This is the only all-caps string used as content */
}
```

### 6.5 Receipts

The full receipt layout: narrow column, hairline structure.

```css
.receipt {
  max-width: 480px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-4);
  background: var(--paper);
  font-family: var(--font-sans);
  color: var(--ink);
}

.receipt-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--rule);
}

.receipt-ward {
  font-size: var(--text-base);
  font-weight: 600;
}

.receipt-code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--ink-soft);
}

.receipt-amount {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 500;
  text-align: right;
  color: var(--ink);
}

.receipt-amount-unofficial {
  color: var(--ink-soft);  /* grey when no source document */
}

/* Perforation motif — decorative separator at the fold */
.receipt-perforation {
  border-top: 1px dashed var(--rule);
  margin: var(--space-4) 0;
}
```

### 6.6 Status Badges

Used in console project boards and receipt page state lines.

```html
<span class="status-badge status-open">
  <span class="status-dot" aria-hidden="true"></span>
  <span>Open</span>
</span>
```

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  font-weight: 500;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-open  { color: var(--state-open);  }
.status-open  .status-dot { background: var(--state-open); }

.status-hold  { color: var(--state-hold);  }
.status-hold  .status-dot { background: var(--state-hold); }

.status-break { color: var(--state-break); }
.status-break .status-dot { background: var(--state-break); }

.status-none  { color: var(--state-none);  }
.status-none  .status-dot { background: var(--state-none); }
```

### 6.7 Dense Data Tables (Console)

Console tables are information-dense. No cards, no alternating row fills, no rounded corners.

```css
.console-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
  font-size: var(--text-xs);
  color: var(--ink);
}

.console-table th {
  text-align: left;
  font-weight: 600;
  color: var(--ink-soft);
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--ink);
  white-space: nowrap;
}

.console-table td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--rule);
  vertical-align: middle;
}

.console-table td.mono {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
}

.console-table td.amount {
  font-family: var(--font-mono);
  text-align: right;
}

/* Sortable column header */
.console-table th[aria-sort] {
  cursor: pointer;
}
.console-table th[aria-sort="ascending"]::after  { content: " ↑"; }
.console-table th[aria-sort="descending"]::after { content: " ↓"; }
```

### 6.8 Proof Indicators

The witness counter shows the community check result. It never uses a progress bar or ring.

```html
<!-- Confirmed: n of target -->
<span class="witness-counter" aria-live="polite" aria-label="9 of 10 neighbours checked">
  <span class="witness-n">9</span>
  <span class="witness-sep"> of </span>
  <span class="witness-target">10</span>
</span>
```

```css
.witness-counter {
  font-family: var(--font-mono);
  font-size: var(--text-lg);
  font-weight: 500;
  color: var(--ink);
  /* aria-live="polite" is required — screen readers announce changes */
}

.witness-sep {
  color: var(--ink-soft);
  font-size: var(--text-sm);
}
```

**Suppressed duplicate pulse:**
When a duplicate observation is received and suppressed, the counter pulses once (scale 1.0 -> 1.05 -> 1.0 over 200ms) and does not increment. This is the only animation on the receipt/console surfaces, and it is system-triggered (not user-triggered), because it is critical demo feedback.

```css
@keyframes witness-pulse {
  0%   { transform: scale(1); }
  50%  { transform: scale(1.05); }
  100% { transform: scale(1); }
}

.witness-counter.pulse {
  animation: witness-pulse 200ms ease-in-out;
}

@media (prefers-reduced-motion: reduce) {
  .witness-counter.pulse {
    animation: none;
    /* Optionally flash color instead for reduced-motion users */
  }
}
```

---

## 7. Motion Policy

| Motion | Allowed | Trigger |
|---|---|---|
| Keypad key depress (40ms, scale down) | Yes | User keypress |
| Witness counter pulse (200ms, scale 1.05) | Yes | System — suppressed duplicate |
| Page transitions | No | — |
| Loading skeletons | No | — |
| Auto-advance animations | No | — |
| Scroll-triggered animations | No | — |
| Hover animations (other than cursor change) | No | — |

All motion must respect `prefers-reduced-motion: reduce` — either disable or substitute a non-motion alternative (e.g., color flash instead of scale).

---

## 8. Layout Grid

### Receipt Page

- Single-column, centered
- `max-width: 480px`
- Horizontal padding: `--space-4` (16px) mobile, `--space-6` (24px) desktop
- No sidebar, no multi-column layout

### Console

- Full-width with a fixed left navigation column (200px)
- Main content area: `padding: var(--space-6)`
- Tables fill the available content area
- No masonry, no grid, no flex-wrap layouts

### Simulator

- Two-pane horizontal split: phone (left ~55%), transcript (right ~45%)
- Phone pane: vertically centered
- Transcript pane: monospaced, scrollable
- No responsive collapse — simulator is demo-only, desktop viewport assumed

---

## 9. Component Inventory

| Component | Surface | Key constraint |
|---|---|---|
| `FeaturePhone` | Simulator | Shell + LCD + keypad + transcript — all four required |
| `LcdScreen` | Simulator | Exactly 4×20 chars; truncates on overflow |
| `SessionTranscript` | Simulator | Shows literal HTTP payload |
| `ReceiptCard` | Public | Narrow column, hairline structure |
| `SourceBlock` | Public | Never collapsed; always fully visible |
| `UnofficialBanner` | Public | Full-width `NO SOURCE DOCUMENT` in `--state-none` |
| `NarrativeState` | Public, Console | Renders state + text; never computes state values |
| `WitnessCounter` | Public, Simulator | `n of target` in mono; `aria-live="polite"` |
| `ProvenanceSentence` | Public | Composed sentence + audio play control |
| `ProbationCountdown` | Public, Console | Days remaining; switches to `--state-break` on failure |
| `DivergenceCard` | Public | Statutory vs observed comparison |
| `RefusalScript` | Public, Simulator | Exact refusal sentence + copy + audio |
| `IngestReviewRow` | Console | Field + confidence + confirm checkbox |
| `ModerationItem` | Console | Approve/reject with mandatory reason input |
| `BulletinFrame` | Console | Fixed sentence frames with editable slots only |
| `AuditChainViewer` | Public | Event list + verifier status |
| `SyncBadge` | PWA | Queued / syncing / synced count |

---

*Last updated: 2026-09-17*
*Owned by: Design / Engineering — Ward Proof-Line*
