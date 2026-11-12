---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases.
---

<!-- Adapted from mattpocock/skills (MIT License, Copyright (c) 2026 Matt Pocock).
     Changes: per-round question cap, delegation handling, written decision record. -->

Interview the user relentlessly until you reach a shared understanding. Map this as a **design tree**: every decision branches into the decisions that hang off it.

## Rounds

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled: the questions you can ask _now_ without guessing at answers you haven't heard yet.

Ask **at most 5 questions per round**. If the frontier is larger, ask the 5 whose answers unblock the most downstream decisions, and say how many frontier questions are queued for later. Number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format a round like so:

```
**Round <n>** — <k> questions (<m> more queued)

❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

Word each question so "yes" accepts your recommended answer. Keep numbering continuous across rounds (Q6, Q7, ...) so answers can be referenced later.

Each round the user answers reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

## Answers

- **"Yes" / silence on a question in an otherwise answered round**: accept your recommendation.
- **"You decide" / "whatever you think"**: accept your recommendation, but mark it **delegated** in the record so it can be revisited.
- **"Not sure" / "don't know yet"**: mark it **deferred**. Do not ask questions downstream of it; note them as blocked in the record.
- **An answer that contradicts an earlier decision**: point out the conflict explicitly and ask which one wins before continuing.

## Facts vs. decisions

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment (filesystem, tools, etc.), dispatch a sub-agent with a fresh context window to find it; don't ask the user for anything you could look up yourself. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait for the sub-agent to report; ask the rest of the frontier now. The _decisions_ are the user's: put each to them and wait.

## Finishing

The session is done when the frontier is empty: every branch of the design tree visited, nothing left silently assumed (deferred items count as visited, but stay listed).

Then produce a **decision record**:

```
## Decision record: <topic>

### Decided
- Q<n> <title>: <decision> — <one-line rationale>

### Delegated (my call, revisit if needed)
- Q<n> <title>: <decision>

### Deferred / blocked
- Q<n> <title>: <why open> — blocks Q<x>, Q<y>

### Facts discovered
- <fact> (source: <file/tool>)
```

Ask whether the user wants it saved to a file (suggest `docs/decisions/<yyyy-mm-dd>-<slug>.md` in the current repo). Do not act on the plan until the user confirms you have reached a shared understanding.
