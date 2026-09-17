# Ubuntu Ledger — Frontend Forensic Audit

**Audit Date:** 2026-09-17
**Auditor:** Antigravity (forensic pass)
**Project Root:** `C:\Users\HP\dev\Kenya hackaton`
**Status:** Initial audit — pre-iteration baseline

---

## 1. Route-by-Route Analysis

| Route | Purpose | Existing UI | Functional? | Visual Quality | Problems | Action |
|---|---|---|---|---|---|---|
| `/` | Homepage / evaluator entry point | Header + tagline, 5 demo-portal cards, compliance footer | Partial | Coherent ink-on-paper aesthetic; cards are scannable | No product explanation; no Proof-Line definition; no 3-mechanism breakdown; no track alignment statement; no shared nav; IBM Plex not loaded; hardcoded test-count numbers lack framing | **Redesign** — add orientation layer above the portal grid |
| `/simulator` | USSD feature-phone simulator | Delegates to `SimulatorShell` client component | Yes | Appropriate dense terminal feel | None critical | **Retain** |
| `/console` | Municipal operator console | Dense system-feeling interface, self-contained | Yes | High — matches operator mental model | None critical | **Retain** |
| `/receipt/[code]` | Public spending receipt (citizen-facing) | Receipt metaphor, provenance block, audio control, print button | Yes | High — receipt metaphor is distinctive and correct | None critical | **Retain** |
| `/services/[code]` | Statutory divergence card | Delegates to `DivergenceCard` component; real service code `ET-ID-REPLACE` confirmed live | Yes | High — status-signal design is clear | Link label `ET-ID-REPLACE` is opaque to an evaluator who does not know this is intentional | **Retain** — add a tooltip or legend note clarifying it is a real identifier |
| `/pwa` | Offline PWA monitor | Delegates to `MonitorPwaClient` | Yes | Consistent with system | None critical | **Retain** |

---

## 2. Component Inventory

| Component | Size | Role | Quality | Notes |
|---|---|---|---|---|
| `DivergenceCard.tsx` | 11 262 B | Renders statutory service divergence status with state badge | High | Largest component; carries the most domain logic. Keep as-is. |
| `NarrativeState.tsx` | 4 095 B | Displays narrative state copy keyed to service state | Good | Tight coupling to `--state-*` tokens — good separation of color from copy. |
| `ProbationCountdown.tsx` | 4 678 B | Countdown timer for probation period | Good | Stateful; ensure SSR hydration is guarded. |
| `ReceiptPrintButton.tsx` | 422 B | Triggers browser print on receipt page | Good | Appropriately minimal. No issues. |
| `RefusalScript.tsx` | 2 839 B | Renders the citizen refusal script for a service | Good | Copy-critical component — do not alter text without legal review. |
| `SyncBadge.tsx` | 4 479 B | Shows last-sync timestamp and connectivity state | Good | Depends on real-time data; verify offline fallback renders correctly. |
| `WitnessCounter.tsx` | 1 051 B | Displays witness count for a receipt or event | Good | Small; verify it handles 0-witness edge case without breaking layout. |

**Assessment:** Component surface is lean and purposeful. No dead components detected. No component should be removed at this stage.

---

## 3. Design System Assessment

### Tokens (globals.css)

| Token | Value | Usage | Assessment |
|---|---|---|---|
| `--paper` | `#FBFAF7` | Background — warm off-white | Correct. Maintains receipt metaphor without clinical white. |
| `--ink` | `#14150F` | Primary text | Correct. Near-black with warmth; legible at all sizes. |
| `--ink-soft` | `#55564C` | Secondary / metadata text | Correct. Sufficient contrast against `--paper`. |
| `--rule` | `#D9D7CC` | Dividers, borders | Correct. Subtle without disappearing. |
| `--state-open` | `#1F5C3D` | Service is open / compliant | Correct. Green — universally understood as positive. |
| `--state-hold` | `#8A5A00` | Service on hold / warning | Correct. Amber without accessibility clash. |
| `--state-break` | `#8C2F22` | Service in violation / break | Correct. Deep red — high urgency. |
| `--state-none` | `#6B6C61` | No data / unknown state | Correct. Muted — correctly signals absence. |

### Typography

- **IBM Plex Sans / Mono:** Referenced in design intent but **not loaded** via `<link>` or `@import`. The system currently falls back to the OS sans-serif stack. This is the single most impactful visual regression — the ink-on-paper receipt feel depends on IBM Plex Mono for numeric data.
- **No shared font loading strategy exists.** Each page is standalone; a root layout font load is missing.

### Layout

- No shared navigation or header shell across routes.
- Each page is a self-contained island. This is intentional for demo-portal use but creates evaluator disorientation — there is no way to return to `/` from a sub-page without the browser back button.
- No responsive breakpoints have been audited in this pass.

### Verdict

The design system is **genuinely distinctive and correct for the domain.** The ink-on-paper receipt metaphor is not decorative — it encodes the legal and civic provenance metaphor of the product. It should be strengthened, not replaced.

---

## 4. Critical Missing Elements

