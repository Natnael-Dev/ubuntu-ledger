# Open-Source Design References — Ubuntu Ledger / Ward Proof-Line

> This document surveys mature, open-licensed civic design systems and information-dense UI patterns that are relevant to the receipt surface, console table patterns, and evidence presentation philosophy of Ward Proof-Line. For each reference, we document the license, the useful pattern, why it is relevant, and critically — what we must not copy.
>
> The goal is not to inherit these systems but to learn from their hard-won solutions to civic information problems we share.

---

## 1. GOV.UK Design System

**URL:** https://design-system.service.gov.uk/  
**Component library:** https://github.com/alphagov/govuk-frontend  
**License:** MIT (code) + Open Government Licence v3.0 (content)  
**OGL text:** https://www.nationalarchives.gov.uk/doc/open-government-licence/

### What it is

The UK Government Digital Service design system, covering typography, components, patterns, and research-backed interaction patterns for public-facing government services. Used across hundreds of UK government services. Battle-tested for low-literacy and low-trust public users.

### Useful patterns to study

| Pattern | What it solves | Where it lives |
|---|---|---|
| **Summary list** | Structured key-value pair display without cards | https://design-system.service.gov.uk/components/summary-list/ |
| **Warning text** | Important information that must not be missed | https://design-system.service.gov.uk/components/warning-text/ |
| **Tag component** | Compact status labels | https://design-system.service.gov.uk/components/tag/ |
| **Notification banner** | Contextual messages on page load | https://design-system.service.gov.uk/components/notification-banner/ |
| **Details (disclosure)** | Progressive disclosure of secondary content | https://design-system.service.gov.uk/components/details/ |
| **Table** | Accessible data tables with sort | https://design-system.service.gov.uk/components/table/ |
| **Error message + error summary** | Inline error display with page-level summary | https://design-system.service.gov.uk/components/error-message/ |
| **Check answers pattern** | Review-before-submit for ingest workflow | https://design-system.service.gov.uk/patterns/check-answers/ |

### Why relevant

- The GOV.UK system was built for citizens who do not self-select into tech products — exactly the Ward Proof-Line public audience
- Summary list pattern solves the same problem as our receipt rows: displaying structured evidence fields clearly without card boxing
- Tag component research informs accessible status badge design
- Check answers pattern maps directly to the Ingest Review console screen (field + confirm checkbox)
- Their color contrast and accessibility standards exceed WCAG AA — aligns with our >= 4.5:1 floor

### What NOT to copy

| Pattern | Why not |
|---|---|
| GDS typeface (GDS Transport) | Proprietary; not licensed for external use. We use IBM Plex Sans. |
| Blue primary brand color (`#1d70b8`) | British government identity. We use `--ink`/`--paper` receipt metaphor. |
| Crown branding and header | UK government identity mark — not appropriate |
| Form-heavy layouts | GOV.UK serves transactional forms; our citizen surface is USSD/IVR, not web forms |
| Footer with navigation links | Ward Proof-Line receipt has no navigation chrome |
| Phase banners ("Beta", "Alpha") | Public-sector UK convention; not meaningful in our context |

### License compliance note

Code (govuk-frontend) is MIT — can be referenced, adapted, or used in commercial/open projects with attribution. Do not copy GDS-owned design assets (crown, transport typeface). OGL content can be adapted with attribution.

---

## 2. USDS Web Design System (USWDS)

**URL:** https://designsystem.digital.gov/  
**GitHub:** https://github.com/uswds/uswds  
**License:** Public domain (CC0 / unlicensed in the USA)  
**License note:** As a US federal government work, it is in the public domain. Outside the US, treat as CC0.

### What it is

The United States Web Design System, built by the US Digital Service and 18F. Covers tokens, components, patterns, and research documentation for US federal public-facing services. Explicitly designed for trust, clarity, and diverse literacy levels.

### Useful patterns to study

