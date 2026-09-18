# Demo Video Script — Ward Proof-Line (Ubuntu Ledger)

**Format:** 1080p Screen Recording with crisp narration & subtitles  
**Max Target Duration:** 2 minutes 45 seconds (Strictly ≤ 3 minutes, ≤ 250 MB)  
**Hackathon Track:** Transparency & Accountability (Secondary: Stability & Social Cohesion)  
**Theme:** *"Information you can trust"*

---

## Technical Recording Setup
- **Browser:** Chromium window set to `1280×720` or `1440×900`, 100% zoom, no bookmarks/extensions.
- **Audio:** Clear microphone with subtitles burned in (English subtitles for Amharic audio clips).
- **Environment:** Local Next.js dev server (`http://localhost:3000`), Supabase PostgreSQL running, demo seeded (`npm run seed:demo`).
- **Core Narrative Thesis:** *"A contractor cannot close their own ticket."*

---

## 6-Surface Evaluator Journey Timeline

### Surface 1: Home (`/`) — The Problem & The Core Guarantee
* **Timing:** `0:00 – 0:25` (25 seconds)
* **What to Show:**
  - Start at `http://localhost:3000/`.
  - Scroll smoothly to the headline: **"Ward Proof-Line: Ubuntu Ledger"** and the highlighted blockquote: *"A contractor cannot close their own ticket."*
  - Briefly highlight the 6-stage closed-loop pipeline schematic and the three proof cards:
    1. Proof A: Sybil Resistance
    2. Proof B: Probation Lock
    3. Proof C: Two-Ledger Separation
* **What to Click:**
  - Click on the primary call to action: **"View Citizen Receipt — Contract #4412"** or click **"Simulator"** in the top navigation.
* **Narration (What to Say):**
  > "Across East Africa, public infrastructure projects are marked complete on paper while remaining broken in reality. Official gazettes say hundreds of thousands of birr were spent, but citizens have no way to verify it.
  > Ward Proof-Line bridges this trust deficit through an open civic verification system. Our architectural invariant is simple: public money claims cannot be closed by the people who spend them. Let’s see how citizens verify work on basic feature phones."

---