These are ordered by evaluator impact, not implementation difficulty.

### 4.1 Product Orientation Layer (Homepage — CRITICAL)

An evaluator landing on `/` currently sees a grid of portals with no explanation of what they are entering. The following are entirely absent:

- **What is Ubuntu Ledger?** One-paragraph product statement.
- **What problem does it solve?** The Kenya Track B compliance context is nowhere visible on the page.
- **What is Proof-Line?** The term appears in component logic but is never defined in the UI.
- **How do the 3 proof mechanisms work?** (USSD, receipt, divergence card) — no diagram, no prose, no legend.
- **Track alignment statement.** Judges need to know which hackathon track this addresses before they explore the demo portals.

### 4.2 IBM Plex Font Loading (ALL ROUTES — HIGH)

IBM Plex Sans and IBM Plex Mono must be loaded at the root layout level. Without it, numeric data in receipts and divergence cards renders in a generic proportional font, breaking the ledger/receipt visual contract.

**Recommended fix:** Add to `src/app/layout.tsx`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
```

### 4.3 Shared Navigation / Breadcrumb (ALL ROUTES — MEDIUM)

No route except `/` has a return path. A minimal persistent header with a back-to-home link is sufficient. Full navigation is not needed — a single breadcrumb or wordmark link resolves evaluator disorientation.

### 4.4 Test Count Framing (Homepage — LOW)

The compliance footer shows `574 tests` and `33 E2E` as raw numbers. Without framing ("Test suite as of submission" or similar), these numbers read as placeholder data to a first-time evaluator.

---

## 5. Retain / Redesign / Remove

### Retain (no changes needed)

- `/simulator` — functionally complete, appropriate aesthetic
- `/console` — functionally complete, high information density
- `/receipt/[code]` — strong domain metaphor, full feature set
- `/services/[code]` — clear status signaling
- `/pwa` — complete
- All 7 components — no dead code, no over-engineering
- All `--state-*` tokens — semantically correct
- `--paper` / `--ink` / `--rule` system — correct for domain

### Redesign (targeted changes, not rewrites)

- `/` (Homepage) — add product orientation layer above portal grid; add track alignment statement; add Proof-Line definition; add 3-mechanism summary
- Root layout (`src/app/layout.tsx`) — add IBM Plex font loading
- Any page missing a breadcrumb / back-to-home — add minimal wordmark link in page header

### Remove

- Nothing. No dead routes, no decorative components, no unused tokens were identified.

---

## 6. AI-Slop Findings

> "AI slop" is defined as: generic filler content, fake interactivity, rainbow gradients, blob decorations, marketing superlatives, placeholder text shipped as real content, or patterns that exist because a model generated them rather than because a domain required them.

### Findings

| Finding | Location | Verdict | Rationale |
|---|---|---|---|
| `FRAME A` / `FRAME B` labels | Homepage portal grid | **Acceptable** | These are functional labels for hackathon judges navigating two evaluation frames. They are not decorative jargon. |
| Copy tone | All pages | **Clean** | Copy is concrete, domain-specific, and non-marketing throughout. No superlatives, no generic value propositions. |
| Visual decoration | All pages | **None detected** | No rainbow gradients, no blob SVGs, no glassmorphism, no floating card shadows without semantic purpose. |
| Color system | `globals.css` | **Correct** | Every color token maps to a civic or legal state. No "accent" tokens exist for decoration's sake. |
| Component names | `src/components/` | **Clean** | `RefusalScript`, `WitnessCounter`, `ProbationCountdown` — names encode domain concepts, not generic UI roles. |
| Hardcoded test numbers in footer | Homepage | **Borderline** | Numbers are real (574 unit, 33 E2E) but shipped without context. A label makes them evidence; without one they read as slop. Fix: add `"Test suite — submission build"` caption. |
| Missing product explanation | Homepage | **Gap, not slop** | The absence of orientation copy is a content omission, not AI-generated filler. The fix is addition, not removal. |

### Overall Slop Score

**Low.** The codebase demonstrates genuine domain specificity. The design system is not decorative — it encodes civic and legal semantics through color, typography, and layout. The primary risk is not over-generation but **under-explanation**: the product has strong internal coherence that is invisible to a cold evaluator.

---

## 7. Summary of Recommended Actions

| Priority | Action | Scope | Effort |
|---|---|---|---|
| P0 | Add product orientation + track alignment to homepage | `/` | Medium |
| P0 | Load IBM Plex Sans + Mono at root layout | `layout.tsx` | Low |
| P1 | Add Proof-Line definition to homepage | `/` | Low |
| P1 | Add 3-mechanism summary (USSD / receipt / divergence) | `/` | Medium |
| P1 | Add breadcrumb / back-to-home on all sub-pages | All routes | Low |
| P2 | Add context label to test count in footer | `/` | Trivial |
| P2 | Add tooltip/legend clarifying `ET-ID-REPLACE` is a real service code | `/services/[code]` | Trivial |

---

*Audit produced by Antigravity forensic pass — 2026-09-17. Next pass: post-homepage redesign.*