| Pattern | What it solves | Where it lives |
|---|---|---|
| **Design tokens** | Systematic color/spacing/type token methodology | https://designsystem.digital.gov/design-tokens/ |
| **Color token semantics** | State-based color usage (not decoration) | https://designsystem.digital.gov/design-tokens/color/state-tokens/ |
| **Data table** | Scrollable, sortable, accessible dense tables | https://designsystem.digital.gov/components/table/ |
| **Alert component** | Four-level semantic alert (info/warning/error/success) | https://designsystem.digital.gov/components/alert/ |
| **Step indicator** | Communicating multi-step progress without a spinner | https://designsystem.digital.gov/components/step-indicator/ |
| **Summary box** | Highlighted summary of key information | https://designsystem.digital.gov/components/summary-box/ |
| **Process list** | Ordered steps / event chains | https://designsystem.digital.gov/components/process-list/ |
| **Identifier** | Attribution / source information block | https://designsystem.digital.gov/components/identifier/ |

### Why relevant

- **Color token semantics:** USWDS documents exactly how to use "state tokens" separately from "theme tokens" — this matches our principle that state colors carry meaning, not aesthetics. Their methodology supports our four-state semantic model.
- **Data table:** USWDS's dense, accessible table implementation is directly applicable to our console Project Board (code, title, amount, audit state, witness count, probation countdown)
- **Process list:** Maps directly to our Audit Chain Viewer — an ordered sequence of verifiable events
- **Identifier component:** Source attribution block pattern aligns closely with our Source Block — government document origin, with structured attribution fields
- **Design token methodology:** Their distinction between "system tokens" (raw values) and "theme tokens" (semantic aliases) is a model for our own `--paper`/`--ink`/`--state-*` system

### What NOT to copy

| Pattern | Why not |
|---|---|
| US government color palette (blue, red, white) | American federal identity; not our context |
| Usa-banner ("An official website of the United States government") | US federal identity |
| Geographic/regional patterns | US-centric address formats, state dropdowns |
| Heavy accordion usage | USWDS uses accordions extensively; our provenance block must never be an accordion |
| Navigation mega-menus | Our surfaces have minimal or no navigation chrome |
| Form validation patterns | Citizen surface is USSD, not web forms |

### License compliance note

Public domain / CC0. No attribution required but recommended. No restriction on use, modification, or commercial use. Safe to adapt code and patterns freely.

---

## 3. OpenStreetMap / Wikimedia Civic Data UI Patterns

**OSM:** https://www.openstreetmap.org/  
**OSM Wiki:** https://wiki.openstreetmap.org/  
**Wikidata:** https://www.wikidata.org/  
**Wikimedia Design System:** https://design.wikimedia.org/style-guide/  
**License:** OSM data: ODbL. OSM software: GPL-2. Wikimedia UI: MIT.

### What it is

OpenStreetMap is the open collaborative mapping project. Wikidata is the structured data companion to Wikipedia. Both systems have developed UX patterns for presenting civic/public data to large, diverse, international audiences — including users who add and verify information contributed by others.

The Wikimedia Design Style Guide (Codex) is the component library underpinning Wikipedia and Wikidata.

### Useful patterns to study

| Pattern | What it solves | Source |
|---|---|---|
| **Dense attribute display** | Showing many key-value pairs (tags) without visual noise | OSM element pages |
| **Edit history / revision diff** | Communicating change over time with attribution | OSM changeset pages |
| **Structured data statements** | Claim + source + qualifier triple pattern | Wikidata item pages |
| **No-chrome information display** | Data is the UI; no decorative chrome | OSM's core philosophy |
| **Contributor attribution** | Who recorded this, when, from what source | OSM changeset metadata |
| **Data quality indicators** | Freshness, completeness, verification status without progress rings | OSM map rendering conventions |

### Why relevant

