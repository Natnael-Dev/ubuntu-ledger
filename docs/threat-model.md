# Threat Model: Ward Proof-Line / Ubuntu Ledger

Authoritative Source: `docs/specs/07-trust-and-security.md` §10.

---

## 1. Adversarial Threat Matrix

| # | Threat | Threat Actor | Mitigation Strategy | Residual Risk & Stated Bounds |
|---|---|---|---|---|
| **T1** | Fabricated threshold via multiple SIM cards (Sybil Attack) | Contractor, local political broker | Spatial/telecom cluster weighting (`deriveClusterKey`). Subsequent calls from identical cell and prefix bucket receive `weight = 0`. | Distributed, patient adversary across disparate cells is mitigated by requiring multiple independent spatial cells. |
| **T2** | Contractor closes own ticket early | Contractor, captured municipal admin | Triple-enforced probation lock: domain reducer, service guard, and state machine invariant. Early closure returns HTTP 409 `E_PROBATION_LOCKED` and is logged in the cryptographic audit chain. | None at data layer. |
| **T3** | Retaliation against citizen reporter | Official, local power holder | Zero PII in database. Raw MSISDNs stripped to 6-digit prefix buckets on ingress. Salted HMAC-SHA256 phone hashing. $k$-anonymity suppression ($k \ge 5$). No maps or GPS coordinates. | Small wards mitigate re-identification by suppressing below $k=5$ distinct clusters. |
| **T4** | Defamation / slander claim against the project | Aggrieved municipal office or contractor | Neutral codes, not allegations. Strict frame grammar regex. Zero banned words (*corrupt*, *bribe*, *theft*, *fraud*) in code or radio templates. | Reduced to factual data reporting. Local NGO partnership and legal review recommended before radio airtime. |
| **T5** | Stale official data presented as current | System / ingestion delay | Every receipt renders official document publication date and archive date. Staleness is made visible, never hidden. | Transparent provenance. |
| **T6** | Municipal operator / moderator capture | Local pressure on moderator | Every approval or rejection is signed and appended to the immutable SHA-256 audit chain. Two-moderator approval documented as deployment upgrade. | Single-moderator PoC is an acknowledged hackathon boundary. |
| **T7** | Voice-based identification of a caller | Surveillance actor | Voice notes decoupled (P2); 48-hour hard purge; no audio transcript stored anywhere in schema. Zero public voice clip playback. | ASR and voice transcripts strictly forbidden. |
| **T8** | Database compromise / data exfiltration | External adversary | Zero plaintext phone numbers, zero coordinates, no citizen names. Default-deny Row Level Security (RLS) across all 20 tables. The database is intentionally useless to an attacker. | Data minimization by design. |
| **T9** | Differencing attack on public divergence aggregates | Targeted statistical attacker | Strict $k \ge 5$ threshold. Sliding window queries below $k$ return zero counts and zero medians, rendering subtraction attacks mathematically impossible. | Proved by `tests/unit/differencing-attack.test.ts`. |
| **T10** | Prompt injection through ingested documents | Malicious PDF / text | Ingestion is offline and one-shot; every extracted field is human-confirmed before persistence. LLM output never triggers an autonomous action directly. | Zero autonomous agent execution on the write path. |

---

## 2. Failure Modes Handled Openly

| Failure Condition | System Behaviour |
|---|---|
| **The source document contains an error** | Ubuntu Ledger publishes the citation, not a claim of truth. The community ledger can contradict it, and the divergence is the finding. |
| **Nobody answers the inspection task** | State remains `AWAITING_THRESHOLD`. The receipt displays *"not enough reports yet"*. Silence never converts into physical confirmation. |
| **Reports contradict each other** | Triangulation marks `DISCREPANCY_FLAGGED`. Both readings remain visible side-by-side. Contradiction is a valid finding, not an error. |
| **Asset repaired then breaks on day 6** | State transitions to `PROBATION_FAILED` — the reason probation exists. |
| **Moderator never reviews bulletin** | Bulletin remains in `DRAFT` status indefinitely. Nothing reaches the radio station. |
| **A locale template is incomplete** | CI and test suite fail immediately (`CH-01`). The system does not ship a partially translated trust product. |
| **A cron job misses a run** | All cron handlers are idempotent. Probation countdowns are calculated from absolute timestamps, not tick counters. |
