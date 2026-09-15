# How to use these files with your agent

## 1. Put them in the repo first

```bash
mkdir -p docs/specs
cp *.md docs/specs/
cp 13-ai-build-log-template.md docs/ai-build-log.md   # then strip it to the header
git add docs && git commit -m "add project specs"
```

Committing the specs **before** any code is itself an artifact: the repo history shows spec-driven development, which is exactly what the AI Coding Usage criterion is looking for.

## 2. The opening prompt to the agent

```
Read docs/specs/09-agent.md and docs/specs/17-scope-control.md in full, then
docs/specs/00-README.md and follow its consumption order.

You are implementing Ward Proof-Line. The specs are the decisions; you implement them.

Start with Batch 1A (tasks T-01 to T-06 in 11-tasks.md).

Output a PLAN ONLY: files to touch, approach, commit breakdown, what you searched for
and what you found, risks, and the edge cases you will test. NO CODE.

Stop after the plan and wait for my approval.
```

## 3. The rhythm for every batch

1. Paste the batch instruction (as above, changing the batch).
2. Agent returns a plan only.
3. **You bring the plan to me for review.** I approve, partially approve, or reject with specifics.
4. You paste the approval back to the agent: *"Plan approved. Execute exactly as planned. Report with actual command output."*
5. Agent builds, tests, commits, reports.
6. **You bring the agent's evidence summary to me for audit** before the next batch.

Batches align with the checkpoints in `11-tasks.md`: 1A, 1B, Day 2, Day 3, Day 4, Day 5.

## 4. What to reject without asking me

- Code delivered in the same turn as a plan
- A report that says "tests pass" without pasted output
- A new dependency with no justification line
- Business logic inside a route handler or component
- Any `status` assignment outside a state machine
- A commit message with a `feat:`/`fix:` prefix or an AI footer

## 5. The three rules to repeat to the agent when it drifts

1. **Plan first, code after approval.**
2. **Evidence, not claims.**
3. **If the spec and your instinct disagree, the spec wins — escalate instead of improvising.**

## 6. Daily

Start each day by pasting `17-scope-control.md §7` to the agent and answering the four questions in the build log. If both demo frames are not working, that is the entire day's scope.