**Wikidata's claim-source-qualifier model** is structurally analogous to our evidence provenance model:
- Wikidata: *Statement* (the claim) + *Reference* (source document) + *Qualifier* (conditions)
- Ward Proof-Line: *Contract amount* (the claim) + *Source block* (budget doc + hash) + *Witness observations* (qualifiers)

**OSM's no-chrome philosophy** directly aligns with our console design principle: the tool must not look like a product. OSM's data display pages are dense, undecorated, and information-first — exactly the register we want for the console.

**OSM changeset history** is the closest existing public UI to our Audit Chain Viewer. Key shared characteristics: timestamp, contributor identity, action type, diff between states, machine-readable identifiers alongside human-readable labels.

**Wikimedia Codex** (https://doc.wikimedia.org/codex/) provides accessible, internationalized components tested across 300+ language Wikipedias — directly relevant for our Latin + Ethiopic rendering challenge.

### What NOT to copy

| Pattern | Why not |
|---|---|
| Map tile rendering | Not relevant; we have no map surface |
| OSM's visual density on primary UI | Too dense for low-literacy citizens; appropriate for console, not receipt |
| Wikipedia's infobox card pattern | Card-based; incompatible with our receipt metaphor |
| Talk page / edit conflict UI | Collaboration-mode patterns; our system is append-only |
| Wikidata's SPARQL query interface | Advanced technical user tool; not applicable |

### License compliance note

OSM software (iD editor, etc.): GPL-2. Wikimedia Codex: MIT. Patterns can be studied and adapted. Do not incorporate GPL code without understanding obligations. Wikimedia MIT code is freely adaptable.

---

## 4. Other Relevant References

### 4.1 UK Electoral Commission — Transparency Register

**URL:** https://www.electoralcommission.org.uk/who-we-are-and-what-we-do/financial-reporting  

A real-world example of public financial data presented as evidence rather than a dashboard. Notice the dense tabular presentation, source document links alongside each row, and complete absence of data visualization. Study this for the console Project Board.

### 4.2 Companies House UK — Filing History

**URL:** https://find-and-update.company-information.service.gov.uk/  

Excellent example of a civic audit chain: each filing is timestamped, attributed, has a document type, and links to the original scanned document. Structurally maps to our Audit Chain Viewer.

### 4.3 Kenya National Treasury — Open Budget Portal

**URL:** http://opendata.treasury.go.ke/  

Contextually relevant; documents how Kenyan government budget data is currently structured and labeled. Useful for ensuring terminology alignment with the actual budget documents our system will ingest.

### 4.4 Tanzania's TEHAMA / LGRCIS

Portal systems for local government revenue and infrastructure. Study for understanding the administrative context our console operators already work within — understanding existing tools prevents "alien" UX that operators reject.

### 4.5 Transparency International — Corruption Risk Indicators

**URL:** https://www.transparency.org/  

Evidence presentation conventions for accountability reporting to a non-specialist audience. Useful for copy patterns on the receipt page — particularly how to state a discrepancy without appearing to make a legal accusation.

---

## 5. Synthesis — What Ubuntu Ledger Should Adopt vs Reject

### Adopt

| Pattern | Source | How to apply |
|---|---|---|
| **State token semantic separation** | USWDS | Maintain strict separation between `--paper`/`--ink` (foundation) and `--state-*` (semantic) — never intermix |
| **Summary list structure** | GOV.UK | Apply to receipt section rows: label (left, fixed width) + value (right, expands). No boxing. |
| **Check answers / review-before-confirm** | GOV.UK | Apply to Ingest Review console: show extracted fields, let reviewer confirm each, require initials |
| **Process list for event chains** | USWDS | Apply to Audit Chain Viewer: ordered, attributed, timestamped events |
| **Claim + source + qualifier triple** | Wikidata | Apply as mental model for all receipt data: what (amount), from where (source block), verified how (witness block) |
| **No-chrome dense table** | OSM, USWDS | Apply to console Project Board: information-dense, no card boxing, no alternating fill |
| **Source attribution block** | GOV.UK (footer), USWDS (identifier), OSM (changeset) | Apply as the Source Block: issuer + page + date + hash, always fully visible |
| **Accessible state badges** | GOV.UK Tags, USWDS Alert | Color + word, always. Tested contrast. Screen-reader label. |
| **Concrete declarative copy** | GOV.UK content guidance | Short sentences, concrete nouns, no jargon. Apply everywhere. |

### Reject

| Pattern | Why reject |
|---|---|
| **Accordion / disclosure for provenance** | Source information is primary content; disclosing it implies it is secondary |
| **Progress rings and chart widgets** | Not in any reference's data-first patterns for civic accountability; implies trending |
| **Card-first layout** | GOV.UK and USWDS both use sparse cards; our receipt is not card-based at all — it is receipt-based |
| **Blue primary color** | Both USWDS and GOV.UK use government-blue; our palette is receipt-ink, deliberately distinct |
| **"Beta" phase banners** | UK-specific convention; creates confusion about production readiness |
| **Hover tooltips for critical information** | USWDS guidance: don't put critical content in hover-only states. Inline helper text instead. |
| **Icon-only navigation** | GOV.UK explicitly uses text labels; OSM avoids icon-only controls in editing UI |
| **Free-text search on citizen surfaces** | GOV.UK patterns include search; Ward Proof-Line citizen surface is lookup-by-code only |
| **Modal dialogs for confirmation** | Neither GOV.UK nor USWDS uses modals for primary confirmation flows; inline confirmation preferred |

---

## 6. Final Design Principles — Synthesized

These principles emerge from the intersection of the Ubuntu Ledger product identity and the hard-won patterns of the open civic design systems above:

1. **Evidence first.** The source document, hash, and provenance are displayed before any derived conclusion. No pattern from any reference system collapses the source.

2. **Structure through typography, not containers.** GOV.UK's summary list and USWDS's data table both demonstrate that structure can emerge from type hierarchy and hairlines. Boxes and cards are not necessary.

3. **State is semantic, not decorative.** USWDS's state token system confirms: state colors communicate meaning. They are never used for emphasis, brand, or aesthetic variety.

4. **Civic language is short, concrete, and non-accusatory.** GOV.UK's content guidelines and Transparency International's framing conventions both support declarative, specific, non-inflammatory language for evidence presentation.

5. **The audit chain is primary content.** OSM changeset history and Companies House filing history both treat the event chain as first-class information — not a footnote. Our Audit Chain Viewer follows this principle.

6. **Dense tables > dashboard charts for operator audiences.** OSM and USWDS data tables serve operators better than visualization widgets. The console Project Board is a sortable dense table.

7. **Accessibility is a civic obligation, not a feature.** GOV.UK and USWDS treat accessibility as a baseline. Our >= 4.5:1 contrast floor, keyboard usability, and `aria-live` requirements are minimum acceptable.

8. **No proprietary design language.** We do not inherit GDS blue, USWDS banner, or Wikimedia blue. We have a distinct identity derived from the receipt metaphor, appropriate to East African civic infrastructure.

---

## 7. License Summary for Quick Reference

| System | License | Can adapt code? | Can adapt patterns? | Attribution required? |
|---|---|---|---|---|
| GOV.UK Design System | MIT (code), OGL v3 (content) | Yes | Yes | Yes (attribution) |
| USWDS | Public domain / CC0 | Yes | Yes | No (recommended) |
| Wikimedia Codex | MIT | Yes | Yes | Yes (attribution) |
| OSM iD editor | ISC / MIT | Yes | Yes | Yes (attribution) |
| OSM data | ODbL | For data use only | Yes | Yes + share-alike |

> For attribution: include a comment in the relevant source file referencing the original system and its license when patterns are directly adapted from a reference system.

---

*Last updated: 2026-09-17*
*Owned by: Design — Ward Proof-Line*
