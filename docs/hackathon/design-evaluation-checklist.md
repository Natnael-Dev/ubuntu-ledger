# Ubuntu Ledger — Frontend Design Evaluation Checklist

> **Hackathon:** OSF × Andela — *Information you can trust*
> **Deadline:** 21 September 2026, 23:59 UTC
> **Track:** Transparency & Accountability
> **Judging criteria (equal weight):** Uniqueness · Scalability · AI Coding Usage · Presentation

Use this checklist as a final gate before submission. Every item must be checked **green** or documented with a conscious trade-off decision.

---

## 1. First Impression (10-Second Test)

> A judge who lands cold should immediately understand *what* Ubuntu Ledger is and *why it matters*.

- [ ] **Hero headline is visible above the fold** — no scrolling required to read the core value proposition.
  - *Expected evidence:* Screenshot of `/` at 1440 × 900 showing headline, sub-headline, and primary CTA within the viewport.
- [ ] **Headline names the problem explicitly** — e.g., "Track where public money actually went" or equivalent.
  - *Expected evidence:* Exact headline text recorded here for review: `_______________`.
- [ ] **USSD demo entry point is the hero CTA** — the `*890#` simulator is promoted as the lead demo, not buried.
  - *Expected evidence:* CTA button/link to `/simulator` is the largest or most visually prominent action on the landing page.
- [ ] **Brand name "Ubuntu Ledger" is legible** in ≤ 2 seconds — correct typeface, sufficient contrast (WCAG AA minimum).
  - *Expected evidence:* Colour contrast ratio ≥ 4.5:1 verified by browser DevTools or Lighthouse.
- [ ] **No jargon wall** — no undefined acronyms (USSD, PWA, k-anonymity) visible in the hero section.
  - *Expected evidence:* Peer review by a non-technical team member — they can explain the page in one sentence.

---

## 2. Problem Communication

> The judge must feel the pain before they see the solution.

- [ ] **Problem statement page or section exists** — describes the accountability gap in public spending (East Africa context).
  - *Expected evidence:* Dedicated `/about` page or prominent landing-page section with ≥ 2 concrete impact statistics.
- [ ] **Affected user personas are named** — at minimum: citizen, municipal operator, auditor / journalist.
  - *Expected evidence:* Persona cards or named user stories visible somewhere in the UI or in accompanying docs.
- [ ] **Low-trust environment is communicated** — the copy explains *why* a dual-ledger approach is necessary (existing systems can be falsified).
  - *Expected evidence:* At least one sentence on the site that references the trust gap, not just the solution.
- [ ] **Geographic/language context is established** — references to Amharic, Swahili, or specific regions signal the real-world scope.
  - *Expected evidence:* Language switcher visible or locale names mentioned in body copy.
- [ ] **Bandwidth constraint acknowledged** — the UI explains that USSD was chosen deliberately for feature-phone users without data plans.
  - *Expected evidence:* Tooltip, caption, or copy near the simulator explaining the ≤ 10 kbps rationale.

---

## 3. Solution Visibility

> Each core feature must be reachable within two clicks from the landing page.

- [ ] **Navigation exposes all four demo routes** — `/simulator`, `/receipt/4412`, `/console`, `/pwa` are linked or discoverable.
  - *Expected evidence:* Nav audit — list every route accessible from the top-level nav and confirm all four are present.
- [ ] **`/simulator` route loads and renders the USSD interface** — `*890#` prompt is visible, interactive, and clearly labelled as a live demo.
  - *Expected evidence:* Screen recording of a full USSD session from `*890#` to a spending receipt.
- [ ] **`/receipt/4412` renders a legible public spending receipt** — amount, contractor, status, and citizen verification count are visible.
  - *Expected evidence:* Screenshot of the receipt at mobile (375 px) and desktop (1280 px).
- [ ] **`/console` renders the municipal operator view** — at minimum: pending tickets list, close-ticket action, and probation-countdown indicator.
  - *Expected evidence:* Screenshot or recording showing the contractor-cannot-close-own-ticket flow (Proof B).
