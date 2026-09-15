# 18 — Submission Deliverables

Four required artifacts: public GitHub repo, demo video ≤250 MB, pitch deck PDF ≤100 MB, written summary. Each is scored. Build them on Day 5 as scheduled work, not leftovers.

## 1. Repository

```
README.md                    the judge's entry point — see §2
LICENSE                      MIT
/docs
  ai-build-log.md            the 25% artifact
  specs/                     this spec set, committed
  threat-model.md            from 07 §10
/tests/adversarial/README.md the threat list — one line per attack
.github/workflows/ci.yml     named jobs: typecheck · lint · unit · adversarial · contract · e2e · a11y
```

Repo hygiene that judges actually notice: many small human-worded commits, no secrets, a green CI badge, a `LICENSE`, and a README whose first screen contains a working link and a runnable command.

## 2. README structure

1. **One sentence.** *Ward Proof-Line turns a line in a local government budget into a five-minute physical check a neighbour can answer on a feature phone — and refuses to let a contractor close their own ticket.*
2. **Live demo link** + **90-second video link**, above the fold.
3. **The two frames** — two screenshots: the counter that refuses to move, the close that is refused.
4. **Run it in five minutes** — the three commands from `15 §2`.
5. **Verify it yourself** — the verification block from `14 §6`, verbatim. *(A judge who runs this has scored your AI Coding Usage without you saying a word.)*
6. **Architecture** — the component map from `02 §2`, one paragraph on the pure domain core.
7. **Trust model** — the five-attribute definition of "verified" from `07 §1`, the two-ledger rule, the cluster-weighting rule, the probation lock's three enforcement points.
8. **What I built vs. what the agent built** — short version, linking to the build log.
9. **What this is not** — the honest boundaries. Seeded data, one ward, simulator channel mode, PoC-only refusal-script review status.
10. **Portability** — the "adding a language / adding a country" procedures, and the portability test.

## 3. Pitch deck — 10 slides

| # | Slide | Content | Rubric served |
|---|---|---|---|
| 1 | Title | Name, one-line thesis, tracks (Transparency & Accountability primary / Stability & Social Cohesion secondary), author | — |
| 2 | The friction | The budget line as it actually appears, next to the person it is supposedly for. Name the four frictions from `01 §1`. | Uniqueness |
| 3 | Why the obvious answers fail | Chatbot hallucinates; dashboard excludes non-readers; reporting form has no consequence; ticketing system closes on the contractor's word. Four rows, one line each. | Uniqueness |
| 4 | The loop | The six-stage diagram from `00`. This is the slide that explains the product. | Uniqueness |
| 5 | Two ledgers | Official vs. community, never merged, divergence published as the finding. | Uniqueness, Trust |
| 6 | Trust architecture | Cluster weighting (ten SIMs = one witness), k-anonymity, the probation lock's three enforcement points, the hash chain. Pre-empt blockchain here in one line. | Uniqueness |
| 7 | The channel reality | USSD needs no data; audio for non-readers; radio as the last mile. Screenshot of the phone. State the offline limits honestly. | Scalability |
| 8 | Portability | The config table: ET / KE columns. "A new country changes three config files and zero lines of domain code — and there is a test that asserts it." | Scalability |
| 9 | How it was built | The build log table, the 30-case adversarial suite, the rejected-output column, the commit graph. | AI Coding Usage |
| 10 | What this is not | Seeded data. One ward. Simulator channel mode. Sybil-resistant, not sybil-proof. Needs a legal review and an NGO partner to deploy. **This is the slide judges remember.** | Presentation |

Design: the receipt palette from `08 §2`, IBM Plex, no stock photography, no market-size slide, no team slide.

## 4. Written summary — the four required pillars as literal headings

**Track.** Primary: Transparency & Accountability. Secondary: Stability & Social Cohesion. One paragraph on why the combination is legitimate — an unverified spending rumour is a cohesion problem before it is an accounting problem, and the same receipt object serves both readings.

