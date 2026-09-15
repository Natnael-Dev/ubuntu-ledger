# WARD PROOF-LINE — Specification Set

**Project:** Ward Proof-Line
**One line:** A closed-loop, voice-first, offline-capable civic accountability engine that turns dense local-government budgets into physical inspection tasks, anti-extortion shields, and durability-verified repairs — delivered over USSD, SMS, IVR and community radio.

**Context:** Solo developer. Proof of Concept. ~5 working days. Built with an AI coding agent (Antigravity / Cursor / Claude Code) under a spec-driven workflow. Submission target: "Information You Can Trust" (OSF × Andela), judged 25% Uniqueness / 25% Scalability / 25% AI Coding Usage / 25% Presentation.

---

## Read this first: what this project is and is not

Ward Proof-Line is **not** a transparency dashboard. The dashboard is not the product.

The product is a **loop**:

```
Ward Receipt          ingests a public budget line and publishes it as a citizen-readable receipt
      ↓               with a source hash and page citation
Bribe-Resistant Card  arms the citizen with the statutory rule and a refusal script before
      ↓               they reach the counter
Proof of Task         converts the budget line into a 5-minute physical inspection chore
      ↓
Open Voice            collects the answer over a feature phone, in a local language, without text
      ↓
Proof-of-Fix          refuses to close a repair until the asset survives a 7-day probation
      ↓
Radio Bulletin        pushes the finding to a human presenter on community radio — the last mile
                      is a voice, not a screen
```

Three design commitments that are **non-negotiable** and that every file below enforces:

1. **The official record and the community observation are never merged.** They are two columns, two sources, two provenance trails. The system publishes the *divergence*, never a blended "truth."
2. **No individual is ever named or accused.** Aggregation is at office / contract / asset level, behind a k-anonymity gate. Behaviour is recorded as codes, never as allegations.
3. **A contractor cannot close their own ticket.** Time and the community hold the closing key.

---

## Consumption order for the coding agent

Read in this order. Do not skip. Do not start writing code until you have read **09-agent.md** and **17-scope-control.md**.

| Order | File | Purpose | When the agent re-reads it |
|---|---|---|---|
| 1 | `09-agent.md` | Your operating rules. Search-before-implement, 95/5 rule, verification duty, what you may not decide alone. | Before every task |
| 2 | `17-scope-control.md` | P0/P1/P2 priorities, the hard cut line, the Day-3 go/no-go. | Start of every day |
| 3 | `01-PRD.md` | Problem, users, jobs-to-be-done, success criteria, non-goals. | Before any product decision |
| 4 | `02-architecture.md` | Modules, boundaries, technology choices and their justification, offline strategy. | Before creating any new module |
| 5 | `03-data-model.md` | Complete Postgres schema, indexes, constraints, RLS. | Before every migration |
| 6 | `04-state-machine.md` | The three lifecycles, transitions, guards, side-effects. | Before touching any status field |
| 7 | `07-trust-and-security.md` | Triangulation, sybil resistance, k-anonymity, zero-PII audio, hash chain. | Before any aggregation or publication code |
| 8 | `06-voice-and-ussd.md` | USSD session contract, IVR flows, prompt templates, audio manifest. | Before any channel code |
| 9 | `05-api-contracts.md` | Every endpoint, shape, error format, idempotency rule. | Before every route handler |
| 10 | `16-i18n-and-content.md` | Locale model, message templates, audio keys, CI checks. | Before writing any user-facing string |
| 11 | `08-ui-ux-design.md` | Design system, feature-phone simulator, admin console, low-literacy rules. | Before any component |
| 12 | `14-testing-and-edge-cases.md` | Adversarial suite, failure scenarios, coverage duty. | Alongside every feature |
| 13 | `11-tasks.md` | The ordered 5-day task list with acceptance criteria. | Continuously |
| 14 | `10-skills.md` | Named capabilities to acquire or invoke, with search targets. | When blocked |
| 15 | `15-deployment-and-run.md` | Local run, env vars, seeding, simulator. | Day 1 and Day 5 |
| 16 | `13-ai-build-log-template.md` | The log you must fill continuously. | After every task |
| 17 | `12-demo-script.md` | The 90-second recording. | Day 4–5 |
| 18 | `18-submission-deliverables.md` | Repo, README, video, deck, written summary → rubric mapping. | Day 5 |

---

## File map

```
/specs
  00-README.md                  this file
  01-PRD.md                     product requirements
  02-architecture.md            system architecture and technology justification
  03-data-model.md              Postgres schema, indexes, RLS
  04-state-machine.md           three lifecycles, transitions, guards
  05-api-contracts.md           endpoints, shapes, errors, idempotency
  06-voice-and-ussd.md          USSD/SMS/IVR design and prompt templates
  07-trust-and-security.md      trust architecture and threat model
  08-ui-ux-design.md            design system and component inventory
  09-agent.md                   agent operating instructions
  10-skills.md                  discrete capabilities and search targets
  11-tasks.md                   ordered 5-day atomic task list
  12-demo-script.md             90-second demo and recording checklist
  13-ai-build-log-template.md   AI build log template
  14-testing-and-edge-cases.md  adversarial and failure testing
  15-deployment-and-run.md      run, env, seed, simulator
  16-i18n-and-content.md         locale, message and audio content model
  17-scope-control.md           priorities, cut line, go/no-go gates
  18-submission-deliverables.md submission package and rubric mapping
```

---

## Vocabulary (use these exact terms in code, comments, UI and commits)

| Term | Meaning | Never call it |
|---|---|---|
| **Receipt** | The citizen-readable rendering of one public budget line | "dashboard entry" |
| **Proof task** | A ≤5-minute physical inspection chore with 2–3 yes/no questions | "survey", "form" |
| **Observation** | One citizen's answer to a proof task | "report", "vote" |
| **Cluster** | A group of observations that count as one witness (same place / same cohort) | — |
| **Witness count** | Number of distinct clusters, **not** number of observations | "votes" |
| **Divergence** | The measured gap between the statutory rule and reported counter reality | "corruption", "bribery rate" |
| **Outcome code** | A coded post-visit signal (01/02/03…) | "complaint", "allegation" |
| **Probation** | The 7-day window a claimed repair must survive | "warranty" |
| **Bulletin** | The generated radio script | "notification", "post" |
| **Unofficial estimate** | A receipt line with no verifiable source document | "unverified data" |

The system **never** uses the words *corrupt*, *bribe*, *theft*, *stolen*, *fraud* in any user-facing output. See `07-trust-and-security.md` §6.

---

## The one sentence the whole project has to earn

> *A contractor cannot close their own ticket, and a budget line is not a document — it is a question someone in the ward can answer in five minutes.*