- [ ] **`/pwa` demonstrates offline capability** — service worker active, IndexedDB outbox visible, sync indicator present.
  - *Expected evidence:* Chrome DevTools Application panel screenshot showing SW registered + IndexedDB store with queued entries.
- [ ] **`/services/ET-ID-REPLACE` renders the two-ledger divergence card** — both ledgers side-by-side or stacked, divergence highlighted.
  - *Expected evidence:* Screenshot with the divergence delta value clearly labelled (Proof C visual).

---

## 4. Proof Mechanism Communication (A, B, C)

> Each proof must be self-evident to a first-time visitor — no README required.

### Proof A — Geographic Cluster Deduplication (Sybil Resistance)

- [ ] **Visual cluster map or diagram is rendered** showing how witnesses in the same geographic cluster are grouped.
  - *Expected evidence:* Map component or cluster diagram on the relevant route (receipt or simulator result screen).
- [ ] **"Same cluster = same witness" rule is stated in plain language** — tooltip, label, or inline explanation visible without external docs.
  - *Expected evidence:* Screenshot of the tooltip/explanation copy: `"_______________"`.
- [ ] **Duplicate-detection outcome is shown** — e.g., a counter "3 independent witnesses confirmed · 1 duplicate excluded".
  - *Expected evidence:* The witness count component shows both admitted and excluded counts.

### Proof B — Mandatory 7-Day Citizen Probation

- [ ] **Probation countdown timer is visible on the operator console** (`/console`) for any open ticket.
  - *Expected evidence:* Screenshot of a ticket card showing days-remaining indicator.
- [ ] **"Contractor cannot close own ticket" is stated or enforced visibly** — e.g., close button disabled with explanatory tooltip.
  - *Expected evidence:* Recording or screenshot of the disabled action with tooltip text visible.
- [ ] **Citizen confirmation step is shown** — the flow where a citizen must confirm before closure is reachable in the demo.
  - *Expected evidence:* Screen recording of the citizen-confirm step in the USSD simulator or console.

### Proof C — Two-Ledger Separation

- [ ] **Both ledgers are labelled distinctly** — "Official Statutory Record" vs "Citizen Observation Ledger" (or equivalent) in the divergence card UI.
  - *Expected evidence:* Screenshot with both labels visible simultaneously at `/services/ET-ID-REPLACE`.
- [ ] **"Never merged" policy is communicated** — copy or UI affordance makes clear that the two data sets are never combined into a single truth.
  - *Expected evidence:* Inline note or badge reading "Independent — never merged" or equivalent.
- [ ] **Divergence metric is visible** — a delta, discrepancy flag, or comparison score is rendered when the ledgers disagree.
  - *Expected evidence:* Screenshot of the divergence card with a non-zero delta value for demo purposes.

---

## 5. Trust / Evidence Model

> Judges from the Transparency & Accountability track will specifically probe whether the trust model is comprehensible.

- [ ] **Privacy constraint (k-anonymity, k ≥ 5) is disclosed somewhere in the UI** — not just in docs.
  - *Expected evidence:* "Reports are only published when 5 or more independent citizens confirm" (or equivalent) visible at the receipt or submission point.
- [ ] **Data provenance is labelled** — each data field on the receipt indicates whether it came from the official ledger or citizen reports.
  - *Expected evidence:* Source badge or icon on every major field in `/receipt/4412`.
- [ ] **No single point of trust** — the UI communicates that neither the government record alone nor citizen reports alone are sufficient.
  - *Expected evidence:* Copy or diagram explaining the dual-source verification model.
- [ ] **Audit trail is hinted** — timestamps, block hashes, or immutable record IDs are visible on the receipt.
  - *Expected evidence:* At least one immutable identifier (hash / record ID) visible on the receipt page.
- [ ] **Witness anonymity is respected** — no PII of reporting citizens is shown; only anonymised cluster counts.
  - *Expected evidence:* Receipt page review — no names, phone numbers, or GPS coordinates of individual witnesses visible.

---

## 6. Demonstration Paths

> Define the three judge journeys and verify each one is completable end-to-end.