### Surface 2: Simulator (`/simulator`) — Sybil Resistance (Proof A)
* **Timing:** `0:25 – 0:55` (30 seconds)
* **What to Show:**
  - The GSM feature phone handset (*890#) and LCD screen.
  - Persona selector showing **Amina** (Woreda 9, Kebele 08).
* **What to Click:**
  1. Click **Dial *890#** or enter `4412`.
  2. Answer the verification questions: *"Does the generator run?"* -> Press `2` (No). *"Does the fridge have power?"* -> Press `2` (No).
  3. Observe the witness count advance from **2 of 3 → 3 of 3**.
  4. Toggle the persona to **Girma** (a colliding neighbor on the same cell tower cluster).
  5. Repeat dialing and answer No.
  6. **THE CRITICAL MOMENT:** The LCD displays: *"Area already counted. Total stays at 3."* The counter pulses and does **not** increase.
* **Narration (What to Say):**
  > "On any $10 feature phone with no mobile data, Amina dials star-8-9-0 hash. She enters Contract 4412 for the health post generator overhaul and answers two simple physical questions. Her report moves the community witness quorum from two to three.
  > But what prevents someone from buying ten SIM cards to rig the system? When Girma submits from the same cell tower cluster, the backend detects geographic collision. The witness count stays strictly at three. Ten phones on one street are counted as one witness."

---

### Surface 3: Console (`/console`) — Probation Lock & 409 Refusal (Proof B)
* **Timing:** `0:55 – 1:30` (35 seconds)
* **What to Show:**
  - The high-density Municipal Operator Console.
  - Project `#4412` row showing state `REPORTED_BROKEN` (Red badge).
* **What to Click:**
  1. Click **"Record Contractor Claim"**. Enter contractor name `AfroTech Infra` and submit.
  2. Point out that the project badge turns **Amber** (`REPAIR_CLAIMED`), **never green**. A 7-day probation countdown appears.
  3. Click **"Attempt Close"** as an Administrator.
  4. **THE CRITICAL MOMENT:** The system refuses the request with an inline red card:  
     `409 E_PROBATION_LOCKED: Early close refused. The closing key is held by time and community.`
* **Narration (What to Say):**
  > "Now we switch to the Municipal Console. The contractor reports that they have repaired the generator. Notice: recording their claim does NOT turn the project green. It moves into amber under a mandatory 7-day probation lock.
  > If an administrator attempts to close this ticket prematurely, the system strictly refuses with an HTTP 409 Probation Locked. Even with full database administrator credentials, a database CHECK constraint and cryptographic hash chain guarantee that no official can bypass citizen verification."

---

### Surface 4: Receipt (`/receipt/4412`) — Cryptographic Provenance
* **Timing:** `1:30 – 1:55` (25 seconds)
* **What to Show:**
  - The ink-on-paper civic spending receipt for Contract `#4412`.
  - The circular verification seal, contractor amount (`ETB 320,000`), and official gazette citation (*Addis Ababa Health Bureau Gazette, Vol 14, Page 88* with SHA-256 hash).
* **What to Click:**
  1. Click **"Hear Receipt"** to demonstrate trilingual audio readout (English, Amharic, Afaan Oromo).
  2. Click **"Print Receipt"** to reveal the clean, institutional paper print layout.
* **Narration (What to Say):**
  > "Every public expenditure generates a permanent civic receipt. Here is Contract 4412: 320,000 birr. It links directly to the official gazette publication with page citations and cryptographic SHA-256 hashes.
  > For illiterate citizens or community elders, the receipt can be read aloud in local languages or printed as a clean bulletin for ward noticeboards."

---

### Surface 5: Services (`/services/ET-ID-REPLACE`) — Two-Ledger Divergence (Proof C)
* **Timing:** `1:55 – 2:20` (25 seconds)
* **What to Show:**
  - The Two-Ledger Divergence Card for Kebele Resident ID Card Replacement.
  - Left column: **Statutory Official Ceiling** (`ETB 50.00`).
  - Right column: **Community Observed Ledger** (`60% extra fee reported, median fee ETB 120.00`).
  - The **Refusal Script**: *"Circular 04/2026 states the fee is ETB 50.00. May I have an official receipt for any additional amount?"*
* **What to Click:**
  - Click **"Copy Script"** and click **"Hear this"** audio button.
* **Narration (What to Say):**
  > "In many public offices, informal fees are demanded at the counter. Traditional portals either accept the government line or report vague complaints.
  > Ward Proof-Line introduces the Two-Ledger Separation: official gazetted ceilings and k-anonymous citizen reports are presented side by side, never averaged. Below k=5, reports are suppressed to prevent retaliation. And right at the counter, citizens are given a plain-language refusal script backed by law."

---

### Surface 6: Field Monitor PWA (`/pwa`) — Offline Outbox & Reconnect Sync
* **Timing:** `2:20 – 2:40` (20 seconds)
* **What to Show:**
  - The Field Monitor PWA interface with `SyncBadge: Online`.
* **What to Click:**
  1. Click **"✈ Airplane Mode: ON"**.
  2. Submit an inspection report. Show the notice: *"Observation saved locally in offline outbox. Will sync when online."*
  3. The outbox table displays the queued observation with status `QUEUED`.
  4. Toggle Airplane Mode back to **OFF**. Watch the queue flush automatically and update to `SYNCED`.
* **Narration (What to Say):**
  > "For field monitors in remote areas with zero cellular reception, our offline Progressive Web App queues observations in client-side IndexedDB. When connectivity returns, the background sync engine flushes the queue idempotently with zero duplicate entries."

---

### Wrap-Up & Closing Thesis
* **Timing:** `2:40 – 2:55` (15 seconds)
* **What to Show:**
  - Return to terminal / GitHub repository showing the passing test suite (574 tests passing, 0 failures).
  - Final screen displaying the project motto:
    **Ward Proof-Line: Information you can trust.**
    *A contractor cannot close their own ticket.*
* **Narration (What to Say):**
  > "574 automated tests, strict database triggers, and zero-PII privacy guarantees. Ward Proof-Line proves that public trust isn't built on promises — it is built on verifiable evidence.
  > Thank you."