**Data and information sources.** Three tiers, kept separate by design:
1. *Official* — archived budget documents and statutory circulars, stored with `sha256`, issuer, page and archive date. Seeded for the PoC with realistically-structured fixtures; the ingestion pipeline is real and human-gated.
2. *Community* — coded yes/no observations from proof tasks and coded post-visit outcomes. No free text, anywhere.
3. *Derived* — k-anonymous aggregates and the composed provenance sentence. Nothing here is a new fact; it is arithmetic over the two tiers above.

**Trust and accuracy safeguards.** Answer the question directly, in this order: what "verified" means (five attributes from `07 §1`); the two-ledger rule; cluster-weighted triangulation and its stated limit; k-anonymity at k=5 distinct clusters, enforced at both API and RLS; the probation lock and its three enforcement points; the append-only hash chain with a public verifier; zero-PII pipelines; the response window before publication; the banned-lexicon gate. Then a short paragraph titled **"What we do when we are wrong"** covering the failure table from `07 §11`. Most submissions will not have that paragraph.

**AI coding tool usage.** The build log table with the rejected-output column; the adversarial suite as AI used to attack the developer's own trust model; the accessibility PR; the generated i18n pipeline. Close with the boundary sentence:

> The concept, the trust model and every state machine transition are mine. The agent generated implementation, tests and attack scenarios against my specification. The log records what I accepted, what I rewrote, and twelve cases where I rejected generated code because it would have silently weakened the verification model.

## 5. Rubric → artifact map (every line must have an artifact that exists)

| Rubric | Claim | Artifact |
|---|---|---|
| Uniqueness | Verification by structural refusal, not accumulation | Frame A and Frame B in the video; `04 §3`; deck 5–6 |
| Uniqueness | Time as a verifier | `sustained_requires_probation_end` constraint; ADV-08, ADV-09 |
| Uniqueness | Last mile is a human voice on radio | Bulletin approval gate in the video; `12` 1:16–1:26 |
| Uniqueness | Two ledgers never merged | Divergence card; the two-container test |
| Scalability | Config, not code | `/config/*`; `tests/unit/portability.test.ts`; deck 8 |
| Scalability | Adding a language is a documented procedure | `16 §8`; CH-01…CH-09 |
| Scalability | Works without mobile data | `/api/ussd` gateway contract; simulator transcript panel |
| AI Coding Usage | AI used adversarially, not decoratively | `tests/adversarial/` + its threat-list README + named CI job |
| AI Coding Usage | Documented human/agent boundary | `/docs/ai-build-log.md` with rejections |
| AI Coding Usage | Disciplined engineering | Architecture boundary test; 100% domain branch coverage; commit graph |
| Presentation | Memorable frames | The two frames, held in silence |
| Presentation | Honest limits | Deck slide 10; README §9 |
| Presentation | Judge can verify unaided | README §5 verification block |

## 6. Final submission checklist

- [ ] Repo public; CI green; all jobs named and visible
- [ ] `LICENSE` present
- [ ] No secrets committed; `.env.example` complete with empty values
- [ ] README first screen: one sentence, live link, video link, three commands
- [ ] Video ≤250 MB, ≤90 s, subtitled, both frames legible at 1080p
- [ ] Deck PDF ≤100 MB, 10 slides, slide 10 states the limits
- [ ] Written summary with the four pillars as literal headings
- [ ] Build log has an entry per task, with a non-empty rejections column
- [ ] Adversarial README reads as a threat list
- [ ] Hosted deploy reachable and seeded
- [ ] Verification block from `14 §6` runs clean on a fresh clone — **test this on a clean machine or a fresh container, not your dev box**
- [ ] Audit verifier returns `ok: true` on the deployed instance

## 7. The last thing to check

Read the written summary aloud and ask: *does every trust claim in it have a test or a constraint behind it in the repo?*

If any claim does not, delete the claim. In a competition called Information You Can Trust, an unbacked claim in your own submission is the only unrecoverable mistake.