### Journey 1 — Citizen Path (feature phone)
- [ ] Start at `/simulator` → dial `*890#` → navigate to a spending receipt → see witness count and divergence.
  - *Expected evidence:* Screen recording ≤ 90 seconds completing this journey without external assistance.

### Journey 2 — Auditor / Journalist Path (desktop)
- [ ] Start at `/` → navigate to `/receipt/4412` → review two-ledger divergence → reach `/services/ET-ID-REPLACE`.
  - *Expected evidence:* Screen recording ≤ 60 seconds completing this journey.

### Journey 3 — Municipal Operator Path (console)
- [ ] Start at `/console` → find an open ticket → observe probation countdown → attempt to close own ticket (blocked) → see citizen-confirm requirement.
  - *Expected evidence:* Screen recording ≤ 90 seconds completing this journey.

- [ ] **All three journeys are listed in the project README or demo guide** so judges can self-navigate.
  - *Expected evidence:* `README.md` or `docs/DEMO.md` contains the three journey descriptions with direct URLs.

---

## 7. Hackathon Track Alignment

> OSF × Andela: *Information you can trust* — Transparency & Accountability track.

- [ ] **Track name is stated on the submission landing page or README**.
  - *Expected evidence:* "Track: Transparency & Accountability" visible in the UI or project description.
- [ ] **"Information you can trust" theme is directly addressed in copy** — not paraphrased away.
  - *Expected evidence:* The phrase or a clear derivation appears in the hero, about section, or README.
- [ ] **All four judging criteria have at least one UI touchpoint** — Uniqueness (dual-ledger), Scalability (USSD/offline), AI Usage (disclosed), Presentation (polished UI).
  - *Expected evidence:* Map each criterion to a specific route or UI element — fill table below:

| Criterion | Route / Component | Visual Evidence File |
|---|---|---|
| Uniqueness | | |
| Scalability | | |
| AI Coding Usage | | |
| Presentation | | |

---

## 8. Uniqueness Evidence

> Judges ask: "Has this been done before, and if not, why not?"

- [ ] **Dual-ledger architecture is explained as novel** — copy articulates why merging official + citizen data would break trust.
  - *Expected evidence:* About or explainer section with ≥ 1 paragraph on the architectural decision.
- [ ] **USSD-first design is positioned as intentional** — not a fallback, but the primary interface for the target demographic.
  - *Expected evidence:* Simulator route has a label or callout: "Designed for 300M+ feature-phone users across sub-Saharan Africa" (or equivalent stat).
- [ ] **Geographic cluster deduplication (Proof A) is presented as a novel Sybil-resistance mechanism**.
  - *Expected evidence:* At least one diagram or labelled visual of the cluster model that doesn't exist in any cited prior art.
- [ ] **Combination of proofs A + B + C is framed as a system** — not three separate features.
  - *Expected evidence:* A "How it works" or "Trust Model" page/section that shows all three proofs as an integrated framework.

---

## 9. Scalability Communication

> Judges ask: "Can this reach millions of users?"

- [ ] **USSD channel is described as inherently scalable** — works on any GSM network, no smartphone required, no data cost.
  - *Expected evidence:* Callout or stat near the simulator: e.g., "Works on any phone · No internet · No app download".
- [ ] **PWA offline-first model is framed as addressing rural/low-connectivity users**.
  - *Expected evidence:* `/pwa` route has copy explaining the IndexedDB outbox sync-when-connected model.
- [ ] **k-anonymity privacy model is described as scalable by design** — grows stronger (not weaker) with more reports.
  - *Expected evidence:* Copy or diagram showing that k>=5 threshold becomes easier to meet as adoption grows.
- [ ] **Multi-language support (Amharic, Swahili) is demonstrated** — at least one UI string rendered in a non-Latin script.
  - *Expected evidence:* Screenshot of a UI element in Amharic or Swahili script.
- [ ] **Architecture diagram (if present) shows horizontal scalability** — stateless API, edge caching, or regional federation.
  - *Expected evidence:* Architecture diagram file path: `_______________`.

---

## 10. AI Usage Disclosure

