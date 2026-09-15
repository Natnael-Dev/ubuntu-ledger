# 01 — Product Requirements

## 1. The problem, stated precisely

Public money at the ward / kebele / LGA tier is allocated in documents that are structurally unreadable by the people the money is for: 80-page fiscal gazettes, line items written in procurement jargon, contract codes with no physical referent. The failure is not secrecy — many of these documents are technically public. The failure is that **the document is not checkable by a body**.

This produces four distinct, separately-solvable frictions:

**F1 — The budget line has no physical referent.**
"Kebele 04 Water Distribution Point Rehabilitation — Contract #8841 — 480,000 ETB" tells a resident nothing they can act on. They cannot tell which pump, whether it exists, or what "rehabilitation" was supposed to produce.

**F2 — The citizen arrives at the counter without leverage.**
The circular says the service costs 50 ETB and takes one visit. The counter asks for 300 ETB, invents a document requirement, and sends them back three times. The citizen pays because they do not know what the law says and have no socially acceptable way to refuse.

**F3 — Non-readers are excluded from every existing remedy.**
Every civic-tech remedy above is a text-heavy web form in a national language. The people most affected — older rural residents, women with low formal literacy, minority-language speakers — cannot use any of it. Unstructured voice mailboxes fail the other way: they fill with noise, personal attacks and unverifiable rumour.

**F4 — "Repaired" is a claim, not a fact.**
A borehole is fixed on Monday, photographed on Monday, marked 100% resolved on Monday, and is dry on Wednesday. Every public ticketing system in this space closes on the *contractor's* assertion. There is no durability test anywhere in the loop.

Ward Proof-Line addresses all four as one loop because they are one loop in the real world: the same asset, the same ward, the same people.

## 2. Users

### Primary — the Ward Monitor
A resident aged 20–55 who lives within walking distance of the asset. Feature phone or entry-level Android. May have limited formal literacy. Not an activist; will spend **five minutes**, not an afternoon.
- **Job to be done:** "Tell me one specific thing to check, near me, that takes five minutes, and show me it mattered."
- **Failure mode we must avoid:** a task that requires travel, judgement, or reading.

### Primary — the Service Seeker
A resident who needs a public service today (ID replacement, clinic intake, land document, water connection). Under time and money pressure. Often accompanied by a family member urging them to just pay.
- **Job to be done:** "Tell me what this should cost and give me words I can say that will not get me thrown out."
- **Failure mode we must avoid:** a confrontational script that escalates their situation.

### Secondary — the Radio Presenter
A community radio host with a weekly ward segment. Needs 60 seconds of copy that is factually defensible and legally safe to read aloud.
- **Job to be done:** "Give me a script I can read on air without being sued or being wrong."

### Secondary — the Moderator
A trusted local reviewer (CSO staffer, ward committee secretary). Clears voice content and approves bulletins.
- **Job to be done:** "Let me approve or reject fast, and never let something reach air without my sign-off."

### Tertiary — the Administrator / Official
Not a user of the PoC. A **respondent**: they get a response window before any divergence is published. Design for their objection, not their login.

## 3. Jobs to be done (canonical list)

| ID | Job | Surfaced by |
|---|---|---|
| J1 | "Show me what my ward was given money for, in words I understand." | Ward Receipt |
| J2 | "Give me one small thing to physically check." | Proof of Task |
| J3 | "Let me answer without reading or writing." | Open Voice / USSD |
| J4 | "Tell me what this service legally costs before I go." | Bribe-Resistant Card |
| J5 | "Give me a sentence to say when I'm asked for more." | Refusal script |
| J6 | "Don't let them close the ticket while the thing is still broken." | Proof-of-Fix probation |
| J7 | "Tell the whole ward what we found, out loud." | Radio Bulletin |
| J8 | "Don't get me in trouble for answering." | Trust & security architecture |

## 4. Success criteria for the PoC

The PoC is successful if a judge, watching for 90 seconds, can see all of:

- **S1** A real-shaped budget document becomes a receipt with a visible source hash and page citation.
- **S2** That receipt becomes a spoken, numbered task on a feature phone in a local language.
- **S3** Three observations arrive from distinct clusters and move the project state — and a fourth from the same cluster does **not** move it further.
- **S4** A contractor's repair claim does **not** turn the project green; it enters probation with a visible countdown.
- **S5** A Day-7 re-check fails and the ticket reopens as `PROBATION_FAILED` without any human override being possible.
- **S6** A radio bulletin script is generated, held at `DRAFT`, approved by a named moderator, and only then marked `APPROVED_FOR_BROADCAST`.
- **S7** A divergence card shows the statutory rule and reported reality side by side, with the aggregate suppressed until k is met.
- **S8** CI is green, including the adversarial suite.

If any of S3, S4, S5 or S6 cannot be demonstrated live, the demo has no differentiator. Those four are the product.

## 5. Explicit non-goals

The PoC will **not**:

- Integrate with any live government system or API.
- Scrape any government website at runtime.
- Perform automatic speech recognition on the critical path. (See `06-voice-and-ussd.md` §7 — this is a deliberate risk decision, not an omission.)
- Provision real telecom short codes or send real SMS at volume.
- Display a map. There is no map anywhere in this product.
- Score, rank or rate any individual person.
- Use the word "corruption" or any synonym in output.
- Support more than one ward, three asset types, two services, or three languages.
- Provide case management, chat, or any free-text channel to the public.
- Use a distributed ledger. A hash chain in Postgres is the tamper-evidence mechanism and is sufficient; say so pre-emptively.

## 6. Hackathon constraints that shape the product

| Constraint | Product consequence |
|---|---|
| ~5 build days, solo | Depth over breadth. One ward, seeded data, simulator-first channels. |
| Demo video ≤250 MB, ≤90–180 s | Every P0 feature must be visible in under 15 seconds of screen time or it is not P0. |
| Public repo + README | Repo legibility is a scored artifact. Commits, tests and the AI build log are deliverables. |
| AI Coding Usage is 25% | The adversarial test suite and the build log are **product requirements**, not chores. |
| Presentation is 25% | Demo assets are scheduled work on Day 5, not leftovers. |
| Judges see ~30 demos | The memorable frame is the state machine **refusing** a contractor's close. Protect it. |

## 7. Product principles

1. **Two ledgers, never one.** Official and observed are separate columns forever.
2. **Absence is a state, not a blank.** No source document → `UNOFFICIAL_ESTIMATE`. Below k → "not enough reports yet." Never an empty cell, never a guess.
3. **Time is a verifier.** Probation is the only mechanism in this product that cannot be argued with.
4. **The last mile is a voice.** If a feature only works on a screen, it is not finished.
5. **Codes, not accusations.** Every sensitive signal is an enumerated code with a neutral label.
6. **Refuse loudly.** When the system will not certify something, it says so on screen in large type. That refusal is the brand.

## 8. Out-of-scope ideas explicitly rejected (record these; judges ask)

| Rejected | Why |
|---|---|
| Contractor credibility *score* | A numeric score is an accusation with a decimal point. We store a neutral `probation_failure_count` and display it only as a factual count. |
| Public map of flagged projects | Geographic display of grievance creates targeting risk and costs two days. |
| Live ASR in Amharic/Afaan Oromo | Accuracy is not dependable enough to sit on a trust product's critical path in five days. |
| Publishing raw citizen voice clips | Voice timbre and background acoustics are identifying. See zero-PII pipeline. |
| Naming counter clerks | Converts an accountability tool into a personal-vendetta tool. |
| Blockchain | The property needed is append-only tamper evidence, which a hash chain provides. |
