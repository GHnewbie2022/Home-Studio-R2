# R6-2 Bucket 2 #2 Russian Roulette ralplan — Round 1 mid-flow handover

> Last updated: 2026-04-27
> Reason for handover: token budget hit 86%, ralplan paused mid-loop.

---

## Status

ralplan consensus **Round 1 complete**. Verdict: **ITERATE**. Awaiting Planner v2 spawn.

---

## Round 1 artifacts (read in this order)

```
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/plans/R6-2-bucket2-russian-roulette.md                  (Planner v1, 837 lines)
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/plans/R6-2-bucket2-russian-roulette-architect-r1.md     (Architect r1, 984 lines, CRITICAL_REVISION_REQUIRED, 5 fatal + 5 must-fix)
/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/plans/R6-2-bucket2-russian-roulette-critic-r1.md        (Critic r1, ITERATE, agrees with Architect + adds MJ-A / MJ-B + 5 MINOR)
```

R6-2 global state and full read order: `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/HANDOVER-R6-2.md` (do not duplicate here).

---

## Top-3 v2 required fixes (Critic r1 §12)

```
P1  MR1   Rewrite §A.1 P4 / §B.4 / §D.4 / §E.2 / §H.3 hard gate.
          From "1024-spp pixel diff = 0" → KS test (p>0.05) + 3-sigma mean diff statistical gate.
          Reason: F-1/F-2 fail-by-design death-knot, blocks every downstream fix.

P2  MR3 + MJ-A   Mask flow + willNeedDiffuseBounceRay==FALSE guard +
                 continueProb upper-bound detection (threshold 80%) +
                 §F-fast-skip root-cause hypothesis 6 → 7.
                 Reason: without this, Step 0 exit report misattributes root cause.

P3  MR4   Three-build #ifdef sweep probe.
          A1 max-channel + minBounces=3
          A2 max-channel + minBounces=5
          A3 luminance + minBounces=3
          Reason: F-5 + M-1 + MJ-B joint fix, raises alternatives depth from 1 to 3.
```

Full v2 fix list (MR1~MR5 + MJ-A + MJ-B + SR1~SR5 + MN-A~MN-E) lives in `/Users/eajrockmacmini/Documents/VS Code/My Project/Home_Studio_3D/.omc/plans/R6-2-bucket2-russian-roulette-critic-r1.md` §12 + §5 + §6 + §7.

---

## Pending action

Spawn `oh-my-claudecode:planner` agent → Planner v2 → write to same path as v1 (overwrite, append revision history).
After v2 lands: spawn Architect r2, then Critic r2 — **sequential, never parallel**.
ralplan max 5 iterations. Critic §9.3 expects Round 2 to be definitive (Architect r2 APPROVE w/caveats, Critic r2 APPROVE).

---

## Hard rules

```
DO NOT spawn Architect and Critic in the same parallel batch — sequential only.
DO NOT skip MR1 — F-1/F-2 are fail-by-design, all downstream fixes depend on it.
DO NOT bypass Step 0 probe fast-skip pattern (aligned with R6-2 four prior losses).
DO NOT use clamp / post-process denoiser to mask Russian Roulette firefly (user feedback violation).
DO NOT auto-execute / commit / push after v3 consensus — wait for user approval.
DO NOT spawn Planner v2 before user instruction.
```

---

## User-facing output style (mandatory)

```
User is a music producer, non-engineering background.
All chat to user: plain Traditional Chinese + full English (no jargon abbreviations like NEE/MIS/BSDF/PDF/RR — spell them out).
Plan / agent-internal documents may retain technical terms.
Strictly forbid Simplified Chinese and mainland-China terminology.
```

---

## Wait for instruction

Do not spawn Planner v2 until user explicitly says go (e.g. "繼續" / "v2" / "go").