> OSF × Andela explicitly scores "AI Coding Usage" — make it visible and honest.

- [ ] **AI tools used are listed** — minimum: tool name, version/model, purpose.
  - *Expected evidence:* `docs/hackathon/ai-usage.md` or equivalent section in README with tool inventory.
- [ ] **AI-generated code percentage is estimated** — even a rough breakdown (e.g., "~60% of frontend components scaffolded by AI") satisfies judges.
  - *Expected evidence:* Statement in AI usage doc: "Approximately X% of source lines were AI-assisted."
- [ ] **Human review / modification is documented** — show that AI output was validated, not blindly accepted.
  - *Expected evidence:* At least one example of a prompt + AI output + human correction documented.
- [ ] **AI was used for non-trivial work** — not just code formatting or comment generation.
  - *Expected evidence:* Examples include: component architecture, algorithm design, accessibility audit, test generation.
- [ ] **AI disclosure is findable within 2 clicks from the project root** — judges should not have to dig.
  - *Expected evidence:* Link to AI usage doc in `README.md`.

---

## 11. Presentation Quality

> "Presentation" is a judging criterion — treat it as engineering, not aesthetics.

- [ ] **Colour palette is consistent across all routes** — no per-route style drift.
  - *Expected evidence:* Design token file (`tailwind.config.js`, `_variables.scss`, etc.) defines all used colours.
- [ ] **Typography hierarchy is clear** — H1 > H2 > body > caption at every breakpoint.
  - *Expected evidence:* Lighthouse accessibility score >= 85 on the three primary routes.
- [ ] **Interactive elements have visible hover and focus states** — no invisible keyboard focus.
  - *Expected evidence:* Tab through `/simulator` and screenshot each focused element.
- [ ] **Loading states exist** for all async operations — no blank screens during data fetch.
  - *Expected evidence:* Recording of page load showing skeleton or spinner before data appears.
- [ ] **Empty states are designed** — what does `/console` look like with zero tickets? It should not be a blank page.
  - *Expected evidence:* Screenshot or description of the empty-state component.
- [ ] **Error states are designed** — USSD network failure, offline PWA, receipt not found.
  - *Expected evidence:* Screenshot of at least one error state UI.
- [ ] **Demo data is realistic** — amounts in KES/ETB, place names in Kenya/Ethiopia, contractor names plausible.
  - *Expected evidence:* Review of seed data file — no "foo", "test123", or placeholder strings in demo content.
- [ ] **Video/GIF demo is prepared** — 3 minutes max covering all three judge journeys.
  - *Expected evidence:* Demo file path: `_______________`. Duration: `___` minutes.

---

## 12. Accessibility

> Accessibility overlaps with scalability for low-literacy and assistive-technology users.

- [ ] **Lighthouse Accessibility score >= 85** on `/`, `/simulator`, and `/receipt/4412`.
  - *Expected evidence:* Three Lighthouse report screenshots with scores visible.
- [ ] **All images have descriptive `alt` text** — not empty or generic.
  - *Expected evidence:* `axe` DevTools run with zero "image-alt" violations.
- [ ] **Colour contrast >= 4.5:1 for all body text** — verified by automated tool.
  - *Expected evidence:* Contrast audit output showing no failures.
- [ ] **USSD simulator is keyboard-navigable** — all digit inputs and menu selections work without a mouse.
  - *Expected evidence:* Recording of a full USSD session using keyboard only.
- [ ] **Language attribute set** on `<html>` — `lang="en"` default, `lang="am"` for Amharic views, `lang="sw"` for Swahili.
  - *Expected evidence:* DevTools Elements panel screenshot showing `lang` attribute.
- [ ] **Semantic HTML used throughout** — headings, buttons, lists, and forms use correct elements (not all `<div>`).
  - *Expected evidence:* Accessibility tree in DevTools shows meaningful roles for all interactive elements.

---

## 13. Responsive Design

> The primary user is on a feature phone or low-end Android — mobile is not a secondary concern.

