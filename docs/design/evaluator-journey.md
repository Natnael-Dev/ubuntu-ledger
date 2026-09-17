# Evaluator Journey & Demonstration Guide

**Project:** Ward Proof-Line / Ubuntu Ledger  
**Track:** Transparency & Accountability (OSF × Andela Hackathon 2026)  
**Target Journey Duration:** 3 to 5 minutes  

---

## Overview for Evaluators

Ward Proof-Line is a civic evidence platform for infrastructure accountability in Kenya and Ethiopia. It solves the critical gap: **"When a contractor marks a public works repair as complete, who confirms it actually happened?"**

The platform enforces three cryptographic & database-level invariants:
1. **Proof A (Sybil Resistance):** Multiple phones from the same cell cluster count as one witness.
2. **Proof B (Probation Lock):** Mandatory 7-day citizen verification window before a ticket can be closed.
3. **Proof C (Two-Ledger Separation):** Official statutory gazette rules and citizen ground observations are kept in separate ledgers and never averaged.

---

## Step-by-Step Evaluator Flow

```text
HOME (/)
  ↓ [10-sec comprehension: Problem & System Identity]
SIMULATOR (/simulator)
  ↓ [Proof A: USSD *890# & Sybil Duplicate Cluster Suppression]
CONSOLE (/console)
  ↓ [Proof B: Probation Lock & Early Closure 409 Rejection]
RECEIPT (/receipt/4412)
  ↓ [Public Proof: Printable Citizen Receipt, SHA-256 Provenance & Audio]
DIVERGENCE (/services/ET-ID-REPLACE)
  ↓ [Proof C: Statutory vs Community Ledger & Citizen Refusal Script]
OUTBOX PWA (/pwa)
  ↓ [Offline Resilience: Airplane Mode, IndexedDB Queue & Idempotent Sync]
```

---

### Step 1: Landing on Home (`/`)
- **Time:** 0:00 – 0:30
- **What to look at:**
  - The header identity: "Ward Proof-Line // Ubuntu Ledger"
  - The problem statement: "Who checks whether a repair actually happened?"
  - The 6-stage Proof-Line Closed-Loop Architecture schematic:
    `Source -> Observation -> Triangulation -> Probation -> Two-Ledger -> Public Proof`
  - The 3 Enforced Proofs overview.
- **Action:** Click **"Watch it in the Simulator →"** or navigate via the top bar to **Simulator**.

---

### Step 2: Feature-Phone Simulator (`/simulator`) — Proof A (Sybil Resistance)
- **Time:** 0:30 – 1:45
- **Goal:** Verify that a second phone from the same geographic cluster is suppressed from inflating witness counts.
- **Actions:**
  1. Under **Active Persona**, note that **Amina** is selected (`+251999000003`, Cluster Gamma).
  2. On the physical feature-phone keypad, click the green **DIAL *890#** button.
  3. In the LCD menu, press **1** (Report issue / check status), then click the checkmark or Enter.
  4. Enter project code **4412**, then click checkmark.
  5. The prompt asks 3 verification questions. Press **2** (No / Broken) for each.
  6. The backend returns: Observation recorded! Note that the witness count increments from **2 to 3**.
  7. Now, switch persona on the left to **Girma** (`+251999000004`, Cluster Gamma - Duplicate Cluster).
  8. Click **DIAL *890#** and repeat the flow for project **4412**.
  9. **Key Result:** The LCD displays: *"Observation from this area already recorded. Thank you."*
  10. In the HTTP Transcript on the right, observe the raw backend JSON payload confirming `isSuppressedDuplicate: true` and witness count remaining at 3!

---

### Step 3: Municipal Operator Console (`/console`) — Proof B (Probation Lock)
- **Time:** 1:45 – 2:45
- **Goal:** Verify that neither an administrator nor a contractor can close a repair ticket during the 7-day probation period.
- **Actions:**
  1. Inspect the Project Board table. Find **Project 4412** (*Health post generator overhaul*).
  2. Notice the status badge: `REPAIR CLAIMED` with `5d left` in probation.
  3. Click the button: **[Attempt Close]**.
  4. **Key Result:** The application issues a red refusal banner:
     `409 E_PROBATION_LOCKED — Early Close Refused. Ticket cannot be closed before probation window ends.`
  5. The closure is rejected at the database level by a PostgreSQL constraint, guaranteeing that contractor claims cannot bypass community verification.

---

### Step 4: Public Spending Receipt (`/receipt/4412`)
- **Time:** 2:45 – 3:30
- **Goal:** Inspect how citizens verify project spending with cryptographic provenance.
- **Actions:**
  1. Observe the paper receipt layout: Woreda 9, Contract #4412, ETB 320,000.
  2. Under **SOURCE**, note the official citation: *Woreda 9 Capital Budget FY2026, page 41*, archived timestamp, and SHA-256 hash.
  3. Under **CHECKED**, read the provenance sentence: *"Nine neighbours checked this on Tuesday. Two said it runs; seven said it does not."*
  4. Click the **▶ hear this** audio button to hear the read-aloud playback for low-literacy inclusion.
  5. Click **[print receipt]** to see the clean, ink-saving printable view.

---

### Step 5: Two-Ledger Divergence Card (`/services/ET-ID-REPLACE`) — Proof C
- **Time:** 3:30 – 4:15
- **Goal:** Understand why official statutory rules and citizen reports must never be merged or averaged.
- **Actions:**
  1. Left container (**Official Statutory Ledger**): Shows official fee ceiling of **ETB 50.00** from Civil Registration Circular 14/2026.
  2. Right container (**Community Observed Ledger**): Shows **78.6%** of citizens report extra fees requested, with a median fee of **ETB 200.00**.
  3. Notice the **DIVERGENCE ALERT**: The two ledgers are displayed side by side without averaging. If the numbers were averaged, the official ceiling would be obscured and the citizen overcharge normalized.
  4. Bottom container (**Refusal Script**): Provides citizens with the exact statutory script to read aloud when overcharged:
     *"Civil Registration Statutory Fee Circular 14/2026 states the fee is ETB 50.00. May I have an official receipt for any additional amount?"*
  5. Click **Copy script** or **▶ Hear this**.

---

### Step 6: Field Monitor PWA (`/pwa`) — Offline Resilience
- **Time:** 4:15 – 5:00
- **Goal:** Verify that the platform operates in low-connectivity rural environments without losing data.
- **Actions:**
  1. In the header, click the **✈ Airplane Mode: OFF (Live)** button to toggle it to **✈ Airplane Mode: ON (Buffered)**.
  2. Fill out the inspection checklist and click **SUBMIT FIELD OBSERVATION**.
  3. Note that the record appears in the **Offline Outbox Records** table with status `QUEUED`.
  4. Toggle Airplane Mode back to **OFF (Live)**.
  5. **Key Result:** The outbox immediately initiates automatic background synchronization, updating the record status to `SYNCED` with zero duplicate submissions.

---

## Conclusion

At the end of this 5-minute journey, evaluators have observed:
- A complete, working proof-of-concept operating across USSD, web console, printable receipt, divergence card, and offline PWA.
- Cryptographic provenance and database-enforced integrity.
- Deep alignment with African civic reality (low bandwidth, multilingual, offline, literacy-inclusive).
- Full compliance with the OSF × Andela Hackathon Transparency & Accountability track.
