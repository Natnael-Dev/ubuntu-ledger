# 12 — Demo Script

Presentation is 25% of the score. The demo is not documentation of the build — **the build exists to produce this 90 seconds.** If a feature cannot appear here, it is not P0.

## 1. The two frames the whole project is for

A judge watching 30 demos will remember at most one image from each. Ours are:

**Frame A — the counter that refuses to move.** A second phone submits from the same area; the witness counter stays at 3 and the screen says the area is already counted.

**Frame B — the close button that cannot be pressed.** An admin, with full privileges, tries to mark the repair complete. The system returns *"Probation window is still open. 5 days remain."*

Everything else in the demo is scaffolding for these two seconds. Protect them: shoot them twice, hold them longer than feels comfortable, and do not narrate over them.

## 2. The 90-second sequence

| Time | On screen | Audio / subtitle |
|---|---|---|
| **0:00–0:10** | Close shot of a dense budget page. One line highlighted: *Kebele 08 Health Post Generator Overhaul — Contract #4412 — ETB 320,000*. No logo, no title card, no face. | *"This document says the health post got 320,000 birr for a generator. No mother waiting with a sick child can read it."* |
| **0:10–0:22** | Cut to the feature-phone simulator. Dial `*890#` → `1` → `4412`. LCD shows the receipt line. IVR mode plays the same in Amharic. | *"So it becomes a question."* (Let the Amharic audio play clean for 3 seconds. Subtitle only.) |
| **0:22–0:32** | LCD: *"When mains power stops, does the generator run? 1 Yes 2 No"* → press `2`. → *"Does the fridge show a green light? 1 Yes 2 No"* → press `2`. Witness counter moves **2 → 3**. | *"Two questions. Five minutes. Anyone standing in the room can answer them."* |
| **0:32–0:44** | **FRAME A.** Click **"second phone, same area."** A different number submits the same answers. LCD: *"Thank you. This area has already been counted, so the total stays at 3."* Counter pulses once and stays at **3**. Hold 3 full seconds in silence. | *(silence — then)* *"Ten phones from one street are one witness. Confirmations are weighted by place, not by volume."* |
| **0:44–0:56** | Cut to the console. Admin records the contractor's claim: *repair complete*. The project does **not** turn green. It shows: *"Repair claimed. Under 7-day check. 7 days left."* | *"The contractor says it is fixed. That is a claim, not a fact."* |
| **0:56–1:06** | **FRAME B.** Admin clicks **Mark complete**. Red inline error: *"Probation window is still open. 5 days remain."* Cut to the terminal: the same attempt rejected by the database CHECK constraint, and the attempt appearing in the audit chain. Hold 3 seconds. | *"No role can close this. Not admin. Not the system. It is enforced in the domain, in the service, and in the database."* |
| **1:06–1:16** | Clock advances 7 days (visible time-travel control). Day-7 pings go to the **original reporters**. One replies: still not working. Status flips to **PROBATION FAILED**. | *"On day seven, the people who reported it broken are the people who close it. They said it failed."* |
| **1:16–1:26** | Bulletin editor: the generated script appears. Export is visibly disabled — *"Needs moderator approval."* Moderator approves; export enables. The script is **read aloud**: *"In Ward 8, the health post generator was funded for 320,000 birr. Nine residents checked it. Seven say it is not working. Contract 4412. The ward council meets Friday at 9."* | *(let the read-aloud carry it; no voiceover)* |
| **1:26–1:30** | Cut to CI: 30 adversarial tests passing. Then black. One line of text: **A contractor cannot close their own ticket.** | *(silence)* |

Total: 90 seconds. If you run long, cut 0:10–0:22 (the receipt lookup), never Frame A or Frame B.

## 3. Optional 30-second extension (only if a longer cut is allowed)

- The two-ledger divergence card: *official fee 50 birr* above *11 of 14 reports say more was requested* — two separate blocks, two sources, never merged. **Say aloud: "We never merge these into one number."**
- The Monitor PWA in airplane mode: three observations queued, reconnect, three rows on the server, no duplicates.
- The Kenyan config loading the same engine with KES and different admin labels, in five seconds.

## 4. Recording checklist

**Before recording**
- [ ] `supabase db reset && npm run seed:demo` — clean, reproducible state
- [ ] Run the full sequence three times without recording; fix anything that stutters
- [ ] Browser at 1280×720 viewport, 100% zoom, no bookmarks bar, no extensions, no notifications
- [ ] Clear the terminal; set a large readable font
- [ ] Confirm the Amharic audio file plays at consistent volume
- [ ] Disable any hover-only tooltip in the path — they do not record; render as inline text
- [ ] Time-travel control visible and working (the Day-7 jump must be instant)

**While recording**
- [ ] Screen recording at 1080p; keep the file under 250 MB (H.264, ~4 Mbps is plenty for 90 s)
- [ ] Record Frame A and Frame B twice each and pick the cleaner take
- [ ] No mouse wandering; move deliberately, pause on each key frame
- [ ] Never show a loading spinner — pre-warm every route before the take

**After recording**
- [ ] Subtitles burned in (judges may watch muted)
- [ ] The Amharic segment subtitled in English
- [ ] Final frame holds the one-line thesis for 2 full seconds
- [ ] Verify file size and that it plays in a browser without download

## 5. What must not appear in the demo

- A loading spinner, a console error, a 404
- Any map
- Any chart
- The word "verified" standing alone
- Lorem ipsum, placeholder names, obviously fake figures like `123456`
- Your face or a talking-head intro
- A slide inside the demo video — the deck is a separate artifact

## 6. Narration rules

- Short declarative sentences. No "as you can see."
- Never explain a mechanism before showing it. Show, then name it in five words.
- Let Frame A and Frame B play in **silence**. Silence is what makes a judge lean in.
- Name the honest limits once, briefly, near the end of the deck rather than the video.

## 7. If something breaks mid-record

Do not patch live. Stop, reset the seed, fix, re-run the full sequence three times, then record again. A visibly repaired demo reads worse than a shorter clean one.