- [ ] **All routes render correctly at 320 px width** — the minimum for older smartphones.
  - *Expected evidence:* Screenshots of all four demo routes at 320 x 568 px.
- [ ] **All routes render correctly at 375 px width** — iPhone SE / common low-end Android.
  - *Expected evidence:* Screenshots of all four demo routes at 375 x 667 px.
- [ ] **Tablet layout (768 px) is at minimum not broken** — content may reflow but must not overflow or overlap.
  - *Expected evidence:* Screenshots of all four demo routes at 768 x 1024 px.
- [ ] **Desktop layout (1280 px+) is polished** — this is the primary judge viewing environment.
  - *Expected evidence:* Screenshots of all four demo routes at 1280 x 800 px.
- [ ] **No horizontal scroll at any breakpoint** (except intentional carousels).
  - *Expected evidence:* DevTools responsive mode sweep from 320 px to 1440 px with no overflow detected.
- [ ] **Touch targets >= 44 x 44 px** on mobile — all buttons and links meet minimum tap size.
  - *Expected evidence:* `axe` or Lighthouse mobile audit with zero touch-target violations.

---

## 14. Submission Completeness

> Final gate — nothing missing from the OSF x Andela submission portal.

- [ ] **`README.md` at project root** — contains: project name, track, problem, solution, demo URL, local setup instructions, team.
  - *Expected evidence:* `README.md` reviewed against this list — all sections present.
- [ ] **Live demo URL is deployed and accessible** — judges must not need to run `npm install` locally.
  - *Expected evidence:* Deployed URL tested in an incognito window with no auth required.
- [ ] **All four demo routes return HTTP 200** — no broken deployments.
  - *Expected evidence:* `curl -I <url>/simulator`, `/receipt/4412`, `/console`, `/pwa` — all 200.
- [ ] **`docs/hackathon/ai-usage.md` exists and is linked** from README.
  - *Expected evidence:* File present at path, link in README verified.
- [ ] **`docs/hackathon/design-evaluation-checklist.md` (this file) is complete** — all items checked.
  - *Expected evidence:* This file with zero unchecked `[ ]` items.
- [ ] **Team member names and roles are documented** — at minimum in README or submission form.
  - *Expected evidence:* Team section in README lists each member with their contribution.
- [ ] **License file exists** — `LICENSE` or `LICENSE.md` at project root.
  - *Expected evidence:* `ls LICENSE*` returns a file.
- [ ] **No secrets committed** — no API keys, tokens, or credentials in the repository.
  - *Expected evidence:* `git log --all --oneline | head -20` reviewed; `grep -r "API_KEY\|SECRET\|TOKEN" .env*` returns clean.
- [ ] **Submission form completed** — all required portal fields filled before 21 September 2026, 23:59 UTC.
  - *Expected evidence:* Submission confirmation email / timestamp screenshot saved to `docs/hackathon/submission-confirmation.png`.

---

## Checklist Summary

| Section | Total Items | Checked | Status |
|---|---|---|---|
| 1. First Impression | 5 | 0 | Red |
| 2. Problem Communication | 5 | 0 | Red |
| 3. Solution Visibility | 6 | 0 | Red |
| 4. Proof Mechanisms (A+B+C) | 9 | 0 | Red |
| 5. Trust / Evidence Model | 5 | 0 | Red |
| 6. Demonstration Paths | 4 | 0 | Red |
| 7. Track Alignment | 3 | 0 | Red |
| 8. Uniqueness Evidence | 4 | 0 | Red |
| 9. Scalability Communication | 5 | 0 | Red |
| 10. AI Usage Disclosure | 5 | 0 | Red |
| 11. Presentation Quality | 8 | 0 | Red |
| 12. Accessibility | 6 | 0 | Red |
| 13. Responsive Design | 6 | 0 | Red |
| 14. Submission Completeness | 9 | 0 | Red |
| **TOTAL** | **80** | **0** | **Red** |

> Update the "Checked" column and flip Red to Yellow (>=50%) to Green (100%) as you complete items.

---

*Last updated: 2026-09-17 · Deadline: 2026-09-21 23:59 UTC · **4 days remaining.***
